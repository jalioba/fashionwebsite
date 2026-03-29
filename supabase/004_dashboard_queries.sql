-- ============================================================
-- AVISHU CRM — 004_dashboard_queries.sql
-- SQL-запросы для Chart.js графиков и KPI карточек
-- ИСПРАВЛЕНО: $1 заменён на реальные значения (7/30/90/365)
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1. KPI КАРТОЧКИ (4 метрики)
-- Соответствует: kpiRevenue, kpiOrders, kpiAvg, kpiLoad
-- Пример для периода 7 дней
-- ══════════════════════════════════════════════════════════════

-- 1а. Доход за период (7 дней) + % изменения
WITH current_p AS (
  SELECT COALESCE(SUM(amount), 0) AS revenue
  FROM revenue_records
  WHERE date >= CURRENT_DATE - INTERVAL '7 days'
),
previous_p AS (
  SELECT COALESCE(SUM(amount), 0) AS revenue
  FROM revenue_records
  WHERE date >= CURRENT_DATE - INTERVAL '14 days'
    AND date <  CURRENT_DATE - INTERVAL '7 days'
)
SELECT
  cp.revenue                                                    AS total_revenue,
  pp.revenue                                                    AS prev_revenue,
  ROUND(((cp.revenue - pp.revenue) / NULLIF(pp.revenue, 0)) * 100, 1) AS revenue_change_pct
FROM current_p cp, previous_p pp;

-- 1б. Заказов выполнено (7 дней) + % изменения
WITH current_orders AS (
  SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS total
  FROM orders
  WHERE status = 'completed'
    AND created_at >= CURRENT_DATE - INTERVAL '7 days'
),
prev_orders AS (
  SELECT COUNT(*) AS cnt
  FROM orders
  WHERE status = 'completed'
    AND created_at >= CURRENT_DATE - INTERVAL '14 days'
    AND created_at <  CURRENT_DATE - INTERVAL '7 days'
)
SELECT
  co.cnt                                                        AS completed_orders,
  co.total                                                      AS orders_total,
  ROUND(co.total::NUMERIC / NULLIF(co.cnt, 0), 0)              AS avg_check,
  ROUND(((co.cnt - po.cnt)::NUMERIC / NULLIF(po.cnt, 0)) * 100, 1) AS orders_change_pct
FROM current_orders co, prev_orders po;

-- 1в. Средняя загрузка цехов
SELECT
  ROUND(AVG(progress), 0) AS avg_workshop_load
FROM workshops;

-- ══════════════════════════════════════════════════════════════
-- 2. LINE CHART — Доход по дням / неделям / месяцам / кварталам
-- Для Chart.js revenueChart
-- ══════════════════════════════════════════════════════════════

-- 2а. По дням (период '7d')
SELECT
  TO_CHAR(r.date, 'Dy')  AS label,
  r.date,
  ROUND(SUM(r.amount) / 1000, 0) AS revenue_thousands
FROM revenue_records r
WHERE r.date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY r.date
ORDER BY r.date;

-- 2б. По неделям (период '30d')
SELECT
  'Нед ' || ROW_NUMBER() OVER (ORDER BY DATE_TRUNC('week', r.date)) AS label,
  DATE_TRUNC('week', r.date)::DATE AS week_start,
  ROUND(SUM(r.amount) / 1000, 0)  AS revenue_thousands
FROM revenue_records r
WHERE r.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('week', r.date)
ORDER BY week_start;

-- 2в. По месяцам (период '90d')
SELECT
  TO_CHAR(DATE_TRUNC('month', r.date), 'TMMonth') AS label,
  DATE_TRUNC('month', r.date)::DATE                AS month_start,
  ROUND(SUM(r.amount) / 1000, 0)                  AS revenue_thousands
FROM revenue_records r
WHERE r.date >= CURRENT_DATE - INTERVAL '3 months'
GROUP BY DATE_TRUNC('month', r.date)
ORDER BY month_start;

-- 2г. По кварталам (период '1y')
SELECT
  'Q' || EXTRACT(QUARTER FROM r.date)::INT AS label,
  DATE_TRUNC('quarter', r.date)::DATE       AS quarter_start,
  ROUND(SUM(r.amount) / 1000, 0)           AS revenue_thousands
FROM revenue_records r
WHERE r.date >= CURRENT_DATE - INTERVAL '1 year'
GROUP BY DATE_TRUNC('quarter', r.date), EXTRACT(QUARTER FROM r.date)
ORDER BY quarter_start;

-- ══════════════════════════════════════════════════════════════
-- 3. DOUGHNUT CHART — Структура заказов по категориям
-- Для Chart.js ordersChart
-- ══════════════════════════════════════════════════════════════
SELECT
  p.name                                      AS product_name,
  COUNT(oi.id)                                AS items_count,
  ROUND(
    COUNT(oi.id) * 100.0 / NULLIF(SUM(COUNT(oi.id)) OVER (), 0),
    1
  )                                            AS percentage
FROM order_items oi
JOIN products p ON p.id = oi.product_id
JOIN orders  o ON o.id = oi.order_id
WHERE o.status = 'completed'
  AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY p.name
ORDER BY items_count DESC;

-- ══════════════════════════════════════════════════════════════
-- 4. WORKSHOP PROGRESS — Прогресс цехов
-- ══════════════════════════════════════════════════════════════
SELECT
  w.id,
  w.name,
  w.shift,
  w.operators,
  w.progress,
  w.updated_at,
  COALESCE(rev.total, 0) AS workshop_revenue_30d
FROM workshops w
LEFT JOIN (
  SELECT
    workshop_id,
    SUM(amount) AS total
  FROM revenue_records
  WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY workshop_id
) rev ON rev.workshop_id = w.id
ORDER BY w.id;

-- ══════════════════════════════════════════════════════════════
-- 5. TOP-10 ЗАКАЗОВ ПО СУММЕ
-- ══════════════════════════════════════════════════════════════
SELECT
  o.id,
  f.name                        AS franchisee,
  o.total_amount,
  o.status,
  o.created_at::DATE            AS order_date,
  COUNT(oi.id)                  AS items_count
FROM orders o
LEFT JOIN franchisees f  ON f.id = o.franchisee_id
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY o.id, f.name, o.total_amount, o.status, o.created_at
ORDER BY o.total_amount DESC
LIMIT 10;
