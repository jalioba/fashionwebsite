-- ============================================================
-- AVISHU CRM — 005_csv_export.sql
-- SQL-запросы для экспорта в CSV-файлы
-- ИСПРАВЛЕНО: $1/$2 заменены на реальные значения
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1. CSV ЭКСПОРТ: ДОХОДЫ ЗА ПЕРИОД
-- Файл: avishu_revenue.csv
-- ══════════════════════════════════════════════════════════════
SELECT
  TO_CHAR(r.date, 'DD.MM.YYYY')   AS "Дата",
  r.amount                         AS "Сумма (₸)",
  COALESCE(w.name, '—')           AS "Цех",
  COALESCE(f.name, '—')           AS "Франчайзи"
FROM revenue_records r
LEFT JOIN workshops   w ON w.id = r.workshop_id
LEFT JOIN franchisees f ON f.id = r.franchisee_id
WHERE r.date >= CURRENT_DATE - INTERVAL '30 days'
  AND r.date <= CURRENT_DATE
ORDER BY r.date, w.name;

-- ══════════════════════════════════════════════════════════════
-- 2. CSV ЭКСПОРТ: ЗАКАЗЫ ЗА ПЕРИОД
-- Файл: avishu_orders.csv
-- ══════════════════════════════════════════════════════════════
SELECT
  ROW_NUMBER() OVER (ORDER BY o.created_at) AS "№",
  TO_CHAR(o.created_at, 'DD.MM.YYYY HH24:MI') AS "Дата",
  COALESCE(f.name, '—')                       AS "Франчайзи",
  p.name                                       AS "Товар",
  oi.quantity                                  AS "Кол-во",
  oi.unit_price                                AS "Цена за ед. (₸)",
  oi.line_total                                AS "Сумма позиции (₸)",
  o.total_amount                               AS "Итого заказ (₸)",
  CASE o.status
    WHEN 'completed'   THEN 'Выполнен'
    WHEN 'pending'     THEN 'Ожидание'
    WHEN 'in_progress' THEN 'В работе'
    WHEN 'cancelled'   THEN 'Отменён'
  END                                          AS "Статус"
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p     ON p.id = oi.product_id
LEFT JOIN franchisees f ON f.id = o.franchisee_id
WHERE o.created_at::DATE >= CURRENT_DATE - INTERVAL '30 days'
  AND o.created_at::DATE <= CURRENT_DATE
ORDER BY o.created_at, o.id;

-- ══════════════════════════════════════════════════════════════
-- 3. CSV ЭКСПОРТ: KPI СВОДКА ЗА ПЕРИОД (30 дней)
-- ══════════════════════════════════════════════════════════════
SELECT
  'Доход за период'     AS "Метрика",
  TO_CHAR(SUM(r.amount), 'FM999,999,999') || ' ₸' AS "Значение"
FROM revenue_records r
WHERE r.date >= CURRENT_DATE - INTERVAL '30 days'

UNION ALL

SELECT
  'Заказов выполнено',
  COUNT(*)::TEXT
FROM orders
WHERE status = 'completed'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'

UNION ALL

SELECT
  'Средний чек',
  TO_CHAR(ROUND(AVG(total_amount)), 'FM999,999') || ' ₸'
FROM orders
WHERE status = 'completed'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'

UNION ALL

SELECT
  'Средняя загрузка цехов',
  ROUND(AVG(progress))::TEXT || '%'
FROM workshops;

-- ══════════════════════════════════════════════════════════════
-- 4. CSV ЭКСПОРТ: ПРОГРЕСС ЦЕХОВ
-- ══════════════════════════════════════════════════════════════
SELECT
  w.name                                    AS "Цех",
  w.shift                                   AS "Смена",
  w.operators                               AS "Операторов",
  w.progress || '%'                         AS "Прогресс",
  TO_CHAR(w.updated_at, 'DD.MM.YYYY HH24:MI') AS "Обновлено",
  TO_CHAR(COALESCE(rev.total, 0), 'FM999,999,999') || ' ₸' AS "Доход за 30д"
FROM workshops w
LEFT JOIN (
  SELECT workshop_id, SUM(amount) AS total
  FROM revenue_records
  WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY workshop_id
) rev ON rev.workshop_id = w.id
ORDER BY w.id;

-- ══════════════════════════════════════════════════════════════
-- 5. CSV ЭКСПОРТ: ДОХОД ПО ДНЯМ (для графика)
-- ══════════════════════════════════════════════════════════════
SELECT
  TO_CHAR(r.date, 'DD.MM.YYYY') AS "Дата",
  SUM(r.amount)                   AS "Доход (₸)",
  COUNT(*)                        AS "Кол-во записей"
FROM revenue_records r
WHERE r.date >= CURRENT_DATE - INTERVAL '30 days'
  AND r.date <= CURRENT_DATE
GROUP BY r.date
ORDER BY r.date;

-- ══════════════════════════════════════════════════════════════
-- 6. CSV ЭКСПОРТ: СТРУКТУРА ЗАКАЗОВ ПО КАТЕГОРИЯМ
-- ══════════════════════════════════════════════════════════════
SELECT
  p.name                         AS "Категория",
  COUNT(oi.id)                   AS "Кол-во позиций",
  SUM(oi.line_total)             AS "Сумма (₸)",
  ROUND(
    COUNT(oi.id) * 100.0 / NULLIF(SUM(COUNT(oi.id)) OVER (), 0), 1
  )                              AS "Доля (%)"
FROM order_items oi
JOIN products p ON p.id = oi.product_id
JOIN orders  o ON o.id = oi.order_id
WHERE o.status = 'completed'
  AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY p.name
ORDER BY "Кол-во позиций" DESC;
