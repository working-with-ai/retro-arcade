CREATE TABLE IF NOT EXISTS order_reconciliation (
 order_id TEXT PRIMARY KEY REFERENCES orders(id), retry_after INTEGER NOT NULL
);
