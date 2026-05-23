import csv
import io
import os
import sqlite3
import uuid
from datetime import datetime

from flask import Flask, g, jsonify, request, send_from_directory

app = Flask(__name__, static_folder="public", static_url_path="")

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "attendance.db")


# ── Database ─────────────────────────────────────────────────────────────────

def get_db():
    if "db" not in g:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        g.db = conn
    return g.db


@app.teardown_appcontext
def close_db(_):
    db = g.pop("db", None)
    if db:
        db.close()


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS events (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            description TEXT,
            event_date  TEXT,
            created_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS participants (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id    INTEGER NOT NULL,
            name        TEXT NOT NULL,
            email       TEXT,
            department  TEXT,
            token       TEXT UNIQUE NOT NULL,
            attended    INTEGER DEFAULT 0,
            attended_at TEXT,
            FOREIGN KEY (event_id) REFERENCES events(id)
        );
    """)
    conn.commit()
    conn.close()


# ── Events ────────────────────────────────────────────────────────────────────

@app.get("/api/events")
def list_events():
    rows = get_db().execute("""
        SELECT e.*,
               COUNT(p.id)    AS total,
               SUM(p.attended) AS attended
        FROM events e
        LEFT JOIN participants p ON p.event_id = e.id
        GROUP BY e.id
        ORDER BY e.created_at DESC
    """).fetchall()
    return jsonify([dict(r) for r in rows])


@app.post("/api/events")
def create_event():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify(error="Event name is required"), 400

    db = get_db()
    cur = db.execute(
        "INSERT INTO events (name, description, event_date) VALUES (?, ?, ?)",
        (name, data.get("description") or None, data.get("event_date") or None),
    )
    db.commit()
    return jsonify(id=cur.lastrowid, name=name,
                   description=data.get("description"),
                   event_date=data.get("event_date"))


@app.delete("/api/events/<int:event_id>")
def delete_event(event_id):
    db = get_db()
    db.execute("DELETE FROM participants WHERE event_id = ?", (event_id,))
    db.execute("DELETE FROM events WHERE id = ?", (event_id,))
    db.commit()
    return jsonify(ok=True)


# ── Participants ──────────────────────────────────────────────────────────────

@app.get("/api/events/<int:event_id>/participants")
def list_participants(event_id):
    rows = get_db().execute(
        "SELECT * FROM participants WHERE event_id = ? ORDER BY name",
        (event_id,)
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.post("/api/events/<int:event_id>/import")
def import_csv(event_id):
    db = get_db()
    event = db.execute("SELECT id FROM events WHERE id = ?", (event_id,)).fetchone()
    if not event:
        return jsonify(error="Event not found"), 404

    if "csv" not in request.files:
        return jsonify(error="No file uploaded"), 400

    file = request.files["csv"]
    text = file.read().decode("utf-8-sig")  # strip BOM if present
    reader = csv.reader(io.StringIO(text))

    rows = [r for r in reader if any(c.strip() for c in r)]
    if not rows:
        return jsonify(error="Empty file"), 400

    # Skip header row if first cell looks like a column name
    start = 1 if rows[0][0].strip().lower() in ("name", "full name", "fullname") else 0

    count = 0
    for row in rows[start:]:
        name = row[0].strip() if len(row) > 0 else ""
        email = row[1].strip() if len(row) > 1 else None
        department = row[2].strip() if len(row) > 2 else None
        if not name:
            continue
        db.execute(
            "INSERT INTO participants (event_id, name, email, department, token) VALUES (?, ?, ?, ?, ?)",
            (event_id, name, email or None, department or None, str(uuid.uuid4())),
        )
        count += 1

    db.commit()
    return jsonify(imported=count)


@app.delete("/api/events/<int:event_id>/participants")
def clear_participants(event_id):
    db = get_db()
    db.execute("DELETE FROM participants WHERE event_id = ?", (event_id,))
    db.commit()
    return jsonify(ok=True)


# ── Attendance ────────────────────────────────────────────────────────────────

@app.get("/api/attend/<token>")
def get_attend(token):
    row = get_db().execute("""
        SELECT p.*, e.name AS event_name, e.event_date, e.description AS event_description
        FROM participants p
        JOIN events e ON e.id = p.event_id
        WHERE p.token = ?
    """, (token,)).fetchone()
    if not row:
        return jsonify(error="Invalid or expired link"), 404
    return jsonify(dict(row))


@app.post("/api/attend/<token>")
def mark_attend(token):
    db = get_db()
    row = db.execute("SELECT * FROM participants WHERE token = ?", (token,)).fetchone()
    if not row:
        return jsonify(error="Invalid link"), 404

    already = bool(row["attended"])
    if not already:
        db.execute(
            "UPDATE participants SET attended = 1, attended_at = ? WHERE token = ?",
            (datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"), token),
        )
        db.commit()
    return jsonify(ok=True, already=already)


# ── Static routes ─────────────────────────────────────────────────────────────

@app.get("/")
def index():
    return send_from_directory("public", "index.html")


@app.get("/attend/<token>")
def attend_page(token):
    return send_from_directory("public", "attend.html")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 3000))
    print(f"Attendance system running at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
