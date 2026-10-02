import os

# faiss and torch (via sentence-transformers) both bundle their own OpenMP
# runtime; loading both natively in one process can segfault on macOS unless
# this is set before either is imported anywhere in the app.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from sqlalchemy import inspect, text
from apscheduler.schedulers.background import BackgroundScheduler

from config import Config
from models import db
from services.supabase_storage import ensure_bucket_exists


def _upgrade_conversation_schema():
    """Small additive migration for installations created before activity tracking."""
    columns = {column["name"] for column in inspect(db.engine).get_columns("conversations")}
    if "last_activity_at" in columns:
        return
    column_type = "TIMESTAMP WITH TIME ZONE" if db.engine.dialect.name == "postgresql" else "DATETIME"
    db.session.execute(text(f"ALTER TABLE conversations ADD COLUMN last_activity_at {column_type}"))
    db.session.execute(text(
        "UPDATE conversations SET last_activity_at = COALESCE(started_at, CURRENT_TIMESTAMP) "
        "WHERE last_activity_at IS NULL"
    ))
    db.session.commit()


def _start_conversation_cleanup(app):
    from routes.conversations import cleanup_inactive_conversations

    scheduler = BackgroundScheduler(daemon=True)
    scheduler.add_job(
        cleanup_inactive_conversations,
        "interval",
        args=[app],
        seconds=app.config["CONVERSATION_CLEANUP_INTERVAL_SECONDS"],
        id="conversation-inactivity-cleanup",
        replace_existing=True,
    )
    scheduler.start()
    app.extensions["conversation_cleanup_scheduler"] = scheduler


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    #os.makedirs(app.config["VECTOR_FOLDER"], exist_ok=True)

    if app.config["SUPABASE_URL"] and app.config["SUPABASE_SERVICE_KEY"]:
        ensure_bucket_exists(
            app.config["SUPABASE_URL"], app.config["SUPABASE_SERVICE_KEY"], app.config["SUPABASE_STORAGE_BUCKET"]
        )

    db.init_app(app)
    JWTManager(app)

    CORS(app, resources={
        r"/api/*": {
            "origins": app.config["FRONTEND_ORIGINS"],
            "methods": ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True,
        }
    })

    from routes.auth import auth_bp
    from routes.company import company_bp
    from routes.agent import agent_bp
    from routes.documents import documents_bp
    from routes.conversations import conversations_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(company_bp)
    app.register_blueprint(agent_bp)
    app.register_blueprint(documents_bp)
    app.register_blueprint(conversations_bp)

    with app.app_context():
        db.create_all()
        _upgrade_conversation_schema()

    _start_conversation_cleanup(app)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
