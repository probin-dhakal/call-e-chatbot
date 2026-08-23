import os

# faiss and torch (via sentence-transformers) both bundle their own OpenMP
# runtime; loading both natively in one process can segfault on macOS unless
# this is set before either is imported anywhere in the app.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config import Config
from models import db
from services.supabase_storage import ensure_bucket_exists


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    os.makedirs(app.config["VECTOR_FOLDER"], exist_ok=True)

    if app.config["SUPABASE_URL"] and app.config["SUPABASE_SERVICE_KEY"]:
        ensure_bucket_exists(
            app.config["SUPABASE_URL"], app.config["SUPABASE_SERVICE_KEY"], app.config["SUPABASE_STORAGE_BUCKET"]
        )

    db.init_app(app)
    JWTManager(app)

    CORS(app, resources={
        r"/api/*": {
            "origins": app.config["FRONTEND_ORIGINS"],
            "methods": ["GET", "POST", "OPTIONS"],
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

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
