-- ============================================================
-- AVISHU CRM — 002_seed_data.sql
-- Тестовые данные для демо-режима
-- ИСПРАВЛЕНО: порядок вставки orders → order_items
-- ============================================================

-- ── 1. Франчайзи ────────────────────────────────────────────
INSERT INTO franchisees (id, name, city, contact) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'AVISHU Алматы',   'Алматы',   '+7 701 111 1111'),
  ('a2222222-2222-2222-2222-222222222222', 'AVISHU Астана',    'Астана',   '+7 702 222 2222')
ON CONFLICT (id) DO NOTHING;

-- ── 2. Продукты ─────────────────────────────────────────────
INSERT INTO products (id, name, category, price) VALUES
  ('b1111111-1111-1111-1111-111111111111', 'Рубашки', 'clothing', 8500.00),
  ('b2222222-2222-2222-2222-222222222222', 'Куртки',  'clothing', 25000.00),
  ('b3333333-3333-3333-3333-333333333333', 'Брюки',   'clothing', 12000.00),
  ('b4444444-4444-4444-4444-444444444444', 'Платья',  'clothing', 18000.00),
  ('b5555555-5555-5555-5555-555555555555', 'Другое',  'clothing', 6000.00)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Цеха (как в dashboards.html) ─────────────────────────
INSERT INTO workshops (id, name, shift, operators, progress) VALUES
  (1, 'Цех №1 — Крой',               'A',               24, 92),
  (2, 'Цех №2 — Шитьё',              'A/B',             48, 78),
  (3, 'Цех №3 — Отделка',            'B',               18, 65),
  (4, 'Цех №4 — Контроль качества',  'A',               12, 88),
  (5, 'Цех №5 — Упаковка',           'B',               10, 55),
  (6, 'Цех №6 — Склад',              'Круглосуточно',    8, 71)
ON CONFLICT (id) DO NOTHING;

-- ── 4. Генерация заказов за 90 дней ─────────────────────────
-- ИСПРАВЛЕНО: сначала INSERT orders, потом INSERT order_items
DO $$
DECLARE
  day_date    DATE;
  i           INT;
  num_orders  INT;
  order_uuid  UUID;
  prod_ids    UUID[] := ARRAY[
    'b1111111-1111-1111-1111-111111111111'::UUID,
    'b2222222-2222-2222-2222-222222222222'::UUID,
    'b3333333-3333-3333-3333-333333333333'::UUID,
    'b4444444-4444-4444-4444-444444444444'::UUID,
    'b5555555-5555-5555-5555-555555555555'::UUID
  ];
  prod_prices NUMERIC[] := ARRAY[8500, 25000, 12000, 18000, 6000];
  fran_ids    UUID[] := ARRAY[
    'a1111111-1111-1111-1111-111111111111'::UUID,
    'a2222222-2222-2222-2222-222222222222'::UUID
  ];
  prod_idx    INT;
  qty         INT;
  line_price  NUMERIC;
  total       NUMERIC;
  chosen_fran UUID;
  chosen_status TEXT;
BEGIN
  FOR day_date IN
    SELECT d::DATE FROM generate_series(
      CURRENT_DATE - INTERVAL '90 days',
      CURRENT_DATE,
      '1 day'
    ) AS d
  LOOP
    -- 10-20 заказов в день (больше в будни)
    num_orders := 10 + floor(random() * 11)::INT;
    IF EXTRACT(DOW FROM day_date) IN (0, 6) THEN
      num_orders := num_orders - 5;  -- меньше в выходные
    END IF;

    FOR i IN 1..num_orders LOOP
      order_uuid := uuid_generate_v4();
      total := 0;
      chosen_fran := fran_ids[1 + floor(random() * 2)::INT];
      chosen_status := CASE WHEN random() > 0.05 THEN 'completed' ELSE 'cancelled' END;

      -- Сначала создаём заказ (чтобы foreign key работал)
      INSERT INTO orders (id, franchisee_id, total_amount, status, created_at, completed_at)
      VALUES (
        order_uuid,
        chosen_fran,
        0, -- временно 0, обновим позже
        chosen_status,
        day_date + (floor(random() * 14)::INT || ' hours')::INTERVAL,
        day_date + (floor(random() * 8 + 14)::INT || ' hours')::INTERVAL
      );

      -- Теперь добавляем позиции заказа
      FOR prod_idx IN 1..(1 + floor(random() * 3)::INT) LOOP
        qty := 1 + floor(random() * 5)::INT;
        line_price := prod_prices[1 + floor(random() * 5)::INT];
        total := total + (qty * line_price);

        INSERT INTO order_items (order_id, product_id, quantity, unit_price)
        VALUES (
          order_uuid,
          prod_ids[1 + floor(random() * 5)::INT],
          qty,
          line_price
        );
      END LOOP;

      -- Обновляем total_amount заказа
      UPDATE orders SET total_amount = total WHERE id = order_uuid;
    END LOOP;
  END LOOP;
END $$;

-- ── 5. Генерация revenue_records из выполненных заказов ──────
INSERT INTO revenue_records (date, amount, workshop_id, franchisee_id)
SELECT
  created_at::DATE                                AS date,
  SUM(total_amount)                               AS amount,
  1 + floor(random() * 6)::INT                   AS workshop_id,
  franchisee_id
FROM orders
WHERE status = 'completed'
GROUP BY created_at::DATE, franchisee_id
ORDER BY date;

-- ── 6. Проверка данных ──────────────────────────────────────
SELECT 'orders' AS table_name, count(*) AS row_count FROM orders
UNION ALL
SELECT 'order_items', count(*) FROM order_items
UNION ALL
SELECT 'revenue_records', count(*) FROM revenue_records
UNION ALL
SELECT 'franchisees', count(*) FROM franchisees
UNION ALL
SELECT 'products', count(*) FROM products
UNION ALL
SELECT 'workshops', count(*) FROM workshops;
