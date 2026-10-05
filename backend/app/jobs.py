from datetime import datetime, timedelta, timezone
import re
import subprocess
import platform
from bson import ObjectId
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from .db import get_db, safe_object_id
from .models import job_to_dict

bp = Blueprint("jobs", __name__)
PAPERS = {"A4", "A3", "Letter", "Legal"}
MAX_ITEMS, MAX_COPIES = 500, 99

def uid():
    return str(get_jwt_identity())

def own_job(job_id):
    db = get_db()
    oid = safe_object_id(job_id)
    j = db.jobs.find_one({"$or": [{"_id": oid}, {"_id": str(job_id)}]})
    if not j or str(j.get("user_id")) != uid():
        return None
    return j

def parse_date(s, end=False):
    try:
        d = datetime.fromisoformat(s)
        return d + timedelta(days=1) if end and len(s) == 10 else d
    except (TypeError, ValueError):
        return None

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
    db = get_db()
    d = request.get_json(silent=True) or {}
    items = d.get("items")
    if not isinstance(items, list) or not items or len(items) > MAX_ITEMS:
        return jsonify(error=f"Entre 1 et {MAX_ITEMS} documents requis"), 400
    printer = (d.get("printer") or "").strip()
    copies = d.get("copies", 1)
    paper = d.get("paper", "A4")
    if not printer or len(printer) > 255:
        return jsonify(error="Imprimante requise"), 400
    if not isinstance(copies, int) or not 1 <= copies <= MAX_COPIES:
        return jsonify(error="Copies invalides"), 400
    if paper not in PAPERS:
        return jsonify(error="Format papier invalide"), 400
    if d.get("orientation", "portrait") not in ("portrait", "landscape"):
        return jsonify(error="Orientation invalide"), 400

    items_list = []
    seen = set()
    for pos, it in enumerate(items):
        name = str(it.get("name", "")).strip()
        if not name.lower().endswith(".pdf") or "/" in name or "\\" in name:
            return jsonify(error=f"Nom de fichier invalide : {name[:50]}"), 400
        if name in seen:
            continue
        seen.add(name)
        items_list.append({
            "id": str(ObjectId()),
            "position": pos,
            "name": name,
            "pages": max(1, int(it.get("pages") or 1)),
            "size": max(0, int(it.get("size") or 0)),
            "status": "queued",
            "error": None,
            "finished_at": None
        })

    job_doc = {
        "_id": ObjectId(),
        "user_id": uid(),
        "printer": printer,
        "copies": copies,
        "paper": paper,
        "orientation": d.get("orientation", "portrait"),
        "color": bool(d.get("color")),
        "duplex": bool(d.get("duplex")),
        "created_at": datetime.now(timezone.utc),
        "items": items_list
    }
    db.jobs.insert_one(job_doc)
    return job_to_dict(job_doc), 201

@bp.get("/jobs")
@jwt_required()
def list_jobs():
    db = get_db()
    query = {"user_id": uid()}
    if f := parse_date(request.args.get("from")):
        query.setdefault("created_at", {})["$gte"] = f
    if t := parse_date(request.args.get("to"), True):
        query.setdefault("created_at", {})["$lt"] = t
    if s := request.args.get("q"):
        query["items.name"] = {"$regex": re.escape(s), "$options": "i"}

    cursor = db.jobs.find(query).sort("created_at", -1)
    jobs = [job_to_dict(j) for j in cursor]
    st = request.args.get("status")
    if st:
        jobs = [j for j in jobs if j["status"] == st]
    page = max(1, request.args.get("page", 1, type=int))
    per = min(100, request.args.get("per_page", 20, type=int))
    return {
        "total": len(jobs),
        "page": page,
        "jobs": jobs[(page - 1) * per:page * per]
    }

@bp.get("/jobs/<job_id>")
@jwt_required()
def get_job(job_id):
    j = own_job(job_id)
    return (job_to_dict(j), 200) if j else (jsonify(error="Interdit"), 403)

