-- ============================================================
-- RETAIL STORE SALES FORECASTING DBMS
-- queries.sql — 10 Analytical Queries
-- DS-604 | THE INSIGHT EXPRESS
-- ============================================================

-- ============================================================
-- QUERY 1: Comprehensive Sales Report
-- 360° view: store, department, week, sales, holiday flag,
-- markdown spend, CPI, unemployment all in one place.
-- ============================================================
SELECT
    st.store_id,
    st.store_type,
    st.region,
    d.dept_name,
    s.sale_date,
    s.weekly_sales,
    s.is_holiday,
    COALESCE(f.markdown_1,0) + COALESCE(f.markdown_2,0) + COALESCE(f.markdown_3,0)
        + COALESCE(f.markdown_4,0) + COALESCE(f.markdown_5,0)  AS total_markdown,
    f.cpi,
    f.unemployment,
    f.fuel_price,
    h.holiday_name
FROM retail.sales          s
JOIN retail.store          st ON s.store_id = st.store_id
LEFT JOIN retail.department d  ON s.dept_id  = d.dept_id
LEFT JOIN retail.features   f  ON s.store_id = f.store_id AND s.sale_date = f.feature_date
LEFT JOIN retail.holiday    h  ON f.holiday_id = h.holiday_id
ORDER BY s.sale_date DESC, st.store_id;


-- ============================================================
-- QUERY 2: Holiday vs Non-Holiday Sales
-- Average weekly sales per store type split by holiday flag.
-- ============================================================
SELECT
    st.store_type,
    s.is_holiday,
    COUNT(*)                           AS num_weeks,
    ROUND(AVG(s.weekly_sales), 2)      AS avg_weekly_sales,
    ROUND(SUM(s.weekly_sales), 2)      AS total_sales
FROM retail.sales s
JOIN retail.store st ON s.store_id = st.store_id
GROUP BY st.store_type, s.is_holiday
ORDER BY st.store_type, s.is_holiday DESC;


-- ============================================================
-- QUERY 3: Markdown Effectiveness
-- For each store: total markdowns applied, average weekly_sales,
-- and a simple ratio to gauge markdown ROI.
-- ============================================================
SELECT
    s.store_id,
    st.store_type,
    ROUND(AVG(s.weekly_sales), 2)    AS avg_weekly_sales,
    ROUND(SUM(
        COALESCE(f.markdown_1,0) + COALESCE(f.markdown_2,0)
        + COALESCE(f.markdown_3,0) + COALESCE(f.markdown_4,0)
        + COALESCE(f.markdown_5,0)
    ), 2)                            AS total_markdown_spend,
    ROUND(
        AVG(s.weekly_sales) /
        NULLIF(AVG(
            COALESCE(f.markdown_1,0)+COALESCE(f.markdown_2,0)
            +COALESCE(f.markdown_3,0)+COALESCE(f.markdown_4,0)
            +COALESCE(f.markdown_5,0)
        ), 0)
    , 2)                             AS sales_per_markdown_dollar
FROM  retail.sales s
JOIN  retail.store st   ON s.store_id = st.store_id
LEFT JOIN retail.features f ON s.store_id = f.store_id AND s.sale_date = f.feature_date
GROUP BY s.store_id, st.store_type
ORDER BY avg_weekly_sales DESC;


-- ============================================================
-- QUERY 4: Monthly Demand Aggregation
-- Total and average weekly sales by department and month.
-- (Inventory and demand planning signal)
-- ============================================================
SELECT
    TO_CHAR(s.sale_date, 'YYYY-MM')   AS year_month,
    d.dept_name,
    COUNT(*)                           AS num_records,
    ROUND(SUM(s.weekly_sales), 2)      AS total_monthly_sales,
    ROUND(AVG(s.weekly_sales), 2)      AS avg_weekly_sales
FROM retail.sales s
LEFT JOIN retail.department d ON s.dept_id = d.dept_id
GROUP BY TO_CHAR(s.sale_date, 'YYYY-MM'), d.dept_name
ORDER BY year_month DESC, total_monthly_sales DESC;


-- ============================================================
-- QUERY 5: Store Type Performance Comparison
-- Compare A/B/C store types: revenue, avg sales, dept spread.
-- ============================================================
SELECT
    st.store_type,
    COUNT(DISTINCT st.store_id)         AS num_stores,
    COUNT(DISTINCT s.dept_id)           AS num_departments,
    ROUND(SUM(s.weekly_sales), 2)       AS total_revenue,
    ROUND(AVG(s.weekly_sales), 2)       AS avg_weekly_sales,
    ROUND(AVG(st.store_size), 0)        AS avg_store_size
FROM retail.sales s
JOIN retail.store st ON s.store_id = st.store_id
GROUP BY st.store_type
ORDER BY total_revenue DESC;


-- ============================================================
-- QUERY 6: Department Sales Outlier Analysis (IQR method)
-- Identifies departments with weekly_sales outside the
-- Q1 − 1.5*IQR … Q3 + 1.5*IQR fence.
-- ============================================================
WITH percentiles AS (
    SELECT
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY weekly_sales) AS q1,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY weekly_sales) AS q3
    FROM retail.sales
),
bounds AS (
    SELECT
        q1,
        q3,
        q1 - 1.5 * (q3 - q1) AS lower_bound,
        q3 + 1.5 * (q3 - q1) AS upper_bound
    FROM percentiles
)
SELECT
    s.store_id,
    d.dept_name,
    s.sale_date,
    s.weekly_sales,
    b.lower_bound,
    b.upper_bound,
    CASE
        WHEN s.weekly_sales > b.upper_bound THEN 'High Outlier'
        WHEN s.weekly_sales < b.lower_bound THEN 'Low Outlier'
    END AS outlier_type
