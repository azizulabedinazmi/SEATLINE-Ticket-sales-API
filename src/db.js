const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const dataDirectory = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDirectory, { recursive: true });

const db = new Database(path.join(dataDirectory, 'tickets.db'));
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      starts_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS seats (
      id INTEGER PRIMARY KEY,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      seat_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved')),
      UNIQUE(event_id, seat_number)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      seat_id INTEGER NOT NULL UNIQUE REFERENCES seats(id),
      customer_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_seats_free_by_event
      ON seats(event_id, status, seat_number);
    CREATE INDEX IF NOT EXISTS idx_orders_event
      ON orders(event_id);
  `);
}

createSchema();

module.exports = db;
