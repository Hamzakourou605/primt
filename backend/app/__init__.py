from flask import Flask, jsonify
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
import click
from .db import init_db, get_db

jwt = JWTManager()

def create_app(config=None):
    from config import Config
    app = Flask(__name__)
    app.config.from_object(config or Config)
    init_db(app)
    jwt.init_app(app)
    CORS(app, origins=app.config.get("CORS_ORIGINS", ["*"]))

    from .auth import bp as auth_bp
    from .jobs import bp as jobs_bp
    from .stats import bp as stats_bp
    for b in (auth_bp, jobs_bp, stats_bp):
        app.register_blueprint(b, url_prefix="/api")

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.errorhandler(HTTPException)
    def http_err(e):
        return jsonify(error=e.description), e.code

    @app.errorhandler(Exception)
    def any_err(e):
        app.logger.exception(e)
        return jsonify(error="Erreur interne"), 500

    @jwt.unauthorized_loader
    @jwt.invalid_token_loader
    def unauth(_):
        return jsonify(error="Non authentifié"), 401

    @app.cli.command("create-user")
    @click.argument("email")
    @click.argument("password")
    @click.option("--name", default="")
    @click.option("--role", default="user")
    def create_user(email, password, name, role):
        from .models import create_user_doc
        create_user_doc(email, password, name, role)
        print("Utilisateur créé")

    @app.cli.group("db")
    def db_cli():
        """Database commands"""
        pass

    @db_cli.command("upgrade")
    def db_upgrade():
        print("MongoDB Atlas: aucune migration SQL requise, étape ignorée.")

    return app
