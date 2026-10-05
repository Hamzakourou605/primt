from collections import Counter
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from .models import PrintJob, PrintItem
from .jobs import parse_date
from . import db

bp = Blueprint("stats", __name__)

@bp.get("/stats")
@jwt_required()
def stats():
    uid = int(get_jwt_identity())
    q = db.session.query(PrintItem, PrintJob).join(PrintJob).filter(PrintJob.user_id == uid)
    if (f := parse_date(request.args.get("from"))): q = q.filter(PrintJob.created_at >= f)
    if (t := parse_date(request.args.get("to"), True)): q = q.filter(PrintJob.created_at < t)
    rows = q.all()
    jobs = {j.id: j for _, j in rows}
    status = Counter(i.status for i, _ in rows)
    done = [(i, j) for i, j in rows if i.status == "completed"]
    daily, top = Counter(), Counter()
    for i, j in done:
        daily[j.created_at.date().isoformat()] += i.pages * j.copies
        top[i.name] += 1
    return {
        "total_documents": len(done),
        "total_jobs": len(jobs),
        "pages_printed": sum(i.pages * j.copies for i, j in done),
        "successful": status["completed"],
        "failed": status["failed"],
        "success_rate": round(100 * status["completed"] / max(1, status["completed"] + status["failed"]), 1),
        "status_breakdown": dict(status),
        "pages_per_day": [{"date": d, "pages": p} for d, p in sorted(daily.items())],
        "top_documents": [{"name": n, "count": c} for n, c in top.most_common(5)],
    }
