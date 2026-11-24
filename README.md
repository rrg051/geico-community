# Geico Community LLC — storefront

One-page store for Geico Community LLC (consumer products, New Mexico) with a cart and Square card checkout.

- `index.html` — the whole site: design, catalog cards, cart, checkout. Self-contained apart from Google Fonts and Square's card script.
- `server.js` — a small Node service that serves the page and charges cards through Square. No dependencies.
- `lib/square-pay.js` — the payment call, shared by both kinds of server.
- `api/pay.js` — the same endpoint as a serverless function (Vercel-style), for hosting the API without a box.

## Run it locally

```bash
SQUARE_ACCESS_TOKEN=... SQUARE_LOCATION_ID=... npm start
```

Then open http://localhost:8787. Sandbox test card: `4111 1111 1111 1111`, any future expiry, CVV `111`.

## Square settings in the page

The block at the top of the script in `index.html`:

```js
var SQUARE_CONFIG = {
  environment: 'sandbox',                                  /* 'sandbox' or 'production' */
  applicationId: 'sandbox-sq0idb-slbwaXMgngBaM0WZ9TR1Eg',  /* public */
  locationId: 'LFTY4ZXC7Z8MJ',                             /* public */
  payEndpoint: '/api/pay'                                  /* where the server lives */
};
```

You can override any of them in the URL for a quick test:

```
/?sq_env=production&sq_app=sq0idb-...&sq_loc=L...&sq_pay=https://api.example.com/api/pay
```

The access token never appears in this repository. It is read from the environment on the server.

## Hosting

**Everything on one Node host** (Render, Railway, Fly.io, a VPS, Docker): run `npm start` with `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID` and `SQUARE_ENVIRONMENT` set. That host serves the site and `/api/pay` together, and nothing else needs configuring.

**Static site on GitHub Pages, API on Vercel:** Pages serves `index.html` at `https://<user>.github.io/<repo>/`; import the same repository into Vercel, add the three environment variables, and Vercel publishes `/api/pay`. Then set `payEndpoint` in the page to `https://<project>.vercel.app/api/pay`, or pass it as `?sq_pay=...`. Until that is done, the checkout says the payment service is not connected instead of failing at the card step.

## Going to production

1. Square: activate the account, switch the application to production credentials.
2. Server: `SQUARE_ENVIRONMENT=production` and the production access token.
3. Page: `environment: 'production'`, production application ID and location ID.
4. Take one small real order yourself before announcing the site.

## Not included

No order database, no stock control, no tax or shipping calculation, no refunds UI. The catalog is three sample listings with stock photographs and sample prices — replace the cards, the images and the [PLACEHOLDER] contact details with the real ones before trading.
