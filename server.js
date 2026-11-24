'use strict';
/*
 * Standalone Node service for the Geico Community store.
 * Serves the site and the payment endpoint, so one process is the whole shop.
 *
 *   npm start                       (port 8787 by default)
 *   PORT=3000 npm start
 *
 * Environment: SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID,
 *              SQUARE_ENVIRONMENT (sandbox|production), ALLOW_ORIGIN,
 *              MAX_AMOUNT_CENTS, SITE_DIR.
 *
 * Node 18 or newer. No dependencies.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createPayment } = require('./lib/square-pay');

const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.SQUARE_ACCESS_TOKEN || '';
const LOCATION_ID = process.env.SQUARE_LOCATION_ID || '';
const ENVIRONMENT = process.env.SQUARE_ENVIRONMENT || 'sandbox';
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';
const SITE_DIR = path.resolve(process.env.SITE_DIR || __dirname);
const MAX_CENTS = Number(process.env.MAX_AMOUNT_CENTS || 500000);

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
  });
  res.end(payload);
}

function readBody(req, limit = 100 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(new Error('Request body too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.md': 'text/markdown; charset=utf-8'
};

function serveStatic(res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const file = path.join(SITE_DIR, path.normalize(decodeURIComponent(rel)).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(SITE_DIR)) { res.writeHead(403).end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': data.length
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': ALLOW_ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Max-Age': '86400'
    }).end();
    return;
  }

  if (pathname === '/api/health') {
    sendJson(res, 200, { ok: true, environment: ENVIRONMENT, configured: Boolean(TOKEN && LOCATION_ID) });
    return;
  }

  if (pathname === '/api/pay' && req.method === 'POST') {
    if (!TOKEN || !LOCATION_ID) {
      sendJson(res, 500, { ok: false, error: 'The server is missing SQUARE_ACCESS_TOKEN or SQUARE_LOCATION_ID.' });
      return;
    }
    let body;
    try {
      body = JSON.parse((await readBody(req)) || '{}');
    } catch (_) {
      sendJson(res, 400, { ok: false, error: 'Malformed request body.' });
      return;
    }
    try {
      const result = await createPayment(body, { token: TOKEN, locationId: LOCATION_ID, environment: ENVIRONMENT, maxCents: MAX_CENTS });
      console.log('payment ' + result.paymentId + ' ' + result.totalCents + 'c ' + result.status);
      sendJson(res, 200, result);
    } catch (err) {
      console.error('payment failed: ' + err.message);
      sendJson(res, err.status || 500, { ok: false, error: err.message });
    }
    return;
  }

  if (req.method === 'GET') { serveStatic(res, pathname); return; }
  sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
});

server.listen(PORT, () => {
  console.log('Geico Community store on http://localhost:' + PORT + ' (' + ENVIRONMENT + ')');
  if (!TOKEN || !LOCATION_ID) {
    console.log('Waiting on SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID — checkout returns an error until they are set.');
  }
});
