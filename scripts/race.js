const requests = [
  fetch('http://localhost:3000/events/1/seats/1/reserve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ customerName: 'Alice' })
  }),
  fetch('http://localhost:3000/events/1/seats/1/reserve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ customerName: 'Bob' })
  })
];

Promise.all(requests)
  .then(async (responses) => {
    const results = await Promise.all(responses.map(async (response) => ({
      status: response.status,
      body: await response.json()
    })));
    console.log(JSON.stringify(results));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
