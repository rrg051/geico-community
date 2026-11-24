'use strict';
/*
 * Shared Square payment logic for the Geico Community store.
 * Used by both the standalone server (server.js) and the serverless
 * function (api/pay.js). The access token is read from the environment
 * by the caller and never leaves the server.
 */

const crypto = require('node:crypto');

function apiBase(environment) {
  return environment === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
}

function squareMessage(body, fallback) {
  if (body && Array.isArray(body.errors) && body.errors.length) {
    return body.errors.map((e) => e.detail || e.code).join(' ');
  }
  return fallback;
}

function badRequest(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

async function createPayment(input, options) {
  const token = options.token;
  const locationId = options.locationId;
  const environment = options.environment || 'sandbox';
  const maxCents = Number(options.maxCents || 500000);

  const sourceId = typeof input.sourceId === 'string' ? input.sourceId.trim() : '';
  const amount = Number(input.amount);
  const currency = String(input.currency || 'USD').toUpperCase();

  if (!sourceId) throw badRequest('Missing card token.');
  if (!Number.isInteger(amount) || amount < 50) throw badRequest('The amount must be a whole number of cents, at least 50.');
  if (amount > maxCents) throw badRequest('That order is above the limit this endpoint accepts.');
  if (currency !== 'USD') throw badRequest('Only USD is accepted.');

  const payload = {
    source_id: sourceId,
    idempotency_key: crypto.randomUUID(),
    amount_money: { amount, currency },
    location_id: locationId,
    autocomplete: true
  };
  if (Array.isArray(input.items)) payload.note = String(input.items.join(', ')).slice(0, 500);
  if (input.email) payload.buyer_email_address = String(input.email).slice(0, 255);
  if (input.name) payload.reference_id = String(input.name).slice(0, 40);

  const response = await fetch(apiBase(environment) + '/v2/payments', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = {}; }

  if (!response.ok) {
    const message = squareMessage(data, 'Square rejected the payment.');
    const status = response.status === 401 || response.status === 403 ? 502 : 402;
    throw Object.assign(new Error(message), { status });
  }

  const payment = data.payment || {};
  return {
    ok: true,
    paymentId: payment.id || null,
    status: payment.status || null,
    receiptUrl: payment.receipt_url || null,
    totalCents: payment.total_money ? payment.total_money.amount : amount
  };
}

module.exports = { createPayment };
