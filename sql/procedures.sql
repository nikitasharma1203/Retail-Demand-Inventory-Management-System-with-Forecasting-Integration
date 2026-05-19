-- ============================================================
-- RETAIL STORE SALES FORECASTING DBMS
-- procedures.sql — Stored Procedures & Functions
-- ============================================================

-- ============================================================
-- PROCEDURE 1: Generate Monthly Demand Report
-- Usage: CALL retail.sp_monthly_demand_report(2011, 11);
-- ============================================================
CREATE OR REPLACE PROCEDURE retail.sp_monthly_demand_report(
    p_year  INTEGER,
    p_month INTEGER
)
LANGUAGE plpgsql AS $$
DECLARE
    rec RECORD;
    v_total_sales DECIMAL(14,2);
BEGIN
    -- Two placeholders for two arguments
    RAISE NOTICE '=== Monthly Demand Report: Month % / Year % ===', p_month, p_year;

    SELECT SUM(weekly_sales) INTO v_total_sales
    FROM   retail.sales
    WHERE  EXTRACT(YEAR  FROM sale_date) = p_year
    AND    EXTRACT(MONTH FROM sale_date) = p_month;

    RAISE NOTICE 'Total Revenue for the month: $%', ROUND(v_total_sales, 2);
    RAISE NOTICE '--- Top 10 Departments ---';

    FOR rec IN (
        SELECT
            d.dept_name,
            SUM(s.weekly_sales)                           AS dept_revenue,
            ROUND(SUM(s.weekly_sales) / v_total_sales * 100, 2) AS pct_share
        FROM  retail.sales s
        JOIN  retail.department d ON s.dept_id = d.dept_id
        WHERE EXTRACT(YEAR  FROM s.sale_date) = p_year
        AND   EXTRACT(MONTH FROM s.sale_date) = p_month
        GROUP BY d.dept_name
        ORDER BY dept_revenue DESC
        LIMIT 10
    )
    LOOP
        -- Three placeholders for three arguments
        RAISE NOTICE '  Dept: % | Revenue: $% | Share: %',
            rec.dept_name, ROUND(rec.dept_revenue,2), rec.pct_share;
    END LOOP;

    RAISE NOTICE '=== End of Report ===';
END;
$$;

-- ============================================================
-- PROCEDURE 2: Calculate Holiday Sales Uplift
-- Usage: CALL retail.sp_holiday_uplift();
-- ============================================================
CREATE OR REPLACE PROCEDURE retail.sp_holiday_uplift()
LANGUAGE plpgsql AS $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '=== Holiday Sales Uplift by Store Type ===';

    FOR rec IN (
        SELECT
            st.store_type,
            ROUND(AVG(CASE WHEN s.is_holiday THEN s.weekly_sales END), 2)      AS avg_holiday_sales,
            ROUND(AVG(CASE WHEN NOT s.is_holiday THEN s.weekly_sales END), 2)  AS avg_regular_sales,
            ROUND(
                (AVG(CASE WHEN s.is_holiday THEN s.weekly_sales END)
                 - AVG(CASE WHEN NOT s.is_holiday THEN s.weekly_sales END))
                / NULLIF(AVG(CASE WHEN NOT s.is_holiday THEN s.weekly_sales END), 0) * 100,
            2)                                                                   AS uplift_pct
        FROM  retail.sales s
        JOIN  retail.store st ON s.store_id = st.store_id
        GROUP BY st.store_type
        ORDER BY st.store_type
    )
    LOOP
        -- Four placeholders for four arguments
        RAISE NOTICE '  Store Type % | Holiday Avg: $% | Regular Avg: $% | Uplift: %',
            rec.store_type, rec.avg_holiday_sales, rec.avg_regular_sales, rec.uplift_pct;
    END LOOP;

    RAISE NOTICE '=== End of Uplift Report ===';
END;
$$;

-- ============================================================
-- FUNCTION: fn_store_weekly_summary
-- Usage: SELECT * FROM retail.fn_store_weekly_summary(1);
-- ============================================================
CREATE OR REPLACE FUNCTION retail.fn_store_weekly_summary(p_store_id INTEGER)
RETURNS TABLE (
    sale_date    DATE,
    total_sales  DECIMAL(14,2),
    is_holiday   BOOLEAN,
    dept_count   BIGINT
)
LANGUAGE sql STABLE AS $$
    SELECT
        s.sale_date,
        SUM(s.weekly_sales)    AS total_sales,
        BOOL_OR(s.is_holiday)  AS is_holiday,
        COUNT(DISTINCT s.dept_id) AS dept_count
    FROM   retail.sales s
    WHERE  s.store_id = p_store_id
    GROUP  BY s.sale_date
    ORDER  BY s.sale_date;
$$;

-- ============================================================
-- PROCEDURE 3: Atomic Insert — Sales + Features Together
-- ============================================================
CREATE OR REPLACE PROCEDURE retail.sp_insert_sales_with_features(
    p_store_id      INTEGER,
    p_dept_id       INTEGER,
    p_sale_date     DATE,
    p_weekly_sales  DECIMAL(12,2),
    p_is_holiday    BOOLEAN,
    p_temperature   DECIMAL(6,2)  DEFAULT NULL,
    p_fuel_price    DECIMAL(6,3)  DEFAULT NULL,
    p_markdown_1    DECIMAL(10,2) DEFAULT 0,
    p_markdown_2    DECIMAL(10,2) DEFAULT 0,
    p_markdown_3    DECIMAL(10,2) DEFAULT 0,
    p_markdown_4    DECIMAL(10,2) DEFAULT 0,
    p_markdown_5    DECIMAL(10,2) DEFAULT 0,
    p_cpi           DECIMAL(10,4) DEFAULT NULL,
    p_unemployment  DECIMAL(6,3)  DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO retail.sales (store_id, dept_id, sale_date, weekly_sales, is_holiday)
    VALUES (p_store_id, p_dept_id, p_sale_date, p_weekly_sales, p_is_holiday);

    INSERT INTO retail.features
        (store_id, feature_date, temperature, fuel_price,
         markdown_1, markdown_2, markdown_3, markdown_4, markdown_5,
         cpi, unemployment, is_holiday)
    VALUES
        (p_store_id, p_sale_date, p_temperature, p_fuel_price,
         p_markdown_1, p_markdown_2, p_markdown_3, p_markdown_4, p_markdown_5,
         p_cpi, p_unemployment, p_is_holiday)
    ON CONFLICT (store_id, feature_date) DO UPDATE
        SET temperature  = EXCLUDED.temperature,    
            fuel_price   = EXCLUDED.fuel_price,
            markdown_1   = EXCLUDED.markdown_1,
            cpi          = EXCLUDED.cpi,
            unemployment = EXCLUDED.unemployment;

    RAISE NOTICE 'Atomic insert complete: Store %, Dept %, Date %',
        p_store_id, p_dept_id, p_sale_date;

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Transaction rolled back: %', SQLERRM;
END;
$$;
