const app = require('../src/server');

module.exports = (request, response) => {
  if (request.url.startsWith('/api')) {
    request.url = request.url.slice(4) || '/';
  }
  return app(request, response);
};
