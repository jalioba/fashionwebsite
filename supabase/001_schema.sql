-- ============================================================
-- AVISHU CRM — 001_schema.sql
-- Supabase PostgreSQL Schema
-- Таблицы: franchisees, products, workshops, orders,
--          order_items, revenue_records
-- ============================================================

-- ── Расширения ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ══════════════════════════════════════════════════════════════
-- 1. FRANCHISEES — Франчайзи-партнёры
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS franchisees (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  city        TEXT,
  contact     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- 2. PRODUCTS — Товары / Категории продукции
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'clothing',
  price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- 3. WORKSHOPS — Цеха производства
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS workshops (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  shift       TEXT DEFAULT 'A',
  operators   INT DEFAULT 0,
  progress    INT DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- 4. ORDERS — Заказы
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  franchisee_id   UUID REFERENCES franchisees(id) ON DELETE SET NULL,
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','in_progress','completed','cancelled')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_created   ON orders (created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status    ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_franchise ON orders (franchisee_id);

-- ══════════════════════════════════════════════════════════════
-- 5. ORDER_ITEMS — Позиции заказов
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS order_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity    INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total  NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items (product_id);

-- ══════════════════════════════════════════════════════════════
-- 6. REVENUE_RECORDS — Ежедневные записи доходов
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS revenue_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date            DATE NOT NULL,
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  workshop_id     INT REFERENCES workshops(id) ON DELETE SET NULL,
  franchisee_id   UUID REFERENCES franchisees(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revenue_date      ON revenue_records (date);
CREATE INDEX IF NOT EXISTS idx_revenue_workshop  ON revenue_records (workshop_id);
CREATE INDEX IF NOT EXISTS idx_revenue_franchise ON revenue_records (franchisee_id);

-- ══════════════════════════════════════════════════════════════
-- 7. ROW LEVEL SECURITY (RLS)
-- ══════════════════════════════════════════════════════════════

-- Включаем RLS на всех таблицах
ALTER TABLE franchisees     ENABLE ROW LEVEL SECURITY;
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshops       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_records ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики (если есть) и создаём заново
DO $$ BEGIN
  -- franchisees
  DROP POLICY IF EXISTS "Authenticated read access" ON franchisees;
  DROP POLICY IF EXISTS "Service role full access" ON franchisees;
  -- products
  DROP POLICY IF EXISTS "Authenticated read access" ON products;
  DROP POLICY IF EXISTS "Service role full access" ON products;
  -- workshops
  DROP POLICY IF EXISTS "Authenticated read access" ON workshops;
  DROP POLICY IF EXISTS "Service role full access" ON workshops;
  -- orders
  DROP POLICY IF EXISTS "Authenticated read access" ON orders;
  DROP POLICY IF EXISTS "Service role full access" ON orders;
  -- order_items
  DROP POLICY IF EXISTS "Authenticated read access" ON order_items;
  DROP POLICY IF EXISTS "Service role full access" ON order_items;
  -- revenue_records
  DROP POLICY IF EXISTS "Authenticated read access" ON revenue_records;
  DROP POLICY IF EXISTS "Service role full access" ON revenue_records;
END $$;

-- Политика: аутентифицированные пользователи могут читать все данные
CREATE POLICY "Authenticated read access" ON franchisees
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read access" ON products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read access" ON workshops
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read access" ON orders
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read access" ON order_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read access" ON revenue_records
  FOR SELECT TO authenticated USING (true);

-- Политика: service_role может всё (для серверных операций)
CREATE POLICY "Service role full access" ON franchisees
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON products
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON workshops
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON orders
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON order_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON revenue_records
  FOR ALL TO service_role USING (true) WITH CHECK (true);
