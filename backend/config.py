import os
from datetime import timedelta

class Config:
    MONGO_URI = os.getenv("MONGO_URI", os.getenv("DATABASE_URL", "mongodb://localhost:27017/printflow"))
    JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"] if os.getenv("RENDER") else os.getenv("JWT_SECRET_KEY", "dev-only")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

class TestConfig(Config):
    TESTING = True
    MONGO_URI = "mongomock://localhost/printflow_test"
    JWT_SECRET_KEY = "test-secret-key-test-secret-key-123"
