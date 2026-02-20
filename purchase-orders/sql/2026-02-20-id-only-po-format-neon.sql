-- Neon migration: make purchase_orders.id the only PO identifier (PO-YYYYMMDD-NNNN),
-- remap existing UUID ids, update foreign keys, and remove purchase_orders.po_number.

BEGIN;

LOCK TABLE purchase_orders IN ACCESS EXCLUSIVE MODE;
LOCK TABLE purchase_order_line_items IN ACCESS EXCLUSIVE MODE;
LOCK TABLE purchase_order_payment_milestones IN ACCESS EXCLUSIVE MODE;
LOCK TABLE purchase_order_status_history IN ACCESS EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS purchase_order_number_counters (
  counter_date date PRIMARY KEY,
  last_value integer NOT NULL CHECK (last_value > 0),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TEMP TABLE _po_fk_constraints (
  schema_name text NOT NULL,
  table_name text NOT NULL,
  constraint_name text NOT NULL,
  constraint_def text NOT NULL
) ON COMMIT DROP;

INSERT INTO _po_fk_constraints (schema_name, table_name, constraint_name, constraint_def)
SELECT
  n.nspname,
  c.relname,
  con.conname,
  pg_get_constraintdef(con.oid) AS constraint_def
FROM pg_constraint con
JOIN pg_class c
  ON c.oid = con.conrelid
JOIN pg_namespace n
  ON n.oid = c.relnamespace
WHERE con.contype = 'f'
  AND con.confrelid = 'purchase_orders'::regclass
  AND c.relname IN (
    'purchase_order_line_items',
    'purchase_order_payment_milestones',
    'purchase_order_status_history'
  );

DO $$
DECLARE
  row record;
BEGIN
  FOR row IN
    SELECT schema_name, table_name, constraint_name
    FROM _po_fk_constraints
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
      row.schema_name,
      row.table_name,
      row.constraint_name
    );
  END LOOP;
END $$;

ALTER TABLE purchase_orders
  DROP CONSTRAINT IF EXISTS uq_purchase_orders_po_number;

CREATE TEMP TABLE _po_id_map (
  old_id varchar(140) PRIMARY KEY,
  new_id varchar(140) NOT NULL
) ON COMMIT DROP;

WITH base AS (
  SELECT
    po.id AS old_id,
    po.po_number,
    po.created_at,
    CASE
      WHEN po.id ~ '^PO-[0-9]{8}-[0-9]+$' THEN po.id
      WHEN po.po_number ~ '^PO-[0-9]{8}-[0-9]+$' THEN po.po_number
      ELSE NULL
    END AS preferred_id,
    to_char((po.created_at AT TIME ZONE 'UTC')::date, 'YYYYMMDD') AS day_key
  FROM purchase_orders po
),
existing_max_per_day AS (
  SELECT
    substr(preferred_id, 4, 8) AS day_key,
    MAX((regexp_replace(preferred_id, '^PO-[0-9]{8}-', ''))::integer) AS max_seq
  FROM base
  WHERE preferred_id IS NOT NULL
  GROUP BY substr(preferred_id, 4, 8)
),
generated AS (
  SELECT
    b.old_id,
    'PO-' || b.day_key || '-' || lpad(
      (
        COALESCE(m.max_seq, 0)
        + row_number() OVER (
            PARTITION BY b.day_key
            ORDER BY b.created_at, b.old_id
          )
      )::text,
      4,
      '0'
    ) AS generated_id
  FROM base b
  LEFT JOIN existing_max_per_day m
    ON m.day_key = b.day_key
  WHERE b.preferred_id IS NULL
),
mapping AS (
  SELECT
    b.old_id,
    COALESCE(b.preferred_id, g.generated_id) AS new_id
  FROM base b
  LEFT JOIN generated g
    ON g.old_id = b.old_id
)
INSERT INTO _po_id_map (old_id, new_id)
SELECT old_id, new_id
FROM mapping;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM _po_id_map
    GROUP BY new_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot migrate purchase order ids: duplicate target ids generated';
  END IF;
END $$;

UPDATE purchase_order_line_items li
SET purchase_order_id = map.new_id
FROM _po_id_map map
WHERE li.purchase_order_id = map.old_id
  AND map.old_id <> map.new_id;

UPDATE purchase_order_payment_milestones pm
SET purchase_order_id = map.new_id
FROM _po_id_map map
WHERE pm.purchase_order_id = map.old_id
  AND map.old_id <> map.new_id;

UPDATE purchase_order_status_history sh
SET purchase_order_id = map.new_id
FROM _po_id_map map
WHERE sh.purchase_order_id = map.old_id
  AND map.old_id <> map.new_id;

UPDATE purchase_orders po
SET id = map.new_id
FROM _po_id_map map
WHERE po.id = map.old_id
  AND map.old_id <> map.new_id;

ALTER TABLE purchase_orders
  DROP COLUMN IF EXISTS po_number;

DO $$
DECLARE
  row record;
BEGIN
  FOR row IN
    SELECT schema_name, table_name, constraint_name, constraint_def
    FROM _po_fk_constraints
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I %s',
      row.schema_name,
      row.table_name,
      row.constraint_name,
      row.constraint_def
    );
  END LOOP;
END $$;

INSERT INTO purchase_order_number_counters (counter_date, last_value, updated_at)
SELECT
  to_date(substr(po.id, 4, 8), 'YYYYMMDD') AS counter_date,
  MAX((regexp_replace(po.id, '^PO-[0-9]{8}-', ''))::integer) AS last_value,
  NOW() AS updated_at
FROM purchase_orders po
WHERE po.id ~ '^PO-[0-9]{8}-[0-9]+$'
GROUP BY to_date(substr(po.id, 4, 8), 'YYYYMMDD')
ON CONFLICT (counter_date) DO UPDATE
SET
  last_value = GREATEST(purchase_order_number_counters.last_value, EXCLUDED.last_value),
  updated_at = NOW();

COMMIT;
