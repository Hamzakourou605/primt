from collections import Counter
from datetime import datetime, timezone
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
    daily = Counter()
    top = Counter()
    printers_counter = Counter()
    formats_counter = Counter()
    color_count = 0
    bw_count = 0
    duplex_count = 0

    for j in jobs:
        created_at = j.get("created_at")
        if isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at)
            except Exception:
                created_at = datetime.now(timezone.utc)
        elif not isinstance(created_at, datetime):
            created_at = datetime.now(timezone.utc)

        copies = int(j.get("copies", 1))
        printer = (j.get("printer") or "Non spécifiée").strip()
        paper = j.get("paper", "A4")
        formats_counter[paper] += 1
        if j.get("color"): color_count += 1
        else: bw_count += 1
        if j.get("duplex"): duplex_count += 1

        for i in j.get("items", []):
            st = i.get("status", "queued")
            status[st] += 1
            pages = int(i.get("pages", 1)) * copies
            printers_counter[printer] += pages
            if st == "completed":
                done.append((i, j))
                d_key = created_at.date().isoformat()
                daily[d_key] += pages
                top[i.get("name")] += 1

    total_pages = sum(int(i.get("pages", 1)) * int(j.get("copies", 1)) for i, j in done)
    total_docs = len(done)
    success_count = status["completed"]
    failed_count = status["failed"]
    total_finished = success_count + failed_count
    rate = round(100 * success_count / max(1, total_finished), 1) if total_finished > 0 else 100.0

    return {
        "total_documents": total_docs,
        "total_jobs": len(jobs),
        "pages_printed": total_pages,
        "successful": success_count,
        "failed": failed_count,
        "queued": status["queued"],
        "processing": status["processing"],
        "success_rate": rate,
        "status_breakdown": dict(status),
        "pages_per_day": [{"date": d, "pages": p} for d, p in sorted(daily.items())],
        "top_documents": [{"name": n, "count": c} for n, c in top.most_common(5)],
        "printer_breakdown": [{"printer": p, "pages": c} for p, c in printers_counter.most_common(5)],
        "format_breakdown": [{"paper": p, "count": c} for p, c in formats_counter.items()],
        "options_stats": {"color": color_count, "bw": bw_count, "duplex": duplex_count}
    }
