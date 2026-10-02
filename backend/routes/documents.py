import hashlib
import threading

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename

from models import db, Document, Agent
from utils.auth import get_current_company
from utils.files import unique_stored_filename
from services.pdf_text import load_pdf_documents
from services.chunking import chunk_documents
from services.vector_store import (
    add_document_to_index,
    remove_document_from_index,
)
from services.supabase_storage import (
    upload_file,
    download_file,
    delete_file,
)


documents_bp = Blueprint(
    "documents",
    __name__,
    url_prefix="/api/documents",
)

ALLOWED_MIME_TYPES = {"application/pdf"}


def _is_pdf(file_storage):
    filename = (file_storage.filename or "").lower()
    return (
        filename.endswith(".pdf")
        and file_storage.mimetype in ALLOWED_MIME_TYPES
    )


def _storage_config():
    cfg = current_app.config

    return (
        cfg["SUPABASE_URL"],
        cfg["SUPABASE_SERVICE_KEY"],
        cfg["SUPABASE_STORAGE_BUCKET"],
    )


def _process_document(
    document_id,
    company_id,
    agent_id,
    original_filename,
    content_bytes,
    app,
):
    """
    Process a PDF in a background thread.

    Pipeline:
        PDF extraction
            ↓
        Chunking
            ↓
        Embeddings
            ↓
        FAISS indexing

    The function updates the document status:
        processing → completed

    If anything fails:
        processing → failed
    """

    with app.app_context():

        document = db.session.get(Document, document_id)

        if not document:
            app.logger.error(
                "Background processing: document %s not found",
                document_id,
            )
            return

        try:
            # ---------------------------------------------------------
            # 1. Mark document as processing
            # ---------------------------------------------------------

            document.status = "processing"
            document.error_message = None
            db.session.commit()

            app.logger.info(
                "Started PDF processing: document_id=%s",
                document_id,
            )

            # ---------------------------------------------------------
            # 2. Extract text from PDF
            # ---------------------------------------------------------

            pages = load_pdf_documents(
                content_bytes,
                {
                    "source": original_filename,
                    "document_id": document_id,
                },
            )

            if not pages:
                raise ValueError(
                    "No extractable text found in this PDF"
                )

            app.logger.info(
                "PDF text extraction completed: document_id=%s pages=%s",
                document_id,
                len(pages),
            )

            # ---------------------------------------------------------
            # 3. Chunk the extracted text
            # ---------------------------------------------------------

            chunks = chunk_documents(
                pages,
                chunk_size=app.config["CHUNK_SIZE"],
                chunk_overlap=app.config["CHUNK_OVERLAP"],
            )

            if not chunks:
                raise ValueError(
                    "No content chunks could be created from this PDF"
                )

            app.logger.info(
                "PDF chunking completed: document_id=%s chunks=%s",
                document_id,
                len(chunks),
            )

            # ---------------------------------------------------------
            # 4. Create embeddings and add to FAISS
            # ---------------------------------------------------------

            model_name = app.config["EMBEDDING_MODEL_NAME"]

            chunk_count, index_path = add_document_to_index(
                app.config["VECTOR_FOLDER"],
                company_id,
                agent_id,
                document_id,
                chunks,
                model_name,
            )

            # ---------------------------------------------------------
            # 5. Mark document as completed
            # ---------------------------------------------------------

            document.status = "completed"
            document.vector_path = index_path
            document.embedding_model = model_name
            document.chunk_count = chunk_count
            document.error_message = None

            db.session.commit()

            app.logger.info(
                "PDF processing completed: document_id=%s chunks=%s",
                document_id,
                chunk_count,
            )

        except Exception as e:

            # Roll back any failed DB transaction first.
            db.session.rollback()

            # Re-fetch the document after rollback.
            document = db.session.get(
                Document,
                document_id,
            )

            if document:
                document.status = "failed"
                document.error_message = str(e)

                try:
                    db.session.commit()
                except Exception:
                    db.session.rollback()

            app.logger.exception(
                "PDF processing failed: document_id=%s",
                document_id,
            )

        finally:
            # Remove the SQLAlchemy session associated with
            # this background thread.
            db.session.remove()


