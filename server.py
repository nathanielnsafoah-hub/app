import csv
import io
import json as json_lib
import os
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, date

import psycopg2
import psycopg2.extras
from flask import Flask, Response, g, jsonify, request, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")

app = Flask(__name__, static_folder=PUBLIC_DIR, static_url_path="")

DATABASE_URL = os.environ.get("DATABASE_URL", "")


# ── Run column migrations at module load (works on Vercel serverless) ─────────
def _apply_migrations():
    if not DATABASE_URL:
        return
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("ALTER TABLE driver_clockings ADD COLUMN IF NOT EXISTS vehicle_number TEXT")
        cur.execute("ALTER TABLE driver_clockings ADD COLUMN IF NOT EXISTS km_consumed REAL DEFAULT 0")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[migration] {e}")

_apply_migrations()


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
        CREATE TABLE IF NOT EXISTS admin_config (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS admin_accounts (
            id         SERIAL PRIMARY KEY,
            name       TEXT UNIQUE NOT NULL,
            password   TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS driver_pins (
            driver_name TEXT PRIMARY KEY,
            pin         TEXT NOT NULL,
            is_default  BOOLEAN DEFAULT TRUE
        );

        CREATE TABLE IF NOT EXISTS driver_clockings (
            id          SERIAL PRIMARY KEY,
            driver_name TEXT NOT NULL,
            event_type  TEXT NOT NULL,
            clocked_at  TIMESTAMP DEFAULT NOW(),
            latitude    REAL,
            longitude   REAL,
            accuracy    REAL,
            destination TEXT
        );
        ALTER TABLE driver_clockings ADD COLUMN IF NOT EXISTS destination TEXT;
        ALTER TABLE driver_clockings ADD COLUMN IF NOT EXISTS branch TEXT;
        ALTER TABLE driver_clockings ADD COLUMN IF NOT EXISTS gps_address TEXT;
        ALTER TABLE driver_clockings ADD COLUMN IF NOT EXISTS vehicle_number TEXT;
        ALTER TABLE driver_clockings ADD COLUMN IF NOT EXISTS km_consumed REAL DEFAULT 0;

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


# ── Driver clock-in ───────────────────────────────────────────────────────────

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Amenfiman2024")
DRIVER_PIN     = os.environ.get("DRIVER_PIN", "1234")


@app.post("/api/driver/verify")
def driver_verify():
    data = request.get_json() or {}
    name = (data.get("driver_name") or "").strip()
    pin  = (data.get("pin") or "").strip()
    if not name or not pin:
        return jsonify(error="Name and PIN required"), 400

    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT pin, is_default FROM driver_pins WHERE driver_name = %s", (name,))
    row = cur.fetchone()

    if row:
        if row["pin"] != pin:
            return jsonify(error="Incorrect PIN"), 401
        return jsonify(ok=True, mustChangePin=bool(row["is_default"]))
    else:
        if pin != DRIVER_PIN:
            return jsonify(error="Incorrect PIN"), 401
        return jsonify(ok=True, mustChangePin=True)


@app.post("/api/driver/set-pin")
def driver_set_pin():
    data    = request.get_json() or {}
    name    = (data.get("driver_name") or "").strip()
    new_pin = (data.get("new_pin") or "").strip()
    if not name or len(new_pin) != 4 or not new_pin.isdigit():
        return jsonify(error="Invalid data"), 400

    db = get_db()
    cur = db.cursor()
    cur.execute("""
        INSERT INTO driver_pins (driver_name, pin, is_default)
        VALUES (%s, %s, FALSE)
        ON CONFLICT (driver_name) DO UPDATE SET pin = EXCLUDED.pin, is_default = FALSE
    """, (name, new_pin))
    db.commit()
    return jsonify(ok=True)


@app.post("/api/driver/reset-pin")
def driver_reset_pin():
    data  = request.get_json() or {}
    name  = (data.get("driver_name") or "").strip()
    admin = (data.get("admin_password") or "").strip()
    if admin != ADMIN_PASSWORD:
        return jsonify(error="Incorrect admin password"), 401
    if not name:
        return jsonify(error="Driver name required"), 400

    db = get_db()
    cur = db.cursor()
    cur.execute("DELETE FROM driver_pins WHERE driver_name = %s", (name,))
    db.commit()
    return jsonify(ok=True)


@app.post("/api/admin/login")
def admin_login():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    pw   = (data.get("password") or "").strip()
    if not name or not pw:
        return jsonify(error="Name and password required"), 400

    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT password FROM admin_accounts WHERE LOWER(name) = LOWER(%s)", (name,))
    row = cur.fetchone()
    if not row:
        return jsonify(notFound=True), 404
    if row["password"] != pw:
        return jsonify(error="Incorrect password"), 401
    return jsonify(ok=True, name=name)


@app.post("/api/admin/register")
def admin_register():
    data       = request.get_json() or {}
    name       = (data.get("name") or "").strip()
    pw         = (data.get("password") or "").strip()
    master_key = (data.get("master_key") or "").strip()
    if not name or len(pw) < 6:
        return jsonify(error="Name required and password must be at least 6 characters"), 400
    if master_key != ADMIN_PASSWORD:
        return jsonify(error="Incorrect master key"), 401

    db = get_db()
    cur = db.cursor()
    try:
        cur.execute("INSERT INTO admin_accounts (name, password) VALUES (%s, %s)", (name, pw))
        db.commit()
    except Exception:
        db.rollback()
        return jsonify(error="An account with that name already exists"), 409
    return jsonify(ok=True)


@app.post("/api/admin/reset-password")
def admin_reset_password():
    data   = request.get_json() or {}
    name   = (data.get("name") or "").strip()
    key    = (data.get("master_key") or "").strip()
    new_pw = (data.get("new_password") or "").strip()
    if key != ADMIN_PASSWORD:
        return jsonify(error="Incorrect master key"), 401
    if not name or len(new_pw) < 6:
        return jsonify(error="Name and new password required"), 400

    db = get_db()
    cur = db.cursor()
    cur.execute("UPDATE admin_accounts SET password = %s WHERE LOWER(name) = LOWER(%s)", (new_pw, name))
    if cur.rowcount == 0:
        return jsonify(error="No account found with that name"), 404
    db.commit()
    return jsonify(ok=True)


@app.get("/api/geocode")
def geocode():
    lat = request.args.get("lat", "").strip()
    lon = request.args.get("lon", "").strip()
    if not lat or not lon:
        return jsonify(error="lat and lon required"), 400
    try:
        params = urllib.parse.urlencode({"lat": lat, "lon": lon, "format": "json"})
        url = f"https://nominatim.openstreetmap.org/reverse?{params}"
        req = urllib.request.Request(url, headers={
            "User-Agent": "Amenfiman-DriveTrack/1.0 (nathanielnsafoah@gmail.com)"
        })
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json_lib.loads(resp.read().decode())
        a = data.get("address", {})
        parts = [
            a.get("road") or a.get("pedestrian") or a.get("footway") or a.get("hamlet"),
            a.get("suburb") or a.get("neighbourhood"),
            a.get("city") or a.get("town") or a.get("village") or a.get("county"),
            a.get("state"),
        ]
        address = ", ".join(p for p in parts if p) or data.get("display_name", f"{lat}, {lon}")
        return jsonify(address=address)
    except Exception:
        return jsonify(address=f"{lat}, {lon}")


VALID_EVENT_TYPES = {"clock_in", "clock_out", "lodgment_departure", "lodgment_return"}


@app.post("/api/driver/clock")
def driver_clock():
    data = request.get_json() or {}
    driver_name = (data.get("driver_name") or "").strip()
    event_type  = (data.get("event_type")  or "").strip()

    if not driver_name:
        return jsonify(error="Driver name is required"), 400
    if event_type not in VALID_EVENT_TYPES:
        return jsonify(error="Invalid event type"), 400

    destination    = (data.get("destination")    or "").strip() or None
    branch         = (data.get("branch")         or "").strip() or None
    gps_address    = (data.get("gps_address")    or "").strip() or None
    vehicle_number = (data.get("vehicle_number") or "").strip() or None
    km_consumed    = data.get("km_consumed") or 0

    db = get_db()
    cur = db.cursor()
    cur.execute(
        """INSERT INTO driver_clockings
             (driver_name, event_type, latitude, longitude, accuracy,
              destination, branch, gps_address, vehicle_number, km_consumed)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id, clocked_at""",
        (driver_name, event_type,
         data.get("latitude"), data.get("longitude"), data.get("accuracy"),
         destination, branch, gps_address, vehicle_number, km_consumed),
    )
    row = cur.fetchone()
    db.commit()
    return jsonify(id=row["id"], clocked_at=row["clocked_at"].isoformat())


@app.get("/api/driver/today")
def driver_today():
    driver_name = request.args.get("driver_name", "").strip()
    date        = request.args.get("date")          # YYYY-MM-DD (client local date)
    cur = get_db().cursor()
    if date:
        cur.execute(
            "SELECT * FROM driver_clockings WHERE driver_name = %s AND DATE(clocked_at) = %s ORDER BY clocked_at DESC",
            (driver_name, date),
        )
    else:
        cur.execute(
            "SELECT * FROM driver_clockings WHERE driver_name = %s AND DATE(clocked_at) = CURRENT_DATE ORDER BY clocked_at DESC",
            (driver_name,),
        )
    return jsonify([row_to_dict(r) for r in cur.fetchall()])


@app.get("/api/admin/driver-clockings")
def admin_driver_clockings():
    date_filter   = request.args.get("date",   "").strip()
    driver_filter = request.args.get("driver", "").strip()
    branch_filter = request.args.get("branch", "").strip()
    cur = get_db().cursor()
    q, params = "SELECT * FROM driver_clockings WHERE 1=1", []
    if date_filter:
        q += " AND DATE(clocked_at) = %s";  params.append(date_filter)
    if driver_filter:
        q += " AND driver_name ILIKE %s";   params.append(f"%{driver_filter}%")
    if branch_filter:
        q += " AND branch ILIKE %s";        params.append(f"%{branch_filter}%")
    q += " ORDER BY clocked_at DESC LIMIT 500"
    cur.execute(q, params)
    return jsonify([row_to_dict(r) for r in cur.fetchall()])


@app.delete("/api/driver/clockings/<int:clocking_id>")
def delete_driver_clocking(clocking_id):
    db = get_db()
    db.cursor().execute("DELETE FROM driver_clockings WHERE id = %s", (clocking_id,))
    db.commit()
    return jsonify(ok=True)


@app.get("/api/admin/driver-clockings/export")
def export_driver_clockings():
    date_filter   = request.args.get("date",   "").strip()
    branch_filter = request.args.get("branch", "").strip()
    cur = get_db().cursor()
    q, params = (
        "SELECT driver_name, branch, event_type, clocked_at, destination, latitude, longitude, accuracy "
        "FROM driver_clockings WHERE 1=1",
        [],
    )
    if date_filter:
        q += " AND DATE(clocked_at) = %s"; params.append(date_filter)
    if branch_filter:
        q += " AND branch ILIKE %s";       params.append(f"%{branch_filter}%")
    q += " ORDER BY branch, driver_name, clocked_at"
    cur.execute(q, params)
    rows = cur.fetchall()

    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["Driver Name", "Branch", "Event", "Time", "Destination", "GPS Address", "Latitude", "Longitude", "Accuracy (m)"])
    for r in rows:
        w.writerow([
            r["driver_name"], r.get("branch") or "", r["event_type"], r["clocked_at"],
            r["destination"] or "", r.get("gps_address") or "",
            r["latitude"] or "", r["longitude"] or "", r["accuracy"] or "",
        ])
    return Response(
        out.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=driver-clockings.csv"},
    )


# ── Static routes ─────────────────────────────────────────────────────────────

@app.get("/")
def index():
    return send_from_directory(PUBLIC_DIR, "index.html")


@app.get("/attend/<token>")
def attend_page(token):
    return send_from_directory(PUBLIC_DIR, "attend.html")


@app.get("/driver")
def driver_app():
    return send_from_directory(PUBLIC_DIR, "driver.html")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 3000))
    print(f"Attendance system running at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
