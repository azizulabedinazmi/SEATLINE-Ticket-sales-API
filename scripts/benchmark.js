const { performance } = require('node:perf_hooks');

const samples = 100;
Promise.all(Array.from({ length: samples }, () => {
  const start = performance.now();
  return fetch('http://localhost:3000/events/1/free-seats')
    .then((response) => response.json())
    .then(() => performance.now() - start);
})).then((durations) => {
  durations.sort((a, b) => a - b);
  const p95 = durations[Math.floor(durations.length * 0.95)];
  console.log(JSON.stringify({ samples, p95Ms: Number(p95.toFixed(2)), maxMs: Number(durations.at(-1).toFixed(2)) }));
});
