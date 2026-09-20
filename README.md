# Ticket sales 

[![DevConnect](https://devconnectplatform.com/api/badge/azizulabedin)](https://devconnectplatform.com/u/azizulabedin?ref=badge)

A small SQLite-backed API for events, seats, and orders. The seed creates 100 events with 100 seats each: 10,000 seats total.

## Run

```powershell
npm install
npm run seed
npm start
```

The API listens on `http://localhost:3000`.

Open that address in a browser for the Seatline interface. It shows the API connection state, lets you load an event, click an available seat, and reserve it. The interface is served by the same API process from `public/`.

## Endpoints

List free seats:

```powershell
curl http://localhost:3000/events/1/free-seats
```

Reserve one seat:

```powershell
curl -X POST http://localhost:3000/events/1/seats/1/reserve `
  -H "content-type: application/json" `
  -d '{"customerName":"Alice"}'
```

The reservation runs in one SQLite transaction. It only changes a seat from `available` to `reserved`, then inserts the order. SQLite serializes competing writers; the unique `orders.seat_id` constraint is an additional database guarantee.

## Query plan and timing

The free-seat endpoint uses `idx_seats_free_by_event` on `(event_id, status, seat_number)`.

`npm run plan` drops and recreates the index around the same query. Before the index it returned:

```text
SEARCH seats USING INDEX sqlite_autoindex_seats_1 (event_id=?)
```

After the index it returned:

```text
SEARCH seats USING COVERING INDEX idx_seats_free_by_event (event_id=? AND status=?)
```

Measured on the seeded database with 10,000 seats:

```text
npm run benchmark
{"samples":100,"p95Ms":62.27,"maxMs":71.9}
```

The values vary by machine; the acceptance limit is under 200 ms.

## Race demonstration

With the server running after `npm run seed`, these two HTTP requests were started concurrently:

```powershell
npm run race
```

Output:

```text
[{"status":201,"body":{"orderId":1,"seatId":1,"seatNumber":1}},{"status":409,"body":{"error":"seat is unavailable"}}]
```

Only one request returns `201 Created`; the other returns `409 Conflict`. Running `npm run race` again against the same seat returns two `409` responses because it is already reserved.

## License

This project is released under the MIT License. See [LICENSE](LICENSE).
