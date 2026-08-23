import hashlib
import io
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename
from models import db, Document, Agent
from utils.auth import get_current_company
from utils.files import unique_stored_filename
from services.pdf_text import extract_text_from_pdf
from services.chunking import chunk_text
from services.vector_store import add_document_to_index, remove_document_from_index
from services.supabase_storage import upload_file, download_file, delete_file

documents_bp = Blueprint("documents", __name__, url_prefix="/api/documents")

ALLOWED_MIME_TYPES = {"application/pdf"}


def _is_pdf(file_storage):
    filename = (file_storage.filename or "").lower()
    return filename.endswith(".pdf") and file_storage.mimetype in ALLOWED_MIME_TYPES


def _storage_config():
    cfg = current_app.config
    return cfg["SUPABASE_URL"], cfg["SUPABASE_SERVICE_KEY"], cfg["SUPABASE_STORAGE_BUCKET"]


def _process_document(document, content_bytes):
    """Run the extract -> chunk -> embed -> FAISS pipeline for one document,
    updating its status in place. Never raises — failures are recorded on
    the document itself so one bad PDF doesn't fail the whole upload batch.
    Reads straight from in-memory bytes; the PDF is never written to local disk.
    """
    document.status = "processing"
    db.session.commit()

    try:
        text = extract_text_from_pdf(io.BytesIO(content_bytes))
        if not text:
            raise ValueError("No extractable text found in this PDF")

        chunks = chunk_text(
            text,
            chunk_size=current_app.config["CHUNK_SIZE"],
            chunk_overlap=current_app.config["CHUNK_OVERLAP"],
        )
        if not chunks:
            raise ValueError("No content chunks could be created from this PDF")

        model_name = current_app.config["EMBEDDING_MODEL_NAME"]
        chunk_count, index_path = add_document_to_index(
            current_app.config["VECTOR_FOLDER"],
            document.company_id,
            document.agent_id,
            document.id,
            chunks,
            model_name,
        )

        document.status = "completed"
        document.vector_path = index_path
        document.embedding_model = model_name
        document.chunk_count = chunk_count
        document.error_message = None
    except Exception as e:
        document.status = "failed"
        document.error_message = str(e)
    finally:
        db.session.commit()


@documents_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_documents():
    company = get_current_company()
    if not company:
        return jsonify({"error": "Company not found"}), 404

    agent_id = request.form.get("agent_id", type=int)
    if not agent_id:
        return jsonify({"error": "agent_id is required"}), 400

    agent = Agent.query.filter_by(id=agent_id, company_id=company.id).first()
    if not agent:
        return jsonify({"error": "Agent not found for this organization"}), 404

    uploaded_files = [f for f in request.files.getlist("files") if f and f.filename]
    if not uploaded_files:
        return jsonify({"error": "No files provided"}), 400

    supabase_url, supabase_key, bucket = _storage_config()

    saved_documents = []
    rejected_files = []
    duplicate_files = []

    for file in uploaded_files:
        if not _is_pdf(file):
            rejected_files.append(file.filename)
            continue

        content = file.read()
        file_hash = hashlib.sha256(content).hexdigest()

        already_processed = Document.query.filter_by(
            company_id=company.id, agent_id=agent.id, file_hash=file_hash, status="completed"
        ).first()
        if already_processed:
            duplicate_files.append(file.filename)
            continue

        original_name = secure_filename(file.filename) or "document.pdf"
        stored_name = unique_stored_filename()
        storage_path = f"company_{company.id}/agent_{agent.id}/{stored_name}"

        try:
            upload_file(supabase_url, supabase_key, bucket, storage_path, content)
        except Exception:
            current_app.logger.exception("Failed to upload %s to Supabase Storage", original_name)
            rejected_files.append(file.filename)
            continue

        document = Document(
            company_id=company.id,
            agent_id=agent.id,
            original_filename=original_name,
            stored_filename=stored_name,
            file_path=storage_path,
            file_size=len(content),
            file_type="pdf",
            file_hash=file_hash,
            status="uploaded",
        )
        db.session.add(document)
        db.session.commit()

        # Process straight from the bytes already in memory — no local disk
        # round-trip needed for a PDF we just uploaded to Storage.
        _process_document(document, content)
        saved_documents.append(document)

    if not saved_documents and not duplicate_files:
        return jsonify({"error": "Only PDF files are allowed", "rejected": rejected_files}), 400

    return jsonify({
        "documents": [d.to_dict() for d in saved_documents],
        "rejected": rejected_files,
        "duplicates": duplicate_files,
    }), 201


@documents_bp.route("", methods=["GET"])
@jwt_required()
def list_documents():
    company = get_current_company()
    if not company:
        return jsonify({"error": "Company not found"}), 404

    query = Document.query.filter_by(company_id=company.id)

    agent_id = request.args.get("agent_id", type=int)
    if agent_id:
        query = query.filter_by(agent_id=agent_id)

    documents = query.order_by(Document.uploaded_at.desc()).all()
    return jsonify({"documents": [d.to_dict() for d in documents]}), 200


@documents_bp.route("/<int:document_id>", methods=["DELETE"])
@jwt_required()
def delete_document(document_id):
    company = get_current_company()
    if not company:
        return jsonify({"error": "Company not found"}), 404

    document = Document.query.filter_by(id=document_id, company_id=company.id).first()
    if not document:
        return jsonify({"error": "Document not found"}), 404

    # Rebuild the FAISS index without this document's vectors before
    # touching the DB row, so we never leave orphaned vectors behind.
    remove_document_from_index(
        current_app.config["VECTOR_FOLDER"], document.company_id, document.agent_id, document.id
    )

    try:
        supabase_url, supabase_key, bucket = _storage_config()
        delete_file(supabase_url, supabase_key, bucket, document.file_path)
    except Exception:
        current_app.logger.exception("Failed to delete %s from Supabase Storage", document.file_path)

    db.session.delete(document)
    db.session.commit()

    return jsonify({"success": True}), 200


@documents_bp.route("/<int:document_id>/reprocess", methods=["POST"])
@jwt_required()
def reprocess_document(document_id):
    company = get_current_company()
    if not company:
        return jsonify({"error": "Company not found"}), 404

    document = Document.query.filter_by(id=document_id, company_id=company.id).first()
    if not document:
        return jsonify({"error": "Document not found"}), 404

    try:
        supabase_url, supabase_key, bucket = _storage_config()
        content = download_file(supabase_url, supabase_key, bucket, document.file_path)
    except Exception:
        current_app.logger.exception("Failed to download %s from Supabase Storage", document.file_path)
        return jsonify({"error": "Original file is no longer available in storage"}), 404

    # Drop any vectors from a previous attempt first so reprocessing never duplicates them.
    remove_document_from_index(
        current_app.config["VECTOR_FOLDER"], document.company_id, document.agent_id, document.id
    )

    _process_document(document, content)

    return jsonify({"document": document.to_dict()}), 200
