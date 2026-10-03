# JC Kainan

A responsive, animated food ordering page using plain HTML, CSS, JavaScript, and the existing Supabase `foods` and `orders` tables. No build step is needed for deployment.

## Preview locally

With Node.js installed, run `npm start` and open <http://127.0.0.1:4174>.

## Run browser tests

```sh
npm install
npx playwright install chromium
npm test
```

To use an already installed Chrome instead, set `PLAYWRIGHT_CHANNEL=chrome` before running the tests. Tests replace the Supabase SDK with a mock and block production API traffic, so they never create real orders.

The suite covers menu selection, search, totals, validation, loading and order failures, retries, successful orders, keyboard interaction, reduced motion, and mobile/desktop layouts.

## Supabase

The browser uses the existing public publishable key in `script.js`, not a secret service-role key. Keep row-level security policies enabled and validate orders in the database: frontend checks alone do not enforce permissions or trusted pricing.

The UI uses only the existing fields: `foods(id, food_name, price)` and `orders(customer_name, food_id, quantity, price)`. No database migration is required. The current order flow supports one meal per order, with quantities from 1 to 99.
