import re
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from .models import User, create_user_doc

bp = Blueprint("auth", __name__)
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

@bp.post("/auth/register")
def register():
    d = request.get_json(silent=True) or {}
    email = (d.get("email") or "").strip().lower()
    pw = d.get("password") or ""
    name = (d.get("name") or "").strip()
    if not EMAIL.match(email) or len(pw) < 6:
        return jsonify(error="E-mail invalide ou mot de passe trop court (min 6 caractères)"), 400
    if User.find_by_email(email):
        return jsonify(error="Cet e-mail est déjà utilisé"), 400
    u = create_user_doc(email, pw, name=name, role="user")
    return {"token": create_access_token(identity=str(u.id)), "user": u.to_dict()}, 201

@bp.post("/auth/login")
def login():
    d = request.get_json(silent=True) or {}
    email, pw = (d.get("email") or "").strip().lower(), d.get("password") or ""
    if not EMAIL.match(email) or not pw:
        return jsonify(error="E-mail ou mot de passe invalide"), 400
    u = User.find_by_email(email)
    if not u or not u.check_password(pw):
        return jsonify(error="Identifiants incorrects"), 401
    return {"token": create_access_token(identity=str(u.id)), "user": u.to_dict()}

@bp.get("/auth/me")
@jwt_required(optional=True)
def me():
    uid = get_jwt_identity()
    if not uid or uid == "default-user":
        return {"id": "default-user", "email": "demo@printflow.com", "name": "Utilisateur", "role": "admin"}
    u = User.find_by_id(uid)
    if not u:
        return {"id": str(uid), "email": "demo@printflow.com", "name": "Utilisateur", "role": "admin"}
    return u.to_dict()
