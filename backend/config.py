import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    uri = os.getenv("MONGO_URI") or ""
    if not (uri.startswith("mongodb://") or uri.startswith("mongodb+srv://")):
        db_url = os.getenv("DATABASE_URL") or ""
        if db_url.startswith("mongodb://") or db_url.startswith("mongodb+srv://"):
            uri = db_url
        else:
            uri = "mongodb://localhost:27017/printflow"
    MONGO_URI = uri
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or "printflow-secure-jwt-key-2026-production"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

class TestConfig(Config):
    TESTING = True
    MONGO_URI = "mongomock://localhost/printflow_test"
    JWT_SECRET_KEY = "test-secret-key-test-secret-key-123"
