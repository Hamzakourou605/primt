from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from .models import PrintJob, PrintItem
import subprocess
import platform
from . import db

bp = Blueprint("jobs", __name__)
PAPERS = {"A4", "A3", "Letter", "Legal"}
MAX_ITEMS, MAX_COPIES = 500, 99

def uid(): return int(get_jwt_identity())

def own_job(job_id):
    j = db.get_or_404(PrintJob, job_id)
    if j.user_id != uid(): return None
    return j

def parse_date(s, end=False):
    try:
        d = datetime.fromisoformat(s)
        return d + timedelta(days=1) if end and len(s) == 10 else d
    except (TypeError, ValueError): return None

@bp.get("/printers")
@jwt_required()
def list_printers():
    try:
        if platform.system() == "Windows":
            res = subprocess.run(["powershell", "-Command", "Get-Printer | Select-Object -ExpandProperty Name"], capture_output=True, text=True)
            printers = [p.strip() for p in res.stdout.strip().split('\n') if p.strip()]
        else:
            res = subprocess.run(["lpstat", "-p"], capture_output=True, text=True)
            printers = [line.split(' ')[1] for line in res.stdout.split('\n') if line.startswith("printer ")]
        return jsonify({"printers": printers})
    except Exception as e:
        return jsonify({"printers": [], "error": str(e)})

@bp.post("/jobs")
@jwt_required()
def create_job():
    d = request.get_json(silent=True) or {}
    items = d.get("items")
    if not isinstance(items, list) or not items or len(items) > MAX_ITEMS:
        return jsonify(error=f"Entre 1 et {MAX_ITEMS} documents requis"), 400
    printer = (d.get("printer") or "").strip()
    copies = d.get("copies", 1)
    paper = d.get("paper", "A4")
    if not printer or len(printer) > 255: return jsonify(error="Imprimante requise"), 400
    if not isinstance(copies, int) or not 1 <= copies <= MAX_COPIES: return jsonify(error="Copies invalides"), 400
    if paper not in PAPERS: return jsonify(error="Format papier invalide"), 400
    if d.get("orientation", "portrait") not in ("portrait", "landscape"): return jsonify(error="Orientation invalide"), 400
    job = PrintJob(user_id=uid(), printer=printer, copies=copies, paper=paper,
                   orientation=d.get("orientation", "portrait"), color=bool(d.get("color")), duplex=bool(d.get("duplex")))
    seen = set()
    for pos, it in enumerate(items):
        name = str(it.get("name", "")).strip()
        if not name.lower().endswith(".pdf") or "/" in name or "\\" in name:
            return jsonify(error=f"Nom de fichier invalide : {name[:50]}"), 400
        if name in seen: continue  # doublons ignorés
        seen.add(name)
        job.items.append(PrintItem(position=pos, name=name, pages=max(1, int(it.get("pages") or 1)), size=max(0, int(it.get("size") or 0))))
    db.session.add(job); db.session.commit()
    return job.to_dict(), 201

@bp.get("/jobs")
@jwt_required()
def list_jobs():
    q = PrintJob.query.filter_by(user_id=uid())
    if (f := parse_date(request.args.get("from"))): q = q.filter(PrintJob.created_at >= f)
    if (t := parse_date(request.args.get("to"), True)): q = q.filter(PrintJob.created_at < t)
    if (s := request.args.get("q")):
        q = q.filter(PrintJob.items.any(PrintItem.name.ilike(f"%{s}%")))
    jobs = q.order_by(PrintJob.created_at.desc()).all()
    st = request.args.get("status")
    if st: jobs = [j for j in jobs if j.status == st]
    page, per = max(1, request.args.get("page", 1, type=int)), min(100, request.args.get("per_page", 20, type=int))
    return {"total": len(jobs), "page": page, "jobs": [j.to_dict() for j in jobs[(page-1)*per:page*per]]}

@bp.get("/jobs/<int:job_id>")
@jwt_required()
def get_job(job_id):
    j = own_job(job_id)
    return (j.to_dict(), 200) if j else (jsonify(error="Interdit"), 403)

@bp.post("/jobs/<int:job_id>/cancel")
@jwt_required()
def cancel(job_id):
    j = own_job(job_id)
    if not j: return jsonify(error="Interdit"), 403
    for i in j.items:
        if i.status == "queued": i.status = "cancelled"
    db.session.commit(); return j.to_dict()

@bp.post("/jobs/<int:job_id>/retry")
@jwt_required()
def retry(job_id):
    j = own_job(job_id)
    if not j: return jsonify(error="Interdit"), 403
    for i in j.items:
        if i.status == "failed": i.status, i.error = "queued", None
    db.session.commit(); return j.to_dict()

@bp.delete("/jobs/<int:job_id>/items/<int:item_id>")
@jwt_required()
def remove_item(job_id, item_id):
    j = own_job(job_id)
    i = db.get_or_404(PrintItem, item_id)
    if not j or i.job_id != j.id or i.status != "queued": return jsonify(error="Impossible"), 400
    db.session.delete(i); db.session.commit(); return "", 204

# ---- API pour l'agent local (même JWT que l'utilisateur) ----
@bp.get("/agent/next")
@jwt_required()
def agent_next():
    items = (PrintItem.query.join(PrintJob).filter(PrintJob.user_id == uid(), PrintItem.status == "queued")
             .order_by(PrintJob.created_at, PrintItem.position).limit(20).all())
    out = []
    for i in items:
        i.status = "processing"
        out.append({**i.to_dict(), "job": i.job.to_dict(with_items=False)})
    db.session.commit(); return {"items": out}

@bp.post("/agent/items/<int:item_id>/result")
@jwt_required()
def agent_result(item_id):
    i = db.get_or_404(PrintItem, item_id)
    if i.job.user_id != uid(): return jsonify(error="Interdit"), 403
    d = request.get_json(silent=True) or {}
    i.status = "completed" if d.get("ok") else "failed"
    i.error = None if d.get("ok") else str(d.get("error", "Erreur inconnue"))[:500]
    i.finished_at = datetime.utcnow()
    db.session.commit(); return i.to_dict()
