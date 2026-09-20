const db = require('../src/db');
const query = `EXPLAIN QUERY PLAN
  SELECT id, seat_number
  FROM seats
  WHERE event_id = ? AND status = 'available'
  ORDER BY seat_number`;

db.exec('DROP INDEX IF EXISTS idx_seats_free_by_event');
console.log(`before index:\n${db.prepare(query).all(1).map((row) => row.detail).join('\n')}`);
db.exec(`CREATE INDEX idx_seats_free_by_event
  ON seats(event_id, status, seat_number)`);
console.log(`after index:\n${db.prepare(query).all(1).map((row) => row.detail).join('\n')}`);
