const express = require('express');
const path = require('node:path');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ticket-sales-api' });
});

const listFreeSeats = db.prepare(`
  SELECT id, seat_number
  FROM seats
  WHERE event_id = ? AND status = 'available'
  ORDER BY seat_number
`);

const reserveSeatTransaction = db.transaction((eventId, seatNumber, customerName) => {
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

app.get('/events/:eventId/free-seats', (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isInteger(eventId)) {
    return res.status(400).json({ error: 'eventId must be an integer' });
  }

  return res.json({ eventId, seats: listFreeSeats.all(eventId) });
});

app.post('/events/:eventId/seats/:seatNumber/reserve', (req, res) => {
  const eventId = Number(req.params.eventId);
  const seatNumber = Number(req.params.seatNumber);
  const customerName = typeof req.body?.customerName === 'string' ? req.body.customerName.trim() : '';

  if (!Number.isInteger(eventId) || !Number.isInteger(seatNumber) || !customerName) {
    return res.status(400).json({ error: 'eventId, seatNumber, and customerName are required' });
  }

  try {
    const reservation = reserveSeatTransaction(eventId, seatNumber, customerName);
    if (!reservation) {
      return res.status(409).json({ error: 'seat is unavailable' });
    }
    return res.status(201).json(reservation);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'seat is already reserved' });
    }
    throw error;
  }
});

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`ticket sales API listening on http://localhost:${port}`));
}

module.exports = app;
