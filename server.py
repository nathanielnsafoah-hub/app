import csv
import io
import os
import uuid
from datetime import datetime, date

import psycopg2
import psycopg2.extras
from flask import Flask, g, jsonify, request, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")

app = Flask(__name__, static_folder=PUBLIC_DIR, static_url_path="")

DATABASE_URL = os.environ.get("DATABASE_URL", "")


# ── Database ──────────────────────────────────────────────────────────────────

def get_db():
    if "db" not in g:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
        g.db = conn
    return g.db


@app.teardown_appcontext
def close_db(_):
    db = g.pop("db", None)
    if db:
        try:
            db.close()
        except Exception:
            pass


def row_to_dict(row):
    if row is None:
        return None
    result = dict(row)
    for k, v in result.items():
        if isinstance(v, (datetime, date)):
            result[k] = v.isoformat()
    return result


def init_db():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id          SERIAL PRIMARY KEY,
            name        TEXT NOT NULL,
            description TEXT,
            event_date  TEXT,
            created_at  TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS participants (
            id          SERIAL PRIMARY KEY,
            event_id    INTEGER NOT NULL REFERENCES events(id),
            name        TEXT NOT NULL,
            email       TEXT,
            department  TEXT,
            token       TEXT UNIQUE NOT NULL,
            attended    SMALLINT DEFAULT 0,
            attended_at TIMESTAMP
        );
    """)
    conn.commit()
    cur.close()
    conn.close()


# ── Events ────────────────────────────────────────────────────────────────────

@app.get("/api/events")
def list_events():
    cur = get_db().cursor()
    cur.execute("""
        SELECT e.*,
               COUNT(p.id)              AS total,
               COALESCE(SUM(p.attended), 0) AS attended
        FROM events e
        LEFT JOIN participants p ON p.event_id = e.id
        GROUP BY e.id
        ORDER BY e.created_at DESC
    """)
    return jsonify([row_to_dict(r) for r in cur.fetchall()])


@app.post("/api/events")
def create_event():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify(error="Event name is required"), 400

    db = get_db()
    cur = db.cursor()
    cur.execute(
        "INSERT INTO events (name, description, event_date) VALUES (%s, %s, %s) RETURNING id",
        (name, data.get("description") or None, data.get("event_date") or None),
    )
    db.commit()
    new_id = cur.fetchone()["id"]
    return jsonify(id=new_id, name=name,
                   description=data.get("description"),
                   event_date=data.get("event_date"))


@app.delete("/api/events/<int:event_id>")
def delete_event(event_id):
    db = get_db()
    db.cursor().execute("DELETE FROM participants WHERE event_id = %s", (event_id,))
    db.cursor().execute("DELETE FROM events WHERE id = %s", (event_id,))
    db.commit()
    return jsonify(ok=True)


# ── Participants ──────────────────────────────────────────────────────────────

@app.get("/api/events/<int:event_id>/participants")
def list_participants(event_id):
    cur = get_db().cursor()
    cur.execute(
        "SELECT * FROM participants WHERE event_id = %s ORDER BY name",
        (event_id,)
    )
    return jsonify([row_to_dict(r) for r in cur.fetchall()])


@app.post("/api/events/<int:event_id>/import")
def import_csv(event_id):
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT id FROM events WHERE id = %s", (event_id,))
    if not cur.fetchone():
        return jsonify(error="Event not found"), 404

    if "csv" not in request.files:
        return jsonify(error="No file uploaded"), 400

    text = request.files["csv"].read().decode("utf-8-sig")
    reader = csv.reader(io.StringIO(text))
    rows = [r for r in reader if any(c.strip() for c in r)]
    if not rows:
        return jsonify(error="Empty file"), 400

    start = 1 if rows[0][0].strip().lower() in ("name", "full name", "fullname") else 0

    count = 0
    for row in rows[start:]:
        name = row[0].strip() if len(row) > 0 else ""
        email = row[1].strip() if len(row) > 1 else None
        department = row[2].strip() if len(row) > 2 else None
        if not name:
            continue
        cur.execute(
            "INSERT INTO participants (event_id, name, email, department, token) VALUES (%s, %s, %s, %s, %s)",
            (event_id, name, email or None, department or None, str(uuid.uuid4())),
        )
        count += 1

    db.commit()
    return jsonify(imported=count)


@app.delete("/api/events/<int:event_id>/participants")
def clear_participants(event_id):
    db = get_db()
    db.cursor().execute("DELETE FROM participants WHERE event_id = %s", (event_id,))
    db.commit()
    return jsonify(ok=True)


# ── Attendance ────────────────────────────────────────────────────────────────

@app.get("/api/attend/<token>")
def get_attend(token):
    cur = get_db().cursor()
    cur.execute("""
        SELECT p.*, e.name AS event_name, e.event_date, e.description AS event_description
        FROM participants p
        JOIN events e ON e.id = p.event_id
        WHERE p.token = %s
    """, (token,))
    row = cur.fetchone()
    if not row:
        return jsonify(error="Invalid or expired link"), 404
    return jsonify(row_to_dict(row))


@app.post("/api/attend/<token>")
def mark_attend(token):
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT attended FROM participants WHERE token = %s", (token,))
    row = cur.fetchone()
    if not row:
        return jsonify(error="Invalid link"), 404

    already = bool(row["attended"])
    if not already:
        cur.execute(
            "UPDATE participants SET attended = 1, attended_at = NOW() WHERE token = %s",
            (token,),
        )
        db.commit()
    return jsonify(ok=True, already=already)


# ── Static routes ─────────────────────────────────────────────────────────────

@app.get("/")
def index():
    return send_from_directory(PUBLIC_DIR, "index.html")


@app.get("/attend/<token>")
def attend_page(token):
    return send_from_directory(PUBLIC_DIR, "attend.html")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 3000))
    print(f"Attendance system running at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
