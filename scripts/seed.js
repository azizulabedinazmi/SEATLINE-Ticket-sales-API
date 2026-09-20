if (process.env.DATABASE_URL) {
  const { pool, initializeSchema } = require('../src/postgres');

  (async () => {
    await initializeSchema();
    await pool.query('TRUNCATE orders, seats, events RESTART IDENTITY CASCADE');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let eventNumber = 1; eventNumber <= 100; eventNumber += 1) {
        const event = await client.query(
          'INSERT INTO events (name, starts_at) VALUES ($1, $2) RETURNING id',
          [`Event ${eventNumber}`, `2026-${String((eventNumber % 12) + 1).padStart(2, '0')}-15T19:00:00Z`]
        );
        for (let seatNumber = 1; seatNumber <= 100; seatNumber += 1) {
          await client.query(
            'INSERT INTO seats (event_id, seat_number) VALUES ($1, $2)',
            [event.rows[0].id, seatNumber]
          );
        }
      }
      await client.query('COMMIT');
      const counts = await pool.query('SELECT (SELECT COUNT(*) FROM events) AS events, (SELECT COUNT(*) FROM seats) AS seats');
      console.log(JSON.stringify({ events: Number(counts.rows[0].events), seats: Number(counts.rows[0].seats), database: 'postgres' }));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
      await pool.end();
    }
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
  return;
}

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