@bp.post("/jobs/<job_id>/cancel")
@jwt_required()
def cancel(job_id):
    j = own_job(job_id)
    if not j:
        return jsonify(error="Interdit"), 403
    db = get_db()
    for i in j.get("items", []):
        if i.get("status") == "queued":
            i["status"] = "cancelled"
    db.jobs.update_one({"_id": j["_id"]}, {"$set": {"items": j["items"]}})
    return job_to_dict(j)

@bp.post("/jobs/<job_id>/retry")
@jwt_required()
def retry(job_id):
    j = own_job(job_id)
    if not j:
        return jsonify(error="Interdit"), 403
    db = get_db()
    for i in j.get("items", []):
        if i.get("status") == "failed":
            i["status"] = "queued"
            i["error"] = None
    db.jobs.update_one({"_id": j["_id"]}, {"$set": {"items": j["items"]}})
    return job_to_dict(j)

@bp.delete("/jobs/<job_id>/items/<item_id>")
@jwt_required()
def remove_item(job_id, item_id):
    j = own_job(job_id)
    if not j:
        return jsonify(error="Impossible"), 400
    db = get_db()
    item = next((i for i in j.get("items", []) if str(i.get("id")) == str(item_id)), None)
    if not item or item.get("status") != "queued":
        return jsonify(error="Impossible"), 400
    j["items"] = [i for i in j.get("items", []) if str(i.get("id")) != str(item_id)]
    db.jobs.update_one({"_id": j["_id"]}, {"$set": {"items": j["items"]}})
    return "", 204

@bp.get("/agent/next")
@jwt_required()
def agent_next():
    db = get_db()
    user_id = uid()
    cursor = db.jobs.find({"user_id": user_id, "items.status": "queued"}).sort("created_at", 1)
    out = []
    for job in cursor:
        updated = False
        for item in job.get("items", []):
            if item.get("status") == "queued":
                item["status"] = "processing"
                updated = True
                fin = item.get("finished_at")
                fin_str = fin.isoformat() if isinstance(fin, datetime) else (str(fin) if fin else None)
                out.append({
                    "id": str(item.get("id")),
                    "name": item.get("name"),
                    "pages": int(item.get("pages", 1)),
                    "size": int(item.get("size", 0)),
                    "status": "processing",
                    "error": item.get("error"),
                    "finished_at": fin_str,
                    "job": job_to_dict(job, with_items=False)
                })
                if len(out) >= 20:
                    break
        if updated:
            db.jobs.update_one({"_id": job["_id"]}, {"$set": {"items": job["items"]}})
        if len(out) >= 20:
            break
    return {"items": out}

@bp.post("/agent/items/<item_id>/result")
@jwt_required()
def agent_result(item_id):
    db = get_db()
    user_id = uid()
    job = db.jobs.find_one({"user_id": user_id, "items.id": str(item_id)})
    if not job:
        return jsonify(error="Interdit"), 403
    d = request.get_json(silent=True) or {}
    ok = bool(d.get("ok"))
    status = "completed" if ok else "failed"
    err = None if ok else str(d.get("error", "Erreur inconnue"))[:500]
    finished_at = datetime.now(timezone.utc)

    target_item = None
    for it in job.get("items", []):
        if str(it.get("id")) == str(item_id):
            it["status"] = status
            it["error"] = err
            it["finished_at"] = finished_at
            target_item = it
            break

    db.jobs.update_one({"_id": job["_id"]}, {"$set": {"items": job["items"]}})
    fin = target_item.get("finished_at")
    fin_str = fin.isoformat() if isinstance(fin, datetime) else (str(fin) if fin else None)
    return {
        "id": str(target_item.get("id")),
        "name": target_item.get("name"),
        "pages": int(target_item.get("pages", 1)),
        "size": int(target_item.get("size", 0)),
        "status": target_item.get("status"),
        "error": target_item.get("error"),
        "finished_at": fin_str
    }
