# SmartFind — inventory dashboard

**Explore:** frontend/full-stack development, transaction design and database validation.

![SmartFind demo](screenshot.png)

## Run this independent project

Requires Python **3.11+**. The app and tests use only Python's standard library; no pip installation, API key, or other repository is required.

```bash
git clone https://github.com/itsmexavv/smartfind-inventory.git
cd smartfind-inventory
python run.py
```

Open **http://127.0.0.1:8000/**. On Windows, use `py run.py` if `python` is unavailable. Stop the server with Ctrl+C.

**Run in GitHub Codespaces:** click **Code → Codespaces → Create codespace on main**, then run `python run.py` in the terminal. Open the browser notification, or the globe beside port **8000** in the **Ports** tab. Keep the port Private and stop the Codespace after testing. GitHub's file viewer and GitHub Pages do not execute this Python backend.

For separate apps on one computer, choose another port: `python run.py --port 8001`. Use `--data-dir demo-data` for a separate synthetic dataset. SQLite data is created automatically in data/ and survives restarts. Private databases are excluded from Git.

## Portfolio materials

- [Architecture and design choices](ARCHITECTURE.md)
- [Interview walkthrough and improvement ideas](PORTFOLIO.md)
- [Security boundaries](SECURITY.md)
- A local **Demo guide** page in the app
- Independent unit and HTTP tests, plus GitHub Actions on Python 3.11, 3.12 and 3.13

## Problem and workflow

A small school-supplies store needs to know which products are available and why stock changed. This demo supports product creation, search, low-stock indicators, incoming/outgoing stock changes and a movement ledger.

From the repository root, run `python run.py`, then open **http://127.0.0.1:8000/**.

1. Search for “notebook” and observe its low-stock status.
2. Select Grid notebook under Adjust stock and add 10 units with reason “Delivery”.
3. Check the updated stock and the new ledger entry.
4. Attempt to remove more units than are available. The API rejects the change without altering stock or the ledger.
5. Create a product, then try to reuse its SKU to see the uniqueness constraint.

## Data model

`products` stores unique SKU, name, category, price in integer cents, current stock and reorder level. `movements` references a product and stores signed quantity, reason and UTC timestamp. Products begin with an opening-balance movement.

## API

| Method | Endpoint | Request or result |
| --- | --- | --- |
| GET | `/api/smartfind/products` | Product list with computed `low_stock` flag |
| POST | `/api/smartfind/products` | `{name, sku, category, price, stock, reorder_level}` |
| POST | `/api/smartfind/adjust` | `{product_id, delta, reason}`; delta is a nonzero integer |
| GET | `/api/smartfind/movements` | Most recent 100 movements, including product name |

Example adjustment:

```json
{"product_id": 2, "delta": 10, "reason": "Demo delivery"}
```

## Key design choice

The stock read, validation, update and audit entry execute in a `BEGIN IMMEDIATE` transaction. SQLite serializes writers before the stock check, so concurrent deductions cannot both spend the same remaining units. This favors clear consistency over high write throughput for the local demo.

Price is integer cents. A SKU is unique. Stock cannot be negative. Zero-unit adjustments are rejected. The UI escapes names and reasons before rendering.

## Verification

Run `python -m unittest discover -v` from the repository root. Inventory tests cover stock rollback, ledger insertion, duplicate SKUs, parameterized SQL, persistence and concurrent overselling. Browser checks cover adding a product, searching and adjusting stock.

## Extensions to make yourself

- Add product editing without allowing stock to bypass the movement ledger.
- Add category filtering and a keyboard-accessible search workflow.
- Add supplier and purchase-order tables with foreign keys.
- Add pagination for products and movement history.

## Limits

No checkout, invoices, roles, authentication, product deletion or purchasing workflow. Search is client-side and the ledger view shows only the latest 100 entries. This is a synthetic, local MVP.


Built with AI assistance as a learning starter. Understand the design, verify the behavior, and add your own documented improvement before presenting it in an interview.

## Optional browser verification

The app itself needs no Node.js. To run its end-to-end workflow and responsive-layout checks locally, install Node.js 22+, then:

```bash
npm install --ignore-scripts
npx playwright install chromium
npm run test:browser
```

The script starts a separate server using disposable data, then closes it. GitHub Actions also runs these checks and uploads fresh desktop/mobile screenshots as the `browser-verification` artifact.
