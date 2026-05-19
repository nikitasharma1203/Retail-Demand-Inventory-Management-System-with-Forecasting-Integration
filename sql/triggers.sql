-- ============================================================
-- RETAIL STORE SALES FORECASTING DBMS
-- triggers.sql — Automatic Business Logic
-- DS-604 | THE INSIGHT EXPRESS
-- ============================================================

-- ============================================================
-- TRIGGER 1: Sales Spike Detection
-- Fires AFTER INSERT on retail.sales.
-- Logs a warning when weekly_sales for a store+dept exceeds
-- 2× the historical average for that store+dept combination.
-- ============================================================

-- Audit log table for spike alerts
CREATE TABLE IF NOT EXISTS retail.sales_spike_log (
    log_id        SERIAL       PRIMARY KEY,
    sales_id      INTEGER,
    store_id      INTEGER,
    dept_id       INTEGER,
    sale_date     DATE,
    weekly_sales  DECIMAL(12,2),
    avg_sales     DECIMAL(12,2),
    spike_ratio   DECIMAL(6,2),
    logged_at     TIMESTAMP    DEFAULT NOW()
);

-- Trigger function
CREATE OR REPLACE FUNCTION retail.fn_detect_sales_spike()
RETURNS TRIGGER AS $$
DECLARE
    v_avg_sales DECIMAL(12,2);
    v_ratio     DECIMAL(6,2);
BEGIN
    -- Calculate historical average for this store+department
    SELECT AVG(weekly_sales)
    INTO   v_avg_sales
    FROM   retail.sales
    WHERE  store_id = NEW.store_id
    AND    dept_id  = NEW.dept_id
    AND    sales_id <> NEW.sales_id;   -- exclude the just-inserted row

    -- Only evaluate if we have prior history
    IF v_avg_sales IS NOT NULL AND v_avg_sales > 0 THEN
        v_ratio := NEW.weekly_sales / v_avg_sales;

        IF v_ratio > 2.0 THEN
            INSERT INTO retail.sales_spike_log
                (sales_id, store_id, dept_id, sale_date, weekly_sales, avg_sales, spike_ratio)
            VALUES
                (NEW.sales_id, NEW.store_id, NEW.dept_id, NEW.sale_date,
                 NEW.weekly_sales, v_avg_sales, v_ratio);

            RAISE NOTICE 'SALES SPIKE: Store % Dept % on % — sales=% (%.1f× avg)',
                NEW.store_id, NEW.dept_id, NEW.sale_date,
                NEW.weekly_sales, v_ratio;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_sales_spike ON retail.sales;
CREATE TRIGGER trg_sales_spike
    AFTER INSERT ON retail.sales
    FOR EACH ROW
    EXECUTE FUNCTION retail.fn_detect_sales_spike();

-- ============================================================
-- TRIGGER 2: Markdown Anomaly Alert
-- Fires AFTER INSERT OR UPDATE on retail.features.
-- Logs an alert when total markdown spend was applied but
-- the corresponding weekly_sales for that store/week is BELOW
-- the store's overall average — a "markdown without return".
-- ============================================================

CREATE TABLE IF NOT EXISTS retail.markdown_anomaly_log (
    log_id          SERIAL        PRIMARY KEY,
    feature_id      INTEGER,
    store_id        INTEGER,
    feature_date    DATE,
    total_markdown  DECIMAL(12,2),
    store_avg_sales DECIMAL(12,2),
    week_sales      DECIMAL(12,2),
    logged_at       TIMESTAMP     DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION retail.fn_detect_markdown_anomaly()
RETURNS TRIGGER AS $$
DECLARE
    v_total_markdown DECIMAL(12,2);
    v_week_sales     DECIMAL(12,2);
    v_avg_sales      DECIMAL(12,2);
BEGIN
    v_total_markdown := COALESCE(NEW.markdown_1,0)
                      + COALESCE(NEW.markdown_2,0)
                      + COALESCE(NEW.markdown_3,0)
                      + COALESCE(NEW.markdown_4,0)
                      + COALESCE(NEW.markdown_5,0);

    -- Only evaluate if markdowns were actually applied
    IF v_total_markdown > 0 THEN
        -- Sum all department sales for this store on this week
        SELECT SUM(weekly_sales)
        INTO   v_week_sales
        FROM   retail.sales
        WHERE  store_id  = NEW.store_id
        AND    sale_date = NEW.feature_date;

        -- Historical average weekly sales for this store
        SELECT AVG(weekly_sales)
        INTO   v_avg_sales
        FROM   retail.sales
        WHERE  store_id = NEW.store_id;

        IF v_week_sales IS NOT NULL
           AND v_avg_sales IS NOT NULL
           AND v_week_sales < v_avg_sales THEN

            INSERT INTO retail.markdown_anomaly_log
                (feature_id, store_id, feature_date, total_markdown, store_avg_sales, week_sales)
            VALUES
                (NEW.feature_id, NEW.store_id, NEW.feature_date,
                 v_total_markdown, v_avg_sales, v_week_sales);

            RAISE NOTICE 'MARKDOWN ANOMALY: Store % on % — markdown=% but sales=% < avg=%',
                NEW.store_id, NEW.feature_date,
                v_total_markdown, v_week_sales, v_avg_sales;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_markdown_anomaly ON retail.features;
CREATE TRIGGER trg_markdown_anomaly
    AFTER INSERT OR UPDATE ON retail.features
    FOR EACH ROW
    EXECUTE FUNCTION retail.fn_detect_markdown_anomaly();

-- ============================================================
-- TRIGGER 3: Prevent Negative Sales (data integrity guard)
-- ============================================================
CREATE OR REPLACE FUNCTION retail.fn_guard_negative_sales()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.weekly_sales < 0 THEN
        RAISE EXCEPTION 'Integrity violation: weekly_sales cannot be negative. Got % for store_id=%, dept_id=%, date=%',
            NEW.weekly_sales, NEW.store_id, NEW.dept_id, NEW.sale_date;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_negative_sales ON retail.sales;
CREATE TRIGGER trg_guard_negative_sales
    BEFORE INSERT OR UPDATE ON retail.sales
    FOR EACH ROW
    EXECUTE FUNCTION retail.fn_guard_negative_sales();
