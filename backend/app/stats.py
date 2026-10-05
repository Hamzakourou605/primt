from collections import Counter
from datetime import datetime
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from .db import get_db

bp = Blueprint("stats", __name__)

def uid():
    identity = get_jwt_identity()
    return str(identity) if identity else "default-user"

def parse_date(s, end=False):
    from datetime import timedelta
    try:
        d = datetime.fromisoformat(s)
        return d + timedelta(days=1) if end and len(s) == 10 else d
    except (TypeError, ValueError):
        return None

@bp.get("/stats")
@jwt_required(optional=True)
def stats():
    db = get_db()
    current_uid = uid()
    query = {"$or": [{"user_id": current_uid}, {"user_id": "default-user"}]} if current_uid != "default-user" else {}
    if f := parse_date(request.args.get("from")):
        query.setdefault("created_at", {})["$gte"] = f
    if t := parse_date(request.args.get("to"), True):
        query.setdefault("created_at", {})["$lt"] = t

    jobs = list(db.jobs.find(query))
    status = Counter()
    done = []
    daily, top = Counter(), Counter()

    for j in jobs:
        created_at = j.get("created_at")
        if isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at)
            except Exception:
                created_at = datetime.utcnow()
        copies = int(j.get("copies", 1))
        for i in j.get("items", []):
            st = i.get("status", "queued")
            status[st] += 1
            if st == "completed":
                done.append((i, j))
                d_key = created_at.date().isoformat()
                pages = int(i.get("pages", 1))
                daily[d_key] += pages * copies
                top[i.get("name")] += 1

    return {
        "total_documents": len(done),
        "total_jobs": len(jobs),
        "pages_printed": sum(int(i.get("pages", 1)) * int(j.get("copies", 1)) for i, j in done),
        "successful": status["completed"],
        "failed": status["failed"],
        "success_rate": round(100 * status["completed"] / max(1, status["completed"] + status["failed"]), 1),
        "status_breakdown": dict(status),
        "pages_per_day": [{"date": d, "pages": p} for d, p in sorted(daily.items())],
        "top_documents": [{"name": n, "count": c} for n, c in top.most_common(5)],
    }
