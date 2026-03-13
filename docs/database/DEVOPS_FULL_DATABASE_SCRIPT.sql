/*
  =====================================================================
  CRACKERS WEBSITE - LIVE DB AUDITED FULL TABLE SCRIPT
  =====================================================================
  Audited On: 2026-03-05
  Source DB: public schema from current live project database
  Engine: PostgreSQL

  Purpose:
  - DevOps team can use this single script to recreate current live tables.
  - Headings are kept table-wise for easy review and handoff.
*/

-- Recommended execution:
-- 1) Create/choose target database
-- 2) Run this script once
-- 3) Verify using:
--    SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;

BEGIN;

-- =====================================================================
-- TABLE: categories
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id SERIAL NOT NULL,
    name VARCHAR(255) NOT NULL,
    CONSTRAINT categories_pkey PRIMARY KEY (id)
);

-- =====================================================================
-- TABLE: hero_slides
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.hero_slides (
    id SERIAL NOT NULL,
    title VARCHAR(255),
    subtitle VARCHAR(255),
    image VARCHAR(500),
    button_text VARCHAR(100),
    status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT hero_slides_pkey PRIMARY KEY (id)
);

-- =====================================================================
-- TABLE: orders
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id SERIAL NOT NULL,
    order_id VARCHAR(50) NOT NULL,
    user_id INTEGER,
    customer_name VARCHAR(100) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    address_line1 VARCHAR(200) NOT NULL,
    address_line2 VARCHAR(200),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pin_code VARCHAR(10) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    total_amount NUMERIC(10,2) NOT NULL,
    order_date TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT orders_pkey PRIMARY KEY (id),
    CONSTRAINT orders_order_id_key UNIQUE (order_id)
);

-- =====================================================================
-- TABLE: order_items
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.order_items (
    id SERIAL NOT NULL,
    order_id VARCHAR(50) NOT NULL,
    product_id INTEGER NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT order_items_pkey PRIMARY KEY (id),
    CONSTRAINT order_items_order_id_fkey
      FOREIGN KEY (order_id)
      REFERENCES public.orders(order_id)
      ON DELETE CASCADE
);

-- =====================================================================
-- TABLE: products
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id SERIAL NOT NULL,
    name VARCHAR(200) NOT NULL,
    original_price INTEGER NOT NULL,
    offer_price INTEGER NOT NULL,
    discount INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    image_url TEXT NOT NULL,
    category_id INTEGER,
    category_name VARCHAR(255),
    is_best_selling BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    video_url TEXT,
    CONSTRAINT products_pkey PRIMARY KEY (id),
    CONSTRAINT products_category_id_fkey
      FOREIGN KEY (category_id)
      REFERENCES public.categories(id)
);

-- =====================================================================
-- TABLE: user_addresses
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.user_addresses (
    id SERIAL NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    name VARCHAR(80) NOT NULL,
    mobile VARCHAR(10) NOT NULL,
    line1 VARCHAR(100) NOT NULL,
    line2 VARCHAR(100),
    city VARCHAR(50) NOT NULL,
    state VARCHAR(50) NOT NULL,
    pin VARCHAR(6) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_addresses_pkey PRIMARY KEY (id)
);

-- =====================================================================
-- TABLE: users
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_mobile_key UNIQUE (mobile)
);

-- =====================================================================
-- INDEXES: custom non-primary indexes found in live DB
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
    ON public.order_items USING btree (order_id);

CREATE INDEX IF NOT EXISTS idx_orders_order_id
    ON public.orders USING btree (order_id);

CREATE INDEX IF NOT EXISTS idx_orders_user_id
    ON public.orders USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_user_addresses_default
    ON public.user_addresses USING btree (is_default);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user
    ON public.user_addresses USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_users_mobile
    ON public.users USING btree (mobile);

COMMIT;

-- =====================================================================
-- VALIDATION QUERIES
-- =====================================================================
-- SELECT tablename
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
-- ORDER BY table_name, ordinal_position;
