BEGIN;

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS po_number varchar(40);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_purchase_orders_po_number'
  ) THEN
    ALTER TABLE purchase_orders
      ADD CONSTRAINT uq_purchase_orders_po_number UNIQUE (po_number);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS purchase_order_number_counters (
  counter_date date PRIMARY KEY,
  last_value integer NOT NULL CHECK (last_value > 0),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_status_history (
  id varchar(140) PRIMARY KEY,
  purchase_order_id varchar(140) NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  from_status varchar(40),
  to_status varchar(40) NOT NULL,
  changed_by varchar(200),
  changed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_status_history_po_id
  ON purchase_order_status_history (purchase_order_id);

CREATE INDEX IF NOT EXISTS idx_po_status_history_changed_at
  ON purchase_order_status_history (changed_at DESC);

COMMIT;
