-- ============================================================
-- RETAIL STORE SALES FORECASTING DBMS
-- views.sql — Reusable Views
-- ============================================================

-- ============================================================
-- VIEW 1: vw_holiday_sales_uplift
-- Usage: SELECT * FROM retail.vw_holiday_sales_uplift;
-- ============================================================
CREATE OR REPLACE VIEW retail.vw_holiday_sales_uplift AS
WITH base AS (
    SELECT
        st.store_type,
        s.is_holiday,
        AVG(s.weekly_sales) AS avg_sales
    FROM retail.sales s
    JOIN retail.store st ON s.store_id = st.store_id
    GROUP BY st.store_type, s.is_holiday
)
SELECT
    store_type,
    ROUND(MAX(CASE WHEN is_holiday     THEN avg_sales END)::numeric, 2) AS avg_holiday_sales,
    ROUND(MAX(CASE WHEN NOT is_holiday THEN avg_sales END)::numeric, 2) AS avg_regular_sales,
    ROUND(
        (MAX(CASE WHEN is_holiday THEN avg_sales END)::numeric
         - MAX(CASE WHEN NOT is_holiday THEN avg_sales END)::numeric)
        / NULLIF(MAX(CASE WHEN NOT is_holiday THEN avg_sales END)::numeric, 0) * 100
    , 2) AS uplift_pct
FROM base
GROUP BY store_type
ORDER BY store_type;

-- ============================================================
-- VIEW 2: vw_markdown_effectiveness
-- Usage: SELECT * FROM retail.vw_markdown_effectiveness ORDER BY markdown_roi DESC;
-- ============================================================
CREATE OR REPLACE VIEW retail.vw_markdown_effectiveness AS
SELECT
    s.store_id,
    st.store_type,
    st.region,
    COUNT(DISTINCT s.sale_date) AS weeks_tracked,
    ROUND(AVG(s.weekly_sales)::numeric, 2) AS avg_weekly_sales,
    ROUND(SUM(
        COALESCE(f.markdown_1,0) + COALESCE(f.markdown_2,0)
        + COALESCE(f.markdown_3,0) + COALESCE(f.markdown_4,0)
        + COALESCE(f.markdown_5,0)
    )::numeric, 2) AS total_markdown_spend,
    ROUND(AVG(
        COALESCE(f.markdown_1,0) + COALESCE(f.markdown_2,0)
        + COALESCE(f.markdown_3,0) + COALESCE(f.markdown_4,0)
        + COALESCE(f.markdown_5,0)
    )::numeric, 2) AS avg_weekly_markdown,
    ROUND(
        (AVG(s.weekly_sales)::numeric) /
        NULLIF(AVG(
            COALESCE(f.markdown_1,0) + COALESCE(f.markdown_2,0)
            + COALESCE(f.markdown_3,0) + COALESCE(f.markdown_4,0)
            + COALESCE(f.markdown_5,0)
        )::numeric, 0)
    , 2) AS markdown_roi
FROM  retail.sales s
JOIN  retail.store st   ON s.store_id = st.store_id
LEFT JOIN retail.features f ON s.store_id = f.store_id AND s.sale_date = f.feature_date
GROUP BY s.store_id, st.store_type, st.region
ORDER BY avg_weekly_sales DESC;

-- ============================================================
-- VIEW 3: vw_top_departments_by_revenue
-- Usage: SELECT * FROM retail.vw_top_departments_by_revenue LIMIT 20;
-- ============================================================
CREATE OR REPLACE VIEW retail.vw_top_departments_by_revenue AS
SELECT
    d.dept_id,
    COALESCE(d.dept_name, 'Dept ' || d.dept_id) AS dept_name,
    COUNT(DISTINCT s.store_id) AS stores_carrying,
    COUNT(*) AS total_weekly_records,
    ROUND(SUM(s.weekly_sales)::numeric, 2) AS total_revenue,
    ROUND(AVG(s.weekly_sales)::numeric, 2) AS avg_weekly_sales,
    ROUND(MAX(s.weekly_sales)::numeric, 2) AS peak_weekly_sales,
    RANK() OVER (ORDER BY SUM(s.weekly_sales) DESC) AS revenue_rank
FROM retail.sales s
LEFT JOIN retail.department d ON s.dept_id = d.dept_id
GROUP BY d.dept_id, d.dept_name
ORDER BY total_revenue DESC;

-- ============================================================
-- VIEW 4: vw_store_weekly_summary
-- Usage: SELECT * FROM retail.vw_store_weekly_summary;
-- ============================================================
CREATE OR REPLACE VIEW retail.vw_store_weekly_summary AS
SELECT
    s.store_id,
    st.store_type,
    st.region,
    s.sale_date,
    SUM(s.weekly_sales) AS total_weekly_sales,
    BOOL_OR(s.is_holiday) AS is_holiday,
    COUNT(DISTINCT s.dept_id) AS active_departments,
    f.temperature,
    f.fuel_price,
    COALESCE(f.markdown_1,0) + COALESCE(f.markdown_2,0)
        + COALESCE(f.markdown_3,0) + COALESCE(f.markdown_4,0)
        + COALESCE(f.markdown_5,0) AS total_markdown,
    f.cpi,
    f.unemployment
FROM retail.sales s
JOIN  retail.store st   ON s.store_id = st.store_id
LEFT JOIN retail.features f ON s.store_id = f.store_id AND s.sale_date = f.feature_date
GROUP BY
    s.store_id, st.store_type, st.region, s.sale_date,
    f.temperature, f.fuel_price,
    f.markdown_1, f.markdown_2, f.markdown_3, f.markdown_4, f.markdown_5,
    f.cpi, f.unemployment
ORDER BY s.store_id, s.sale_date;
