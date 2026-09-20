const statusPanel = document.querySelector('#api-status');
const statusText = document.querySelector('#status-text');
const eventInput = document.querySelector('#event-id');
const customerInput = document.querySelector('#customer-name');
const seatGrid = document.querySelector('#seat-grid');
const selectedSeatText = document.querySelector('#selected-seat');
const reserveButton = document.querySelector('#reserve-seat');
const result = document.querySelector('#result');
const mapTitle = document.querySelector('#map-title');
let selectedSeat = null;

async function checkApi() {
  try {
    const response = await fetch('/health');
    if (!response.ok) throw new Error('API unavailable');
    statusPanel.className = 'status online';
    statusText.textContent = 'API online';
  } catch (error) {
    statusPanel.className = 'status offline';
    statusText.textContent = 'API offline';
  }
}

function setResult(message, isError = false) {
  result.textContent = message;
  result.className = isError ? 'result error' : 'result';
}

async function loadSeats() {
  const eventId = Number(eventInput.value);
  if (!Number.isInteger(eventId) || eventId < 1) return setResult('Enter a valid event number.', true);
  selectedSeat = null;
  selectedSeatText.textContent = 'None';
  reserveButton.disabled = true;
  mapTitle.textContent = `Event #${eventId}`;
  seatGrid.innerHTML = '<div class="loading">Loading seats...</div>';
  try {
    const response = await fetch(`/events/${eventId}/free-seats`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load seats');
    const available = new Set(data.seats.map((seat) => seat.seat_number));
    seatGrid.innerHTML = '';
    for (let seatNumber = 1; seatNumber <= 100; seatNumber += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = available.has(seatNumber) ? 'seat' : 'seat reserved';
      button.textContent = seatNumber;
      button.disabled = !available.has(seatNumber);
      button.setAttribute('aria-label', `Seat ${seatNumber}${available.has(seatNumber) ? ', available' : ', reserved'}`);
      button.addEventListener('click', () => {
        document.querySelectorAll('.seat.selected').forEach((seat) => seat.classList.remove('selected'));
        button.classList.add('selected');
        selectedSeat = seatNumber;
        selectedSeatText.textContent = `Seat ${seatNumber}`;
        reserveButton.disabled = false;
        setResult('Ready to reserve.');
      });
      seatGrid.appendChild(button);
    }
    setResult(`${data.seats.length} seats available.`);
  } catch (error) {
    seatGrid.innerHTML = '<div class="loading">Unable to reach the API.</div>';
    setResult(error.message, true);
  }
}

async function reserveSeat() {
  const eventId = Number(eventInput.value);
  const customerName = customerInput.value.trim();
  if (!selectedSeat || !customerName) return setResult('Add your name and choose a seat.', true);
  reserveButton.disabled = true;
  try {
    const response = await fetch(`/events/${eventId}/seats/${selectedSeat}/reserve`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ customerName })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Reservation failed');
    setResult(`Reserved seat ${data.seatNumber}. Order #${data.orderId}.`);
    await loadSeats();
  } catch (error) {
    setResult(error.message, true);
    reserveButton.disabled = false;
  }
}

document.querySelector('#load-seats').addEventListener('click', loadSeats);
document.querySelector('#refresh-seats').addEventListener('click', loadSeats);
reserveButton.addEventListener('click', reserveSeat);
checkApi();
loadSeats();
