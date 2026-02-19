-- Run this script manually in Neon SQL Editor against the PURCHASE ORDERS service database.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM purchase_order_line_items
    WHERE supplier_name IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot enforce single-supplier constraint: found line items with NULL supplier_name';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_purchase_orders_id_supplier_name'
  ) THEN
    ALTER TABLE purchase_orders
      ADD CONSTRAINT uq_purchase_orders_id_supplier_name
      UNIQUE (id, supplier_name);
  END IF;
END $$;

ALTER TABLE purchase_order_line_items
  ALTER COLUMN supplier_name SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_po_line_items_supplier_matches_po'
  ) THEN
    ALTER TABLE purchase_order_line_items
      ADD CONSTRAINT fk_po_line_items_supplier_matches_po
      FOREIGN KEY (purchase_order_id, supplier_name)
      REFERENCES purchase_orders (id, supplier_name)
      ON DELETE CASCADE;
  END IF;
END $$;
