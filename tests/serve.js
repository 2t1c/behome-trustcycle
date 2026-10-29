// Starts the app's server on a free port for a test run and waits until it answers.
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer().once('error', reject).listen(0, '127.0.0.1', () => {
    const { port } = s.address();
    s.close(() => resolve(port));
  });
});

const healthy = (port) => new Promise((resolve) => {
  http.get({ host: '127.0.0.1', port, path: '/healthz' }, (res) => { res.resume(); resolve(res.statusCode === 200); })
    .on('error', () => resolve(false));
});

module.exports = async function serve() {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  for (let i = 0; i < 50 && !(await healthy(port)); i++) await new Promise((r) => setTimeout(r, 100));
  return { port, url: `http://localhost:${port}/`, stop: () => child.kill() };
};
