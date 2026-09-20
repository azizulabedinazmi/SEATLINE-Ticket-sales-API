require('dotenv').config();

const express = require('express');
const path = require('node:path');
const usePostgres = Boolean(process.env.DATABASE_URL);
const db = usePostgres ? null : require('./db');
const postgres = usePostgres ? require('./postgres') : null;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
const databaseReady = usePostgres ? postgres.initializeSchema() : Promise.resolve();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ticket-sales-api' });
});

const listFreeSeats = db?.prepare(`
  SELECT id, seat_number
  FROM seats
  WHERE event_id = ? AND status = 'available'
  ORDER BY seat_number
`);

const reserveSeatTransaction = db?.transaction((eventId, seatNumber, customerName) => {
  const seat = db.prepare(`
    SELECT id
    FROM seats
    WHERE event_id = ? AND seat_number = ? AND status = 'available'
  `).get(eventId, seatNumber);

  if (!seat) {
    return null;
  }

  db.prepare(`UPDATE seats SET status = 'reserved' WHERE id = ?`).run(seat.id);
  const order = db.prepare(`
    INSERT INTO orders (event_id, seat_id, customer_name)
    VALUES (?, ?, ?)
  `).run(eventId, seat.id, customerName);

  return { orderId: order.lastInsertRowid, seatId: seat.id, seatNumber };
});

async function listPostgresFreeSeats(eventId) {
  const result = await postgres.pool.query(`
    SELECT id, seat_number
    FROM seats
    WHERE event_id = $1 AND status = 'available'
    ORDER BY seat_number
  `, [eventId]);
  return result.rows;
}

async function reservePostgresSeat(eventId, seatNumber, customerName) {
  const client = await postgres.pool.connect();
  try {
    await client.query('BEGIN');
    const seat = await client.query(`
      SELECT id
      FROM seats
      WHERE event_id = $1 AND seat_number = $2 AND status = 'available'
      FOR UPDATE
    `, [eventId, seatNumber]);
    if (seat.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query("UPDATE seats SET status = 'reserved' WHERE id = $1", [seat.rows[0].id]);
    const order = await client.query(`
      INSERT INTO orders (event_id, seat_id, customer_name)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [eventId, seat.rows[0].id, customerName]);
    await client.query('COMMIT');
    return { orderId: order.rows[0].id, seatId: seat.rows[0].id, seatNumber };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

app.get('/events/:eventId/free-seats', async (req, res, next) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isInteger(eventId)) {
    return res.status(400).json({ error: 'eventId must be an integer' });
  }

  try {
    await databaseReady;
    const seats = usePostgres ? await listPostgresFreeSeats(eventId) : listFreeSeats.all(eventId);
    return res.json({ eventId, seats });
  } catch (error) {
    return next(error);
  }
});

app.post('/events/:eventId/seats/:seatNumber/reserve', async (req, res, next) => {
  const eventId = Number(req.params.eventId);
  const seatNumber = Number(req.params.seatNumber);
  const customerName = typeof req.body?.customerName === 'string' ? req.body.customerName.trim() : '';

  if (!Number.isInteger(eventId) || !Number.isInteger(seatNumber) || !customerName) {
    return res.status(400).json({ error: 'eventId, seatNumber, and customerName are required' });
  }

  try {
    await databaseReady;
    const reservation = usePostgres
      ? await reservePostgresSeat(eventId, seatNumber, customerName)
      : reserveSeatTransaction(eventId, seatNumber, customerName);
    if (!reservation) {
      return res.status(409).json({ error: 'seat is unavailable' });
    }
    return res.status(201).json(reservation);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'seat is already reserved' });
    }
    return next(error);
  }
});

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`ticket sales API listening on http://localhost:${port}`));
}

module.exports = app;
