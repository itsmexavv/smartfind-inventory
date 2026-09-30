"""Inventory with an auditable stock ledger and transactional adjustments."""
from core import APIError, Database, integer, money, rows, text

SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY, sku TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
 category TEXT NOT NULL, price_cents INTEGER NOT NULL CHECK(price_cents>=0),
 stock INTEGER NOT NULL CHECK(stock>=0), reorder_level INTEGER NOT NULL CHECK(reorder_level>=0));
CREATE TABLE IF NOT EXISTS movements (
 id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id),
 delta INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
"""


class SmartFind:
    def __init__(self, path):
        self.db = Database(path)
        self.db.initialize(SCHEMA, self.seed)

    @staticmethod
    def seed(conn):
        products = [("PEN-01", "Black gel pen", "Writing", 2500, 48, 10),
                    ("NOTE-01", "Grid notebook", "Paper", 6500, 6, 10),
                    ("USB-01", "32 GB flash drive", "Tech", 28000, 0, 5),
                    ("PAD-01", "Yellow pad", "Paper", 4500, 20, 8)]
        conn.executemany("INSERT INTO products(sku,name,category,price_cents,stock,reorder_level) VALUES (?,?,?,?,?,?)", products)
        conn.execute("INSERT INTO movements(product_id,delta,reason) SELECT id,stock,'Opening balance' FROM products")

    def handle(self, method, path, data, query):
        with self.db.connect() as conn:
            if path == "/products" and method == "GET":
                return rows(conn.execute("SELECT *, stock<=reorder_level AS low_stock FROM products ORDER BY name"))
            if path == "/products" and method == "POST":
                stock = integer(data.get("stock"), "Stock")
                cursor = conn.execute("INSERT INTO products(sku,name,category,price_cents,stock,reorder_level) VALUES (?,?,?,?,?,?)", (
                    text(data.get("sku"), "SKU", 30).upper(), text(data.get("name"), "Name"),
                    text(data.get("category"), "Category", 40), money(data.get("price")), stock,
                    integer(data.get("reorder_level"), "Reorder level")))
                conn.execute("INSERT INTO movements(product_id,delta,reason) VALUES (?,?,?)", (cursor.lastrowid, stock, "Opening balance"))
                return {"id": cursor.lastrowid}
            if path == "/adjust" and method == "POST":
                product = integer(data.get("product_id"), "Product ID", 1)
                delta = integer(data.get("delta"), "Stock change", -1_000_000)
                if delta == 0:
                    raise APIError("Stock change cannot be zero.")
                reason = text(data.get("reason"), "Reason", 200)
                conn.execute("BEGIN IMMEDIATE")
                current = conn.execute("SELECT stock FROM products WHERE id=?", (product,)).fetchone()
                if not current:
                    raise APIError("Product not found.", 404)
                if not 0 <= current["stock"] + delta <= 1_000_000:
                    raise APIError("Adjustment would put stock outside the allowed range.", 409)
                conn.execute("UPDATE products SET stock=stock+? WHERE id=?", (delta, product))
                conn.execute("INSERT INTO movements(product_id,delta,reason) VALUES (?,?,?)", (product, delta, reason))
                return {"stock": current["stock"] + delta}
            if path == "/movements" and method == "GET":
                return rows(conn.execute("SELECT m.*,p.name FROM movements m JOIN products p ON p.id=m.product_id ORDER BY m.id DESC LIMIT 100"))
        raise APIError("Endpoint not found.", 404)
