const db = require('../src/db');

db.exec('DELETE FROM orders; DELETE FROM seats; DELETE FROM events;');
const insertEvent = db.prepare('INSERT INTO events (name, starts_at) VALUES (?, ?)');
const insertSeat = db.prepare('INSERT INTO seats (event_id, seat_number) VALUES (?, ?)');

const seed = db.transaction(() => {
  for (let eventNumber = 1; eventNumber <= 100; eventNumber += 1) {
    const event = insertEvent.run(`Event ${eventNumber}`, `2026-${String((eventNumber % 12) + 1).padStart(2, '0')}-15T19:00:00Z`);
    for (let seatNumber = 1; seatNumber <= 100; seatNumber += 1) {
      insertSeat.run(event.lastInsertRowid, seatNumber);
    }
  }
});

seed();
console.log(JSON.stringify({ events: db.prepare('SELECT COUNT(*) AS count FROM events').get().count, seats: db.prepare('SELECT COUNT(*) AS count FROM seats').get().count }));
