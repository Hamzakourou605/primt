import pytest
from app import create_app, db
from app.models import User
from config import TestConfig

@pytest.fixture
def client():
    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        u = User(email="a@b.com"); u.set_password("secret123"); db.session.add(u); db.session.commit()
        yield app.test_client()

def auth(c):
    t = c.post("/api/auth/login", json={"email": "a@b.com", "password": "secret123"}).json["token"]
    return {"Authorization": f"Bearer {t}"}

JOB = {"printer": "HP", "copies": 2, "items": [{"name": "a.pdf", "pages": 3}, {"name": "b.pdf", "pages": 1}]}

def test_health(client): assert client.get("/health").json["status"] == "ok"

def test_login_errors(client):
    assert client.post("/api/auth/login", json={"email": "bad", "password": "x"}).status_code == 400
    assert client.post("/api/auth/login", json={"email": "a@b.com", "password": "no"}).status_code == 401

def test_private_routes(client):
    assert client.get("/api/stats").status_code == 401

def test_job_validation(client):
    h = auth(client)
    assert client.post("/api/jobs", json={**JOB, "items": [{"name": "../x.exe"}]}, headers=h).status_code == 400
    assert client.post("/api/jobs", json={**JOB, "copies": 0}, headers=h).status_code == 400

def test_job_flow_and_stats(client):
    h = auth(client)
    job = client.post("/api/jobs", json=JOB, headers=h).json
    assert job["total_pages"] == 8
    items = client.get("/api/agent/next", headers=h).json["items"]
    assert len(items) == 2
    client.post(f"/api/agent/items/{items[0]['id']}/result", json={"ok": True}, headers=h)
    client.post(f"/api/agent/items/{items[1]['id']}/result", json={"ok": False, "error": "offline"}, headers=h)
    s = client.get("/api/stats", headers=h).json
    assert (s["successful"], s["failed"], s["pages_printed"]) == (1, 1, 6)
    assert client.post(f"/api/jobs/{job['id']}/retry", headers=h).json["items"][1]["status"] == "queued"
