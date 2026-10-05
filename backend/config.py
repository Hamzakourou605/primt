import os
from datetime import timedelta

class Config:
    uri = os.getenv("DATABASE_URL", "sqlite:///printflow.db")
    SQLALCHEMY_DATABASE_URI = uri.replace("postgres://", "postgresql://", 1)
    JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"] if os.getenv("RENDER") else os.getenv("JWT_SECRET_KEY", "dev-only")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    JWT_SECRET_KEY = "test-secret-key-test-secret-key-123"
