from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from . import db

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    name = db.Column(db.String(120), default="")
    role = db.Column(db.String(20), default="user")  # user | admin
    password_hash = db.Column(db.String(255), nullable=False)

    def set_password(self, pw): self.password_hash = generate_password_hash(pw)
    def check_password(self, pw): return check_password_hash(self.password_hash, pw)
    def to_dict(self): return {"id": self.id, "email": self.email, "name": self.name, "role": self.role}

class PrintJob(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    printer = db.Column(db.String(255), nullable=False)
    copies = db.Column(db.Integer, default=1)
    paper = db.Column(db.String(20), default="A4")
    orientation = db.Column(db.String(20), default="portrait")
    color = db.Column(db.Boolean, default=False)
    duplex = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    items = db.relationship("PrintItem", backref="job", cascade="all, delete-orphan", order_by="PrintItem.position")

    @property
    def status(self):
        s = {i.status for i in self.items}
        if not s: return "queued"
        if s & {"queued", "processing"}: return "processing" if s & {"processing"} or len(s) > 1 else "queued"
        if s == {"cancelled"}: return "cancelled"
        if "failed" in s: return "failed"
        return "completed"

    def to_dict(self, with_items=True):
        d = {"id": self.id, "printer": self.printer, "copies": self.copies, "paper": self.paper,
             "orientation": self.orientation, "color": self.color, "duplex": self.duplex,
             "status": self.status, "created_at": self.created_at.isoformat(),
             "total_pages": sum(i.pages for i in self.items) * self.copies}
        if with_items: d["items"] = [i.to_dict() for i in self.items]
        return d

class PrintItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey("print_job.id"), nullable=False, index=True)
    position = db.Column(db.Integer, default=0)
    name = db.Column(db.String(255), nullable=False, index=True)
    pages = db.Column(db.Integer, default=1)
    size = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default="queued", index=True)  # queued|processing|completed|failed|cancelled
    error = db.Column(db.Text)
    finished_at = db.Column(db.DateTime)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "pages": self.pages, "size": self.size, "status": self.status,
                "error": self.error, "finished_at": self.finished_at.isoformat() if self.finished_at else None}
