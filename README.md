# JC Kainan

A responsive, animated food ordering page using plain HTML, CSS, and JavaScript. No build step or database is needed for the current local checkout.

## Menu and checkout

The built-in menu contains five meals:

| Meal | Price |
| --- | ---: |
| Classic Burger | ₱120.00 |
| Margherita Pizza | ₱245.00 |
| Chicken Rice | ₱150.00 |
| Spaghetti | ₱130.00 |
| Crispy Fries | ₱75.00 |

Choose a meal, enter your name and a quantity from 1 to 99, and click **Check out**. A successful checkout saves the order and displays a printable receipt. Reloading restores saved receipts; the five most recent orders are shown in the history section.

**This is local checkout, not a restaurant order queue or payment gateway.** Names and orders are saved only in this browser's `localStorage` under `jc-kainan.orders.v1`. They are not sent to a restaurant, and no payment is collected. Clearing site data deletes the receipts. Avoid entering sensitive data on a shared device. Checkout reports an error rather than claiming success if browser storage is blocked, full, or contains invalid order data.

## Preview locally

With Node.js 20+ installed, run `npm start` and open <http://127.0.0.1:4174>. You can also open `index.html` directly; local storage support for file URLs depends on the browser.

## Run browser tests

```sh
npm install
npx playwright install chromium
npm test
```

To use an already installed Chrome instead, set `PLAYWRIGHT_CHANNEL=chrome` before running the tests. Tests use the real built-in menu and isolated browser storage, with external requests blocked.

The suite covers all five meals, menu selection, search, totals, validation, checkout persistence, printable receipts, storage failures, keyboard interaction, reduced motion, and mobile/desktop layouts.

## Online orders

The previous Supabase endpoint was unavailable, so it is no longer a dependency. Real shared restaurant orders require a working backend and server-side validation; payment processing requires a payment-provider integration. Existing Supabase data was not changed, and local receipts do not automatically synchronize to a database.
