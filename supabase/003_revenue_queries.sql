-- ============================================================
-- AVISHU CRM — 003_revenue_queries.sql
-- SQL-запросы доходов: неделя, месяц, 3 месяца, год, календарь
-- ИСПРАВЛЕНО: $1/$2 заменены на реальные значения
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1. ДОХОД ЗА ПОСЛЕДНИЕ 7 ДНЕЙ (по дням)
-- ══════════════════════════════════════════════════════════════
SELECT
  r.date,
  TO_CHAR(r.date, 'Dy') AS day_name,
  SUM(r.amount)          AS daily_revenue
FROM revenue_records r
WHERE r.date >= CURRENT_DATE - INTERVAL '7 days'
  AND r.date <= CURRENT_DATE
GROUP BY r.date
ORDER BY r.date;

-- Итого за 7 дней
SELECT
  SUM(amount)   AS total_revenue_7d,
  COUNT(*)      AS records_count
FROM revenue_records
WHERE date >= CURRENT_DATE - INTERVAL '7 days';

-- ══════════════════════════════════════════════════════════════
-- 2. ДОХОД ЗА 30 ДНЕЙ (по неделям)
-- ══════════════════════════════════════════════════════════════
SELECT
  'Нед ' || EXTRACT(WEEK FROM r.date)::TEXT AS week_label,
  DATE_TRUNC('week', r.date)::DATE          AS week_start,
  SUM(r.amount)                              AS weekly_revenue
FROM revenue_records r
WHERE r.date >= CURRENT_DATE - INTERVAL '30 days'
  AND r.date <= CURRENT_DATE
GROUP BY DATE_TRUNC('week', r.date), EXTRACT(WEEK FROM r.date)
ORDER BY week_start;

-- Итого за 30 дней
SELECT
  SUM(amount)   AS total_revenue_30d,
  COUNT(*)      AS records_count
FROM revenue_records
WHERE date >= CURRENT_DATE - INTERVAL '30 days';

-- ══════════════════════════════════════════════════════════════
-- 3. ДОХОД ЗА 3 МЕСЯЦА (по месяцам)
-- ══════════════════════════════════════════════════════════════
SELECT
  TO_CHAR(DATE_TRUNC('month', r.date), 'TMMonth YYYY') AS month_label,
  DATE_TRUNC('month', r.date)::DATE                     AS month_start,
  SUM(r.amount)                                          AS monthly_revenue
FROM revenue_records r
WHERE r.date >= CURRENT_DATE - INTERVAL '3 months'
  AND r.date <= CURRENT_DATE
GROUP BY DATE_TRUNC('month', r.date)
ORDER BY month_start;

-- Итого за 3 месяца
SELECT
  SUM(amount)   AS total_revenue_90d,
  COUNT(*)      AS records_count
FROM revenue_records
WHERE date >= CURRENT_DATE - INTERVAL '3 months';

-- ══════════════════════════════════════════════════════════════
-- 4. ДОХОД ЗА ГОД (по кварталам)
-- ══════════════════════════════════════════════════════════════
SELECT
  'Q' || EXTRACT(QUARTER FROM r.date)::TEXT AS quarter_label,
  DATE_TRUNC('quarter', r.date)::DATE       AS quarter_start,
  SUM(r.amount)                              AS quarterly_revenue
FROM revenue_records r
WHERE r.date >= CURRENT_DATE - INTERVAL '1 year'
  AND r.date <= CURRENT_DATE
GROUP BY DATE_TRUNC('quarter', r.date), EXTRACT(QUARTER FROM r.date)
ORDER BY quarter_start;

-- Итого за год
SELECT
  SUM(amount)   AS total_revenue_1y,
  COUNT(*)      AS records_count
FROM revenue_records
WHERE date >= CURRENT_DATE - INTERVAL '1 year';

-- ══════════════════════════════════════════════════════════════
-- 5. ДОХОД ЗА ПРОИЗВОЛЬНЫЙ ПЕРИОД (календарь)
-- Примерные даты: 2025-01-01 — 2025-03-28
-- ══════════════════════════════════════════════════════════════
-- 5а. По дням (если период ≤ 31 день)
SELECT
  r.date,
  TO_CHAR(r.date, 'DD.MM') AS date_label,
  SUM(r.amount)             AS daily_revenue
FROM revenue_records r
WHERE r.date >= '2025-01-01'::DATE
  AND r.date <= CURRENT_DATE
GROUP BY r.date
ORDER BY r.date;

-- 5б. По неделям (если период > 31 день)
SELECT
  DATE_TRUNC('week', r.date)::DATE AS week_start,
  SUM(r.amount)                     AS weekly_revenue
FROM revenue_records r
WHERE r.date >= '2025-01-01'::DATE
  AND r.date <= CURRENT_DATE
GROUP BY DATE_TRUNC('week', r.date)
ORDER BY week_start;

-- ══════════════════════════════════════════════════════════════
-- 6. СРАВНЕНИЕ С ПРЕДЫДУЩИМ ПЕРИОДОМ (% изменения)
-- ══════════════════════════════════════════════════════════════
WITH current_period AS (
  SELECT SUM(amount) AS revenue
  FROM revenue_records
  WHERE date >= CURRENT_DATE - INTERVAL '7 days'
),
previous_period AS (
  SELECT SUM(amount) AS revenue
  FROM revenue_records
  WHERE date >= CURRENT_DATE - INTERVAL '14 days'
    AND date <  CURRENT_DATE - INTERVAL '7 days'
)
SELECT
  cp.revenue                                        AS current_revenue,
  pp.revenue                                        AS previous_revenue,
  ROUND(
    ((cp.revenue - pp.revenue) / NULLIF(pp.revenue, 0)) * 100, 1
  )                                                  AS change_percent,
  CASE
    WHEN cp.revenue > pp.revenue THEN 'up'
    WHEN cp.revenue < pp.revenue THEN 'down'
    ELSE 'flat'
  END                                                AS trend
FROM current_period cp, previous_period pp;

-- ══════════════════════════════════════════════════════════════
-- 7. ДОХОД ПО ФРАНЧАЙЗИ ЗА ПЕРИОД
-- ══════════════════════════════════════════════════════════════
SELECT
  f.name                 AS franchisee_name,
  f.city                 AS franchisee_city,
  SUM(r.amount)          AS total_revenue,
  COUNT(DISTINCT r.date) AS active_days
FROM revenue_records r
JOIN franchisees f ON f.id = r.franchisee_id
WHERE r.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY f.id, f.name, f.city
ORDER BY total_revenue DESC;

-- ══════════════════════════════════════════════════════════════
-- 8. ДОХОД ПО ЦЕХАМ ЗА ПЕРИОД
-- ══════════════════════════════════════════════════════════════
SELECT
  w.name                AS workshop_name,
  SUM(r.amount)         AS workshop_revenue,
  COUNT(*)              AS records_count,
  ROUND(AVG(r.amount))  AS avg_daily_revenue
FROM revenue_records r
JOIN workshops w ON w.id = r.workshop_id
WHERE r.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY w.id, w.name
ORDER BY workshop_revenue DESC;
