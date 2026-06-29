import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'attendance.db');

let db: sqlite3.Database | null = null;

function getDatabase(): sqlite3.Database {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
      }
    });
  }
  return db;
}

function initializeDatabase() {
  const database = getDatabase();
  
  database.serialize(() => {
    // Create participants table
    database.run(`
      CREATE TABLE IF NOT EXISTS participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        event_id TEXT NOT NULL,
        invite_token TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create attendance table
    database.run(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        participant_id INTEGER NOT NULL,
        event_id TEXT NOT NULL,
        check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (participant_id) REFERENCES participants(id)
      )
    `);

    // Create events table
    database.run(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migrate: add invite_token if missing
    database.run(`ALTER TABLE participants ADD COLUMN invite_token TEXT`, () => {});
    database.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_token ON participants(invite_token)`, () => {});

    // Driver logs table
    database.run(`
      CREATE TABLE IF NOT EXISTS driver_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        driver_name TEXT NOT NULL,
        vehicle_number TEXT NOT NULL,
        branch TEXT NOT NULL,
        clock_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        clock_out_time DATETIME,
        clock_in_lat REAL,
        clock_in_lng REAL,
        clock_out_lat REAL,
        clock_out_lng REAL,
        km_consumed REAL DEFAULT 0,
        status TEXT DEFAULT 'clocked_in',
        notes TEXT
      )
    `);
  });
}

export { getDatabase };
