'use strict';
/*
 * POST /api/pay — serverless (Vercel-style) endpoint.
 * Environment: SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID,
 *              SQUARE_ENVIRONMENT (sandbox|production), ALLOW_ORIGIN.
 */

const { createPayment } = require('../lib/square-pay');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  const token = process.env.SQUARE_ACCESS_TOKEN || '';
  const locationId = process.env.SQUARE_LOCATION_ID || '';
  if (!token || !locationId) {
    res.status(500).json({ ok: false, error: 'The server is missing SQUARE_ACCESS_TOKEN or SQUARE_LOCATION_ID.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch (_) { body = null; }
  }
  if (!body || typeof body !== 'object') {
    res.status(400).json({ ok: false, error: 'Malformed request body.' });
    return;
  }

  try {
    const result = await createPayment(body, {
      token,
      locationId,
      environment: process.env.SQUARE_ENVIRONMENT || 'sandbox',
      maxCents: process.env.MAX_AMOUNT_CENTS
    });
    res.status(200).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: err.message });
  }
};
