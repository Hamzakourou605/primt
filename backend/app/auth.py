import re
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from .models import User
from . import db

bp = Blueprint("auth", __name__)
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

@bp.post("/auth/login")
def login():
    d = request.get_json(silent=True) or {}
    email, pw = (d.get("email") or "").strip().lower(), d.get("password") or ""
    if not EMAIL.match(email) or not pw:
        return jsonify(error="E-mail ou mot de passe invalide"), 400
    u = User.query.filter_by(email=email).first()
    if not u or not u.check_password(pw):
        return jsonify(error="Identifiants incorrects"), 401
    return {"token": create_access_token(identity=str(u.id)), "user": u.to_dict()}

@bp.get("/auth/me")
@jwt_required()
def me():
    return db.get_or_404(User, int(get_jwt_identity())).to_dict()
