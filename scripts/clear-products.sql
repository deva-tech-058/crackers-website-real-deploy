BEGIN;

DELETE FROM products;

DO $$
DECLARE
  seq_name text;
BEGIN
  SELECT pg_get_serial_sequence('products', 'id') INTO seq_name;
  IF seq_name IS NOT NULL THEN
    EXECUTE format('ALTER SEQUENCE %s RESTART WITH 1', seq_name);
  END IF;
END $$;

COMMIT;
