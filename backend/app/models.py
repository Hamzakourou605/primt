from datetime import datetime
from bson import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
from .db import get_db, safe_object_id

class User:
    def __init__(self, email, password_hash=None, name="", role="user", _id=None):
        self.email = str(email).strip().lower()
        self.password_hash = password_hash
        self.name = name or ""
        self.role = role or "user"
        if _id:
            self._id = safe_object_id(_id)
            self.id = str(self._id)
        else:
            self._id = ObjectId()
            self.id = str(self._id)

    def set_password(self, pw):
        self.password_hash = generate_password_hash(pw)

    def check_password(self, pw):
        return check_password_hash(self.password_hash, pw)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "role": self.role
        }

    def save(self):
        db = get_db()
        doc = {
            "_id": self._id,
            "email": self.email,
            "name": self.name,
            "role": self.role,
            "password_hash": self.password_hash
        }
        db.users.update_one({"_id": self._id}, {"$set": doc}, upsert=True)
        return self

    @classmethod
    def from_doc(cls, doc):
        if not doc:
            return None
        return cls(
            email=doc.get("email"),
            password_hash=doc.get("password_hash"),
            name=doc.get("name", ""),
            role=doc.get("role", "user"),
            _id=doc.get("_id")
        )

    @classmethod
    def find_by_email(cls, email):
        db = get_db()
        doc = db.users.find_one({"email": str(email).strip().lower()})
        return cls.from_doc(doc)

    @classmethod
    def find_by_id(cls, user_id):
        db = get_db()
        doc = db.users.find_one({"_id": safe_object_id(user_id)})
        return cls.from_doc(doc)


def create_user_doc(email, password, name="", role="user"):
    u = User(email=email, name=name, role=role)
    u.set_password(password)
    u.save()
    return u


def compute_job_status(items):
    s = {i.get("status") for i in items}
    if not s:
        return "queued"
    if s & {"queued", "processing"}:
        return "processing" if (s & {"processing"} or len(s) > 1) else "queued"
    if s == {"cancelled"}:
        return "cancelled"
    if "failed" in s:
        return "failed"
    return "completed"


def job_to_dict(j, with_items=True):
    if not j:
        return None
    created_at = j.get("created_at")
    if isinstance(created_at, datetime):
        created_at_str = created_at.isoformat()
    elif created_at:
        created_at_str = str(created_at)
    else:
        created_at_str = datetime.utcnow().isoformat()

    items = j.get("items", [])
    copies = int(j.get("copies", 1))
    total_pages = sum(int(i.get("pages", 1)) for i in items) * copies

    d = {
        "id": str(j.get("_id")),
        "printer": j.get("printer", ""),
        "copies": copies,
        "paper": j.get("paper", "A4"),
        "orientation": j.get("orientation", "portrait"),
        "color": bool(j.get("color", False)),
        "duplex": bool(j.get("duplex", False)),
        "status": compute_job_status(items),
        "created_at": created_at_str,
        "total_pages": total_pages,
    }
    if with_items:
        formatted_items = []
        for it in items:
            fin = it.get("finished_at")
            if isinstance(fin, datetime):
                fin_str = fin.isoformat()
            else:
                fin_str = str(fin) if fin else None
            formatted_items.append({
                "id": str(it.get("id")),
                "name": it.get("name"),
                "pages": int(it.get("pages", 1)),
                "size": int(it.get("size", 0)),
                "status": it.get("status", "queued"),
                "error": it.get("error"),
                "finished_at": fin_str
            })
        d["items"] = formatted_items
    return d