FROM retail.sales s
CROSS JOIN bounds b
LEFT JOIN retail.department d ON s.dept_id = d.dept_id
WHERE s.weekly_sales < b.lower_bound OR s.weekly_sales > b.upper_bound
ORDER BY s.weekly_sales DESC;


-- ============================================================
-- QUERY 7: CPI & Unemployment Impact on Sales
-- Buckets CPI and unemployment into ranges, shows avg sales.
-- ============================================================
SELECT
    CASE
        WHEN f.cpi < 130  THEN 'Low CPI (<130)'
        WHEN f.cpi < 160  THEN 'Mid CPI (130-160)'
        ELSE                   'High CPI (>160)'
    END                              AS cpi_bucket,
    CASE
        WHEN f.unemployment < 6  THEN 'Low Unemployment (<6%)'
        WHEN f.unemployment < 9  THEN 'Mid Unemployment (6-9%)'
        ELSE                          'High Unemployment (>9%)'
    END                              AS unemployment_bucket,
    COUNT(*)                         AS num_records,
    ROUND(AVG(s.weekly_sales), 2)    AS avg_weekly_sales,
    ROUND(SUM(s.weekly_sales), 2)    AS total_sales
FROM retail.sales s
JOIN retail.features f ON s.store_id = f.store_id AND s.sale_date = f.feature_date
WHERE f.cpi IS NOT NULL AND f.unemployment IS NOT NULL
GROUP BY cpi_bucket, unemployment_bucket
ORDER BY avg_weekly_sales DESC;


-- ============================================================
-- QUERY 8: Fuel Price vs Sales Sensitivity
-- Groups fuel price into buckets and shows average sales.
-- Useful for detecting cost-of-living demand compression.
-- ============================================================
SELECT
    CASE
        WHEN f.fuel_price < 3.0 THEN 'Cheap Fuel  (<$3.00)'
        WHEN f.fuel_price < 3.5 THEN 'Normal Fuel ($3.00-3.50)'
        WHEN f.fuel_price < 4.0 THEN 'High Fuel   ($3.50-4.00)'
        ELSE                         'Very High   (>$4.00)'
    END                               AS fuel_bucket,
    COUNT(*)                          AS num_records,
    ROUND(AVG(s.weekly_sales), 2)     AS avg_weekly_sales,
    ROUND(MIN(s.weekly_sales), 2)     AS min_weekly_sales,
    ROUND(MAX(s.weekly_sales), 2)     AS max_weekly_sales
FROM retail.sales s
JOIN retail.features f ON s.store_id = f.store_id AND s.sale_date = f.feature_date
WHERE f.fuel_price IS NOT NULL
GROUP BY fuel_bucket
ORDER BY avg_weekly_sales DESC;


-- ============================================================
-- QUERY 9: Top Departments by Total Revenue
-- Ranks all departments by total and average sales.
-- Input to shelf space / investment prioritization.
-- ============================================================
SELECT
    d.dept_id,
    d.dept_name,
    COUNT(DISTINCT s.store_id)             AS stores_carrying,
    COUNT(*)                               AS num_weekly_records,
    ROUND(SUM(s.weekly_sales), 2)          AS total_revenue,
    ROUND(AVG(s.weekly_sales), 2)          AS avg_weekly_sales,
    RANK() OVER (ORDER BY SUM(s.weekly_sales) DESC) AS revenue_rank
FROM retail.sales s
LEFT JOIN retail.department d ON s.dept_id = d.dept_id
GROUP BY d.dept_id, d.dept_name
ORDER BY total_revenue DESC;


-- ============================================================
-- QUERY 10: Data Quality & Orphan Detection
-- Checks for: orphan sales rows, missing features, NULL fields,
-- negative sales (belt-and-suspenders beyond CHECK constraint).
-- ============================================================
WITH dq_checks AS (

    SELECT 'Sales with no matching Store' AS issue_type, COUNT(*) AS issue_count
    FROM retail.sales s
    LEFT JOIN retail.store st ON s.store_id = st.store_id
    WHERE st.store_id IS NULL

    UNION ALL

    SELECT 'Sales with no matching Department', COUNT(*)
    FROM retail.sales s
    LEFT JOIN retail.department d ON s.dept_id = d.dept_id
    WHERE d.dept_id IS NULL

    UNION ALL

    SELECT 'Sales rows with NULL weekly_sales', COUNT(*)
    FROM retail.sales
    WHERE weekly_sales IS NULL

    UNION ALL

    SELECT 'Sales rows with Negative weekly_sales', COUNT(*)
    FROM retail.sales
    WHERE weekly_sales < 0

    UNION ALL

    SELECT 'Features with NULL CPI', COUNT(*)
    FROM retail.features
    WHERE cpi IS NULL

    UNION ALL

    SELECT 'Features with NULL Unemployment', COUNT(*)
    FROM retail.features
    WHERE unemployment IS NULL

    UNION ALL

    SELECT 'Features with NULL Fuel Price', COUNT(*)
    FROM retail.features
    WHERE fuel_price IS NULL

    UNION ALL

    SELECT 'Stores with no Sales at all', COUNT(*)
    FROM retail.store st
    LEFT JOIN retail.sales s ON st.store_id = s.store_id
    WHERE s.store_id IS NULL

    UNION ALL

    SELECT 'Sales rows with no Feature record', COUNT(*)
    FROM retail.sales s
    LEFT JOIN retail.features f ON s.store_id = f.store_id AND s.sale_date = f.feature_date
    WHERE f.feature_id IS NULL
)
SELECT * FROM dq_checks
ORDER BY issue_count DESC;
