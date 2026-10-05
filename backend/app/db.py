from pymongo import MongoClient
import mongomock
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

_db = None
_client = None
_db_status = "uninitialized"
_db_error = None

def init_db(app):
    global _db, _client, _db_status, _db_error
    if app.config.get("TESTING"):
        _client = mongomock.MongoClient()
        _db = _client.get_database("printflow_test")
        _db_status = "testing_mock"
    else:
        uri = app.config.get("MONGO_URI", "mongodb://localhost:27017/printflow")
        if not (uri.startswith("mongodb://") or uri.startswith("mongodb+srv://")):
            uri = "mongodb://localhost:27017/printflow"
        try:
            _client = MongoClient(uri, serverSelectionTimeoutMS=5000)
            # Verify authentication and connectivity with a ping
            _client.admin.command("ping")
            try:
                _db = _client.get_default_database()
            except Exception:
                _db = _client["printflow"]
            _db_status = "connected"
            _db_error = None
            logger.info("Successfully authenticated and connected to MongoDB!")
        except Exception as e:
            _db_status = "fallback_mock"
            _db_error = str(e)
            logger.warning("Could not connect to MongoDB Atlas (%s). Falling back to mock DB so the app stays functional.", e)
            _client = mongomock.MongoClient()
            _db = _client.get_database("printflow")

    # Ensure indexes and seed default admin user
    try:
        _db.users.create_index("email", unique=True)
        _db.jobs.create_index("user_id")
        _db.jobs.create_index("created_at")

        if not app.config.get("TESTING") and _db.users.count_documents({}) == 0:
            from werkzeug.security import generate_password_hash
            _db.users.insert_one({
                "_id": ObjectId(),
                "email": "admin@printflow.com",
                "name": "Administrateur",
                "role": "admin",
                "password_hash": generate_password_hash("admin123")
            })
    except Exception as e:
        logger.warning("MongoDB indexing/seeding notice: %s", e)

    return _db

def get_db():
    global _db
    return _db

def get_db_info():
    global _db_status, _db_error
    return {"status": _db_status, "error": _db_error}

def safe_object_id(val):
    if isinstance(val, ObjectId):
        return val
    try:
        return ObjectId(str(val))
    except Exception:
        return str(val)
