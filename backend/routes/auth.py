from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required
from models import db, Company
from utils.auth import get_current_company

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or not password:
        return jsonify({"error": "name, email and password are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if Company.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists"}), 409

    company = Company(name=name, email=email)
    company.set_password(password)
    db.session.add(company)
    db.session.commit()

    access_token = create_access_token(identity=str(company.id))
    return jsonify({"access_token": access_token, "company": company.to_dict()}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    company = Company.query.filter_by(email=email).first()
    if not company or not company.check_password(password):
        return jsonify({"error": "Invalid email or password"}), 401

    access_token = create_access_token(identity=str(company.id))
    return jsonify({"access_token": access_token, "company": company.to_dict()}), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    company = get_current_company()
    if not company:
        return jsonify({"error": "Company not found"}), 404
    return jsonify({"company": company.to_dict()}), 200
