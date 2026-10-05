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
        res = {"status": "ok", "database": "unknown"}
        try:
            db = get_db()
            db.command("ping")
            res["database"] = "connected"
        except Exception as e:
            res["database"] = f"connection_failed: {str(e)}"
        return res

    @app.errorhandler(HTTPException)
    def http_err(e):
        return jsonify(error=e.description), e.code

    @app.errorhandler(Exception)
    def any_err(e):
        app.logger.exception(e)
        err_msg = str(e)
        err_type = type(e).__name__
        if "ServerSelectionTimeoutError" in err_type or "timed out" in err_msg.lower():
            return jsonify(error="Erreur de connexion à MongoDB Atlas : Délai d'attente dépassé. Veuillez autoriser 0.0.0.0/0 dans l'onglet 'Network Access' de MongoDB Atlas."), 500
        if "OperationFailure" in err_type or "authentication failed" in err_msg.lower():
            return jsonify(error="Erreur d'authentification MongoDB : Mot de passe ou nom d'utilisateur incorrect dans la variable MONGO_URI sur Render."), 500
        if "ConfigurationError" in err_type or "InvalidURI" in err_type:
            return jsonify(error=f"Format du lien MONGO_URI invalide : {err_msg}"), 500
        return jsonify(error=f"Erreur interne : {err_msg}"), 500

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