@documents_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_documents():

    company = get_current_company()

    if not company:
        return jsonify({
            "error": "Company not found"
        }), 404

    agent_id = request.form.get(
        "agent_id",
        type=int,
    )

    if not agent_id:
        return jsonify({
            "error": "agent_id is required"
        }), 400

    agent = Agent.query.filter_by(
        id=agent_id,
        company_id=company.id,
    ).first()

    if not agent:
        return jsonify({
            "error": "Agent not found for this organization"
        }), 404

    uploaded_files = [
        f
        for f in request.files.getlist("files")
        if f and f.filename
    ]

    if not uploaded_files:
        return jsonify({
            "error": "No files provided"
        }), 400

    supabase_url, supabase_key, bucket = _storage_config()

    saved_documents = []
    rejected_files = []
    duplicate_files = []

    for file in uploaded_files:

        # ---------------------------------------------------------
        # 1. Validate PDF
        # ---------------------------------------------------------

        if not _is_pdf(file):
            rejected_files.append(file.filename)
            continue

        # ---------------------------------------------------------
        # 2. Read file
        # ---------------------------------------------------------

        content = file.read()

        if not content:
            rejected_files.append(file.filename)
            continue

        # ---------------------------------------------------------
        # 3. Calculate file hash
        # ---------------------------------------------------------

        file_hash = hashlib.sha256(
            content
        ).hexdigest()

        # ---------------------------------------------------------
        # 4. Check duplicate
        # ---------------------------------------------------------

        already_processed = Document.query.filter_by(
            company_id=company.id,
            agent_id=agent.id,
            file_hash=file_hash,
            status="completed",
        ).first()

        if already_processed:
            duplicate_files.append(file.filename)
            continue

        # ---------------------------------------------------------
        # 5. Generate storage path
        # ---------------------------------------------------------

        original_name = (
            secure_filename(file.filename)
            or "document.pdf"
        )

        stored_name = unique_stored_filename()

        storage_path = (
            f"company_{company.id}/"
            f"agent_{agent.id}/"
            f"{stored_name}"
        )

        # ---------------------------------------------------------
        # 6. Upload original PDF to Supabase Storage
        # ---------------------------------------------------------

        try:

            upload_file(
                supabase_url,
                supabase_key,
                bucket,
                storage_path,
                content,
            )

        except Exception:

            current_app.logger.exception(
                "Failed to upload %s to Supabase Storage",
                original_name,
            )

            rejected_files.append(
                file.filename
            )

            continue

        # ---------------------------------------------------------
        # 7. Create DB record
        # ---------------------------------------------------------

        document = Document(
            company_id=company.id,
            agent_id=agent.id,
            original_filename=original_name,
            stored_filename=stored_name,
            file_path=storage_path,
            file_size=len(content),
            file_type="pdf",
            file_hash=file_hash,

            # Important:
            # Processing happens asynchronously.
            status="processing",
        )

        db.session.add(document)
        db.session.commit()

        # ---------------------------------------------------------
        # 8. Start background PDF processing
        # ---------------------------------------------------------

        app = current_app._get_current_object()

        thread = threading.Thread(
            target=_process_document,
            args=(
                document.id,
                document.company_id,
                document.agent_id,
                document.original_filename,
                content,
                app,
            ),
            daemon=True,
        )

        thread.start()

        # ---------------------------------------------------------
        # 9. Add document to response list
        # ---------------------------------------------------------

        saved_documents.append(document)

    # -------------------------------------------------------------
    # No successful uploads
    # -------------------------------------------------------------

    if not saved_documents and not duplicate_files:
        return jsonify({
            "error": "Only PDF files are allowed",
            "rejected": rejected_files,
        }), 400

    # -------------------------------------------------------------
    # Return immediately.
    #
    # PDF processing continues in background.
    # -------------------------------------------------------------

    return jsonify({
        "documents": [
            d.to_dict()
            for d in saved_documents
        ],
        "rejected": rejected_files,
        "duplicates": duplicate_files,
    }), 201


