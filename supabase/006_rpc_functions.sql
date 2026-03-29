-- ============================================================
-- AVISHU CRM — 006_rpc_functions.sql
-- PostgreSQL-функции для Supabase RPC
-- Вызов из JS: supabase.rpc('function_name', { params })
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1. get_revenue_by_period — Доход за период для line chart
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_revenue_by_period(
  period_type TEXT DEFAULT '7d',       -- '7d' | '30d' | '90d' | '1y'
  date_from   DATE DEFAULT NULL,       -- для кастомного периода
  date_to     DATE DEFAULT NULL
)
RETURNS TABLE (
  label             TEXT,
  period_date       DATE,
  revenue_thousands NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_date DATE;
  end_date   DATE;
BEGIN
  end_date := COALESCE(date_to, CURRENT_DATE);
  start_date := COALESCE(date_from,
    CASE period_type
      WHEN '7d'  THEN end_date - 7
      WHEN '30d' THEN end_date - 30
      WHEN '90d' THEN end_date - 90
      WHEN '1y'  THEN end_date - 365
      ELSE end_date - 7
    END
  );

  IF period_type = '7d' OR (date_from IS NOT NULL AND (date_to - date_from) <= 14) THEN
    -- По дням
    RETURN QUERY
      SELECT
        TO_CHAR(r.date, 'Dy')::TEXT,
        r.date,
        ROUND(SUM(r.amount) / 1000, 0)
      FROM revenue_records r
      WHERE r.date >= start_date AND r.date <= end_date
      GROUP BY r.date
      ORDER BY r.date;

  ELSIF period_type = '30d' OR (date_from IS NOT NULL AND (date_to - date_from) <= 60) THEN
    -- По неделям
    RETURN QUERY
      SELECT
        ('Нед ' || ROW_NUMBER() OVER (ORDER BY DATE_TRUNC('week', r.date)))::TEXT,
        DATE_TRUNC('week', r.date)::DATE,
        ROUND(SUM(r.amount) / 1000, 0)
      FROM revenue_records r
      WHERE r.date >= start_date AND r.date <= end_date
      GROUP BY DATE_TRUNC('week', r.date)
      ORDER BY DATE_TRUNC('week', r.date);

  ELSIF period_type = '90d' OR (date_from IS NOT NULL AND (date_to - date_from) <= 180) THEN
    -- По месяцам
    RETURN QUERY
      SELECT
        TO_CHAR(DATE_TRUNC('month', r.date), 'TMMonth')::TEXT,
        DATE_TRUNC('month', r.date)::DATE,
        ROUND(SUM(r.amount) / 1000, 0)
      FROM revenue_records r
      WHERE r.date >= start_date AND r.date <= end_date
      GROUP BY DATE_TRUNC('month', r.date)
      ORDER BY DATE_TRUNC('month', r.date);

  ELSE
    -- По кварталам (1y)
    RETURN QUERY
      SELECT
        ('Q' || EXTRACT(QUARTER FROM r.date)::INT)::TEXT,
        DATE_TRUNC('quarter', r.date)::DATE,
        ROUND(SUM(r.amount) / 1000, 0)
      FROM revenue_records r
      WHERE r.date >= start_date AND r.date <= end_date
      GROUP BY DATE_TRUNC('quarter', r.date), EXTRACT(QUARTER FROM r.date)
      ORDER BY DATE_TRUNC('quarter', r.date);
  END IF;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 2. get_kpi_summary — KPI карточки для дашборда
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_kpi_summary(
  period_type TEXT DEFAULT '7d'
)
RETURNS TABLE (
  total_revenue      NUMERIC,
  revenue_change_pct NUMERIC,
  completed_orders   BIGINT,
  orders_change_pct  NUMERIC,
  avg_check          NUMERIC,
  avg_workshop_load  NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  days_count INT;
  cur_revenue NUMERIC;
  prev_revenue NUMERIC;
  cur_orders BIGINT;
  prev_orders BIGINT;
  cur_total NUMERIC;
  workshop_load NUMERIC;
BEGIN
  days_count := CASE period_type
    WHEN '7d'  THEN 7
    WHEN '30d' THEN 30
    WHEN '90d' THEN 90
    WHEN '1y'  THEN 365
    ELSE 7
  END;

  -- Текущий доход
  SELECT COALESCE(SUM(amount), 0) INTO cur_revenue
  FROM revenue_records
  WHERE date >= CURRENT_DATE - (days_count || ' days')::INTERVAL;

  -- Предыдущий доход
  SELECT COALESCE(SUM(amount), 0) INTO prev_revenue
  FROM revenue_records
  WHERE date >= CURRENT_DATE - (days_count * 2 || ' days')::INTERVAL
    AND date <  CURRENT_DATE - (days_count || ' days')::INTERVAL;

  -- Текущие заказы
  SELECT COUNT(*), COALESCE(SUM(total_amount), 0)
  INTO cur_orders, cur_total
  FROM orders
  WHERE status = 'completed'
    AND created_at >= CURRENT_DATE - (days_count || ' days')::INTERVAL;

  -- Предыдущие заказы
  SELECT COUNT(*) INTO prev_orders
  FROM orders
  WHERE status = 'completed'
    AND created_at >= CURRENT_DATE - (days_count * 2 || ' days')::INTERVAL
    AND created_at <  CURRENT_DATE - (days_count || ' days')::INTERVAL;

  -- Загрузка цехов
  SELECT ROUND(AVG(progress), 0) INTO workshop_load
  FROM workshops;

  RETURN QUERY SELECT
    cur_revenue,
    ROUND(((cur_revenue - prev_revenue) / NULLIF(prev_revenue, 0)) * 100, 1),
    cur_orders,
    ROUND(((cur_orders - prev_orders)::NUMERIC / NULLIF(prev_orders, 0)) * 100, 1),
    CASE WHEN cur_orders > 0 THEN ROUND(cur_total / cur_orders, 0) ELSE 0 END,
    workshop_load;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 3. get_order_structure — Структура заказов для doughnut chart
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_order_structure(
  period_days INT DEFAULT 30
)
RETURNS TABLE (
  product_name TEXT,
  items_count  BIGINT,
  percentage   NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT
      p.name::TEXT,
      COUNT(oi.id),
      ROUND(
        COUNT(oi.id) * 100.0 / NULLIF(SUM(COUNT(oi.id)) OVER (), 0), 1
      )
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN orders  o ON o.id = oi.order_id
    WHERE o.status = 'completed'
      AND o.created_at >= CURRENT_DATE - (period_days || ' days')::INTERVAL
    GROUP BY p.name
    ORDER BY COUNT(oi.id) DESC;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 4. get_workshop_progress — Прогресс цехов
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_workshop_progress()
RETURNS TABLE (
  workshop_id     INT,
  workshop_name   TEXT,
  shift           TEXT,
  operators       INT,
  progress        INT,
  revenue_30d     NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT
      w.id,
      w.name::TEXT,
      w.shift::TEXT,
      w.operators,
      w.progress,
      COALESCE(rev.total, 0)
    FROM workshops w
    LEFT JOIN (
      SELECT
        r.workshop_id AS wid,
        SUM(r.amount) AS total
      FROM revenue_records r
      WHERE r.date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY r.workshop_id
    ) rev ON rev.wid = w.id
    ORDER BY w.id;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 5. export_revenue_csv — Данные для CSV-экспорта
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION export_revenue_csv(
  date_from DATE DEFAULT '2025-01-01',
  date_to   DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  record_date  TEXT,
  amount       NUMERIC,
  workshop     TEXT,
  franchisee   TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT
      TO_CHAR(r.date, 'DD.MM.YYYY')::TEXT,
      r.amount,
      COALESCE(w.name, '—')::TEXT,
      COALESCE(f.name, '—')::TEXT
    FROM revenue_records r
    LEFT JOIN workshops   w ON w.id = r.workshop_id
    LEFT JOIN franchisees f ON f.id = r.franchisee_id
    WHERE r.date >= date_from
      AND r.date <= date_to
    ORDER BY r.date, w.name;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 6. export_orders_csv — Экспорт заказов для CSV
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION export_orders_csv(
  date_from DATE DEFAULT '2025-01-01',
  date_to   DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  order_date    TEXT,
  franchisee    TEXT,
  product       TEXT,
  quantity      INT,
  unit_price    NUMERIC,
  line_total    NUMERIC,
  order_total   NUMERIC,
  status        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT
      TO_CHAR(o.created_at, 'DD.MM.YYYY HH24:MI')::TEXT,
      COALESCE(f.name, '—')::TEXT,
      p.name::TEXT,
      oi.quantity,
      oi.unit_price,
      oi.line_total,
      o.total_amount,
      CASE o.status
        WHEN 'completed'   THEN 'Выполнен'
        WHEN 'pending'     THEN 'Ожидание'
        WHEN 'in_progress' THEN 'В работе'
        WHEN 'cancelled'   THEN 'Отменён'
      END::TEXT
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p     ON p.id = oi.product_id
    LEFT JOIN franchisees f ON f.id = o.franchisee_id
    WHERE o.created_at::DATE >= date_from
      AND o.created_at::DATE <= date_to
    ORDER BY o.created_at, o.id;
END;
$$;
