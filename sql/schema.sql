-- ============================================================
-- RETAIL STORE SALES FORECASTING DBMS
-- schema.sql — DDL: Table Creation with Constraints
-- DS-604 | THE INSIGHT EXPRESS
-- ============================================================

-- Create schema
CREATE SCHEMA IF NOT EXISTS retail;

-- ============================================================
-- DROP EXISTING TABLES (safe re-run)
-- ============================================================
DROP TABLE IF EXISTS retail.sales         CASCADE;
DROP TABLE IF EXISTS retail.features      CASCADE;
DROP TABLE IF EXISTS retail.holiday       CASCADE;
DROP TABLE IF EXISTS retail.department    CASCADE;
DROP TABLE IF EXISTS retail.store         CASCADE;

-- ============================================================
-- TABLE 1: store
-- ============================================================
CREATE TABLE retail.store (
    store_id     INTEGER       NOT NULL,
    store_type   CHAR(1)       NOT NULL CHECK (store_type IN ('A', 'B', 'C')),
    store_size   INTEGER       NOT NULL CHECK (store_size > 0),
    region       VARCHAR(50),
    PRIMARY KEY (store_id)
);

COMMENT ON TABLE  retail.store IS 'Store metadata: type, size, and region.';
COMMENT ON COLUMN retail.store.store_type IS 'Store classification: A (large), B (medium), C (small).';

-- ============================================================
-- TABLE 2: department
-- ============================================================
CREATE TABLE retail.department (
    dept_id      INTEGER       NOT NULL,
    dept_name    VARCHAR(100),
    category     VARCHAR(50),
    PRIMARY KEY (dept_id)
);

COMMENT ON TABLE retail.department IS 'Department reference catalogue.';

-- ============================================================
-- TABLE 3: holiday
-- ============================================================
CREATE TABLE retail.holiday (
    holiday_id   SERIAL        NOT NULL,
    holiday_name VARCHAR(100)  NOT NULL,
    holiday_date DATE          NOT NULL,
    season       VARCHAR(20)   CHECK (season IN ('Spring', 'Summer', 'Fall', 'Winter')),
    is_super      BOOLEAN       DEFAULT FALSE,
    PRIMARY KEY (holiday_id)
);

COMMENT ON TABLE  retail.holiday IS 'Holiday calendar with name, date and season.';
COMMENT ON COLUMN retail.holiday.is_super IS 'True for high-impact holidays (Thanksgiving, Christmas, Super Bowl, etc.).';

-- ============================================================
-- TABLE 4: features
-- Stores external economic features per store per week.
-- ============================================================
CREATE TABLE retail.features (
    feature_id   SERIAL        NOT NULL,
    store_id     INTEGER       NOT NULL,
    feature_date DATE          NOT NULL,
    temperature  DECIMAL(6,2),
    fuel_price   DECIMAL(6,3)  CHECK (fuel_price  > 0),
    markdown_1   DECIMAL(10,2) DEFAULT 0  CHECK (markdown_1  >= 0),
    markdown_2   DECIMAL(10,2) DEFAULT 0  CHECK (markdown_2  >= 0),
    markdown_3   DECIMAL(10,2) DEFAULT 0  CHECK (markdown_3  >= 0),
    markdown_4   DECIMAL(10,2) DEFAULT 0  CHECK (markdown_4  >= 0),
    markdown_5   DECIMAL(10,2) DEFAULT 0  CHECK (markdown_5  >= 0),
    cpi          DECIMAL(10,4),
    unemployment DECIMAL(6,3)  CHECK (unemployment >= 0),
    holiday_id   INTEGER,
    is_holiday   BOOLEAN       DEFAULT FALSE,
    PRIMARY KEY (feature_id),
    FOREIGN KEY (store_id)   REFERENCES retail.store(store_id)     ON DELETE CASCADE  ON UPDATE CASCADE,
    FOREIGN KEY (holiday_id) REFERENCES retail.holiday(holiday_id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX uq_features_store_date ON retail.features(store_id, feature_date);
CREATE INDEX idx_features_date    ON retail.features(feature_date);
CREATE INDEX idx_features_store   ON retail.features(store_id);

COMMENT ON TABLE retail.features IS 'Weekly economic context: fuel, CPI, unemployment, markdowns.';

-- ============================================================
-- TABLE 5: sales
-- Core fact table — weekly sales per store + department.
-- ============================================================
CREATE TABLE retail.sales (
    sales_id      SERIAL         NOT NULL,
    store_id      INTEGER        NOT NULL,
    dept_id       INTEGER        NOT NULL,
    sale_date     DATE           NOT NULL,
    weekly_sales  DECIMAL(12,2)  NOT NULL  CHECK (weekly_sales >= 0),
    is_holiday    BOOLEAN        DEFAULT FALSE,
    PRIMARY KEY (sales_id),
    FOREIGN KEY (store_id) REFERENCES retail.store(store_id)      ON DELETE CASCADE  ON UPDATE CASCADE,
    FOREIGN KEY (dept_id)  REFERENCES retail.department(dept_id)  ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX idx_sales_store   ON retail.sales(store_id);
CREATE INDEX idx_sales_dept    ON retail.sales(dept_id);
CREATE INDEX idx_sales_date    ON retail.sales(sale_date);
CREATE INDEX idx_sales_holiday ON retail.sales(is_holiday);

COMMENT ON TABLE  retail.sales IS 'Weekly sales transactions — core fact table.';
COMMENT ON COLUMN retail.sales.weekly_sales IS 'Total sales revenue for the store+department in that week (USD).';

-- ============================================================
-- ROLE-BASED ACCESS CONTROL
-- ============================================================
DO $$
BEGIN
    -- Analyst: read-only
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'analyst_role') THEN
        CREATE ROLE analyst_role;
    END IF;
    -- Manager: read + limited write on features
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'manager_role') THEN
        CREATE ROLE manager_role;
    END IF;
    -- Admin: full access
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin_role') THEN
        CREATE ROLE admin_role;
    END IF;
END
$$;

GRANT SELECT                         ON ALL TABLES IN SCHEMA retail TO analyst_role;
GRANT SELECT, INSERT, UPDATE         ON retail.features              TO manager_role;
GRANT SELECT                         ON ALL TABLES IN SCHEMA retail TO manager_role;
GRANT ALL PRIVILEGES                 ON ALL TABLES IN SCHEMA retail TO admin_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA retail              TO admin_role;