@documents_bp.route("", methods=["GET"])
@jwt_required()
def list_documents():

    company = get_current_company()

    if not company:
        return jsonify({
            "error": "Company not found"
        }), 404

    query = Document.query.filter_by(
        company_id=company.id
    )

    agent_id = request.args.get(
        "agent_id",
        type=int,
    )

    if agent_id:
        query = query.filter_by(
            agent_id=agent_id
        )

    documents = query.order_by(
        Document.uploaded_at.desc()
    ).all()

    return jsonify({
        "documents": [
            d.to_dict()
            for d in documents
        ]
    }), 200


@documents_bp.route(
    "/<int:document_id>",
    methods=["DELETE"],
)
@jwt_required()
def delete_document(document_id):

    company = get_current_company()

    if not company:
        return jsonify({
            "error": "Company not found"
        }), 404

    document = Document.query.filter_by(
        id=document_id,
        company_id=company.id,
    ).first()

    if not document:
        return jsonify({
            "error": "Document not found"
        }), 404

    # ---------------------------------------------------------
    # Remove vectors from FAISS
    # ---------------------------------------------------------

    remove_document_from_index(
        current_app.config["VECTOR_FOLDER"],
        document.company_id,
        document.agent_id,
        document.id,
        current_app.config["EMBEDDING_MODEL_NAME"],
    )

    # ---------------------------------------------------------
    # Delete PDF from Supabase Storage
    # ---------------------------------------------------------

    try:

        supabase_url, supabase_key, bucket = _storage_config()

        delete_file(
            supabase_url,
            supabase_key,
            bucket,
            document.file_path,
        )

    except Exception:

        current_app.logger.exception(
            "Failed to delete %s from Supabase Storage",
            document.file_path,
        )

    # ---------------------------------------------------------
    # Delete DB record
    # ---------------------------------------------------------

    db.session.delete(document)
    db.session.commit()

    return jsonify({
        "success": True
    }), 200


@documents_bp.route(
    "/<int:document_id>/reprocess",
    methods=["POST"],
)
@jwt_required()
def reprocess_document(document_id):

    company = get_current_company()

    if not company:
        return jsonify({
            "error": "Company not found"
        }), 404

    document = Document.query.filter_by(
        id=document_id,
        company_id=company.id,
    ).first()

    if not document:
        return jsonify({
            "error": "Document not found"
        }), 404

    # ---------------------------------------------------------
    # Download original PDF from Supabase
    # ---------------------------------------------------------

    try:

        supabase_url, supabase_key, bucket = _storage_config()

        content = download_file(
            supabase_url,
            supabase_key,
            bucket,
            document.file_path,
        )

    except Exception:

        current_app.logger.exception(
            "Failed to download %s from Supabase Storage",
            document.file_path,
        )

        return jsonify({
            "error": "Original file is no longer available in storage"
        }), 404

    # ---------------------------------------------------------
    # Remove old vectors
    # ---------------------------------------------------------

    try:

        remove_document_from_index(
            current_app.config["VECTOR_FOLDER"],
            document.company_id,
            document.agent_id,
            document.id,
            current_app.config["EMBEDDING_MODEL_NAME"],
        )

    except Exception:

        current_app.logger.exception(
            "Failed to remove old vectors for document %s",
            document.id,
        )

        return jsonify({
            "error": "Failed to remove previous document vectors"
        }), 500

    # ---------------------------------------------------------
    # Mark as processing
    # ---------------------------------------------------------

    document.status = "processing"
    document.error_message = None

    db.session.commit()

    # ---------------------------------------------------------
    # Start background processing
    # ---------------------------------------------------------

    app = current_app._get_current_object()

    thread = threading.Thread(
        target=_process_document,
        args=(
            document.id,
            document.company_id,
            document.agent_id,
            document.original_filename,
            content,
            app,
        ),
        daemon=True,
    )

    thread.start()

    # ---------------------------------------------------------
    # Return immediately
    # ---------------------------------------------------------

    return jsonify({
        "document": document.to_dict()
    }), 200