# 📦 Retail Demand Intelligence Platform

> **A full-stack database management system and decision-support application for retail demand forecasting, inventory risk detection, and markdown ROI analysis.**

---

## The Problem This Solves

Retail is a $25 trillion global industry with a data problem. Every week, a 45-store chain generates over 280,000 sales data points across 99 departments — but most of that data sits in flat CSVs, never translated into decisions.

The consequences are measurable and severe:

- **$1.75 trillion** lost annually to inventory overstock and stockout globally
- **$300 billion** discounted through markdowns with no systematic ROI measurement
- Buyers allocating shelf space based on gut feel, not department-level demand velocity
- Store managers unable to distinguish a genuine demand crash from random variance

This project builds the infrastructure and application layer to fix that.

---

## What We Built

A complete, production-structured DBMS project that goes from raw CSV → normalised relational schema → analytical SQL → interactive decision-support application.

```
retail-store-dbms/
│
├── README.md                    ← You are here
├── ER_Diagram.svg               ← Entity-Relationship diagram
│
├── sql/
│   ├── setup_all.sql            ← One-file setup: schema + triggers + procedures + views
│   ├── schema.sql               ← DDL only (tables, indexes, roles)
│   ├── triggers.sql             ← 3 triggers: spike detection, markdown anomaly, integrity guard
│   ├── procedures.sql           ← 3 stored procedures + 1 function
│   ├── queries.sql              ← 10 analytical SQL queries
│   └── views.sql                ← 4 reusable views
│
├── dataset/
│   ├── sales.csv                ← 280,423 weekly sales records
│   ├── stores.csv               ← 45 stores (Type A/B/C)
│   └── features.csv             ← 6,435 weekly economic feature rows
│
├── notebooks/
│   └── final.ipynb              ← Full pipeline: connect → DDL → load → query → visualise
│
└── dashboard/
    ├── app.py                   ← Streamlit application (7 pages, CSV-powered)
    └── requirements.txt         ← Python dependencies
```

---

## Dataset

| File | Records | Description |
|------|---------|-------------|
| `sales.csv` | 280,423 | Weekly sales per store × department (Feb 2010 – Oct 2012) |
| `stores.csv` | 45 | Store type (A/B/C) and size in sq ft |
| `features.csv` | 6,435 | Temperature, fuel price, 5 markdown channels, CPI, unemployment, holiday flag |

**Source:** [Kaggle — Walmart Retail Store Forecasting Dataset](https://www.kaggle.com/datasets/manjeetsingh/retaildataset)

Key statistics:
- **Total revenue in dataset:** $6.49 billion
- **Date range:** 143 weeks (February 2010 to October 2012)
- **Store types:** A (10 large stores), B (17 medium), C (18 small)
- **Holiday uplift observed:** 24.2% to 25.7% depending on store type
- **Departments tracked:** 99

---

## Database Schema

### Entities

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `retail.store` | `store_id` | Store metadata: type, size, region |
| `retail.department` | `dept_id` | Department catalogue with category |
| `retail.holiday` | `holiday_id` | Holiday calendar: name, date, season, super-flag |
| `retail.features` | `feature_id` | Weekly external signals per store: fuel, CPI, unemployment, 5 markdowns |
| `retail.sales` | `sales_id` | Weekly sales fact table: store × dept × week |

### Relationships

```
store ──(1:N)──► sales         (one store has many weekly sales records)
department ─(1:N)──► sales     (one department has many weekly sales records)
store ──(1:N)──► features      (one store has many weekly feature rows)
holiday ─(1:N)──► features     (one holiday can be linked to many feature weeks)
```

### Constraints

- `CHECK store_type IN ('A','B','C')` — only valid store classifications
- `CHECK store_size > 0` — no zero or negative store sizes
- `CHECK weekly_sales >= 0` — enforced at both DDL and trigger level
- `CHECK fuel_price > 0` — physical validity
- `CHECK markdown_N >= 0` — no negative markdown amounts
- `UNIQUE(store_id, feature_date)` — one feature row per store per week
- `ON DELETE CASCADE` on sales → store, features → store (clean tree deletion)
- `ON DELETE SET NULL` on sales → department, features → holiday (orphan-safe)

### Indexes

```sql
CREATE INDEX idx_sales_store   ON retail.sales(store_id);
CREATE INDEX idx_sales_dept    ON retail.sales(dept_id);
CREATE INDEX idx_sales_date    ON retail.sales(sale_date);
CREATE INDEX idx_sales_holiday ON retail.sales(is_holiday);
CREATE UNIQUE INDEX uq_features_store_date ON retail.features(store_id, feature_date);
```

---

## Triggers

### `trg_sales_spike` — Stockout Early Warning
Fires `AFTER INSERT` on `retail.sales`. Calculates the rolling z-score for each store-department combination. When a new sales record exceeds **2× the historical average** for that store-department pair, it writes an entry to `retail.sales_spike_log` with the spike ratio and context.

**Business value:** Alerts buyers to replenish inventory before a stockout occurs, rather than discovering the problem at empty shelves.

### `trg_markdown_anomaly` — Discount Waste Detector
Fires `AFTER INSERT OR UPDATE` on `retail.features`. When markdown spend is applied but the corresponding week's sales for that store fall **below the store's historical average**, it logs the anomaly to `retail.markdown_anomaly_log`.

**Business value:** Identifies stores where discounting is not driving incremental traffic — enabling smarter markdown allocation.

### `trg_guard_negative_sales` — Data Integrity Guard
Fires `BEFORE INSERT OR UPDATE` on `retail.sales`. Raises an exception if `weekly_sales < 0` is attempted — a belt-and-suspenders guard beyond the CHECK constraint.

---

## Stored Procedures

### `sp_monthly_demand_report(year, month)`
Aggregates total revenue for a given month, identifies the top 10 departments by revenue share, and prints a formatted report via `RAISE NOTICE`.

```sql
CALL retail.sp_monthly_demand_report(2011, 11);
```

### `sp_holiday_uplift()`
Computes average weekly sales during holiday vs non-holiday weeks per store type, and calculates the percentage uplift.

```sql
CALL retail.sp_holiday_uplift();
```

### `sp_insert_sales_with_features(...)` — Atomic Transaction
Inserts a sales record and its corresponding features record in a single transaction. Uses `ON CONFLICT DO UPDATE` for feature upserts. Rolls back both on any failure, maintaining referential consistency.

```sql
CALL retail.sp_insert_sales_with_features(
    1, 5, '2012-11-02', 45000.00, TRUE,
    55.2, 3.45, 12000, 0, 500, 0, 250,
    211.4, 7.8
);
```

### `fn_store_weekly_summary(store_id)` — Table-Valued Function
Returns a per-week summary for a single store: total sales, holiday flag, and active department count.

```sql
SELECT * FROM retail.fn_store_weekly_summary(1);
```

---

## Views

| View | Purpose |
|------|---------|
| `vw_holiday_sales_uplift` | Holiday vs regular avg sales + uplift % per store type |
| `vw_markdown_effectiveness` | Total markdown spend, avg sales, and ROI ratio per store |
| `vw_top_departments_by_revenue` | Ranked department revenue with store coverage and peak sales |
| `vw_store_weekly_summary` | One row per store per week — ideal base for forecasting queries |

---

## 10 Analytical Queries

| # | Query | Business Purpose |
|---|-------|-----------------|
| 1 | Comprehensive Sales Report | 360° view: store, dept, week, holiday, markdown, CPI, fuel |
| 2 | Holiday vs Non-Holiday Sales | Measure uplift by store type; inform holiday staffing and stock |
| 3 | Markdown Effectiveness | Sales per markdown dollar; identify high vs low ROI stores |
| 4 | Monthly Demand Aggregation | Inventory planning signal; month-level dept revenue breakdown |
| 5 | Store Type Performance | Revenue, avg sales, efficiency, and size comparison by A/B/C |
| 6 | Department Sales Outliers | IQR-based anomaly detection; flags statistical demand outliers |
| 7 | CPI & Unemployment Impact | Bucketed correlation; macro-economic demand sensitivity |
| 8 | Fuel Price Sensitivity | Demand compression during high fuel price periods |
| 9 | Top Departments by Revenue | Revenue rank for shelf-space allocation decisions |
| 10 | Data Quality & Orphan Check | 6-point integrity audit: NULLs, orphans, negatives, gaps |

---

## Role-Based Access Control

Three database roles are created automatically in `schema.sql`:

| Role | Permissions | Use Case |
|------|------------|---------|
| `analyst_role` | `SELECT` on all tables | Forecasting queries, reporting |
| `manager_role` | `SELECT` all + `INSERT/UPDATE` on features | Markdown management, promotions |
| `admin_role` | Full privileges + sequences | Warehouse manager, data ops |

---

## Setup Instructions

### Prerequisites
- PostgreSQL 14 or higher
- Python 3.9 or higher
- `psql` command available in terminal

### Step 1 — Create the database

Open `psql` and run:

```sql
CREATE DATABASE retail_store;
```

### Step 2 — Run the master setup script

From the `retail-store-dbms` folder:

```bash
psql -U postgres -d retail_store -f sql/setup_all.sql
```

This single file creates the schema, all tables, triggers, procedures, and views in the correct order. Expected output ends with:

```
================================================
 Setup complete! Tables, triggers, procedures,
 and views are all installed in schema: retail
================================================
```

**Note:** If you see `FATAL: password authentication failed`, open `psql` first:
```bash
psql -U postgres
```
Then run `\c retail_store` to switch to the database, paste the SQL, or set your password with `\password postgres`.

### Step 3 — Load data via the notebook

```bash
cd notebooks
jupyter notebook final.ipynb
```

Update `PASSWORD` and `DATABASE` in STEP 2 of the notebook to match your PostgreSQL installation. Run all cells in order (STEP 1 through STEP 8).

### Step 4 — Launch the dashboard

```bash
cd dashboard
pip install -r requirements.txt
streamlit run app.py
```

The dashboard opens at `http://localhost:8501`. It loads data **directly from the CSVs** — no database connection required for the dashboard.

---

## Dashboard — 7 Pages

The Streamlit application is a self-contained retail decision-support tool. It loads from CSV files and requires no database connection.

### 🏠 Command Centre
Platform-level KPIs: total revenue, average weekly sales per store, holiday revenue share, store × department matrix. Revenue trend chart with holiday weeks highlighted. Explains the three core problems the platform addresses.

### 🚨 Inventory Risk Alerts
Rolling z-score analysis on every store-department combination. Generates severity-classified alerts:
- **HIGH / Demand Spike** → Stockout risk; replenishment action required
- **HIGH / Demand Crash** → Overstock risk; markdown or transfer recommended  
- **MEDIUM** → Trend alerts for proactive monitoring

Includes a drill-down chart for any store-department with 4-week rolling average and holiday markers.

### 🎄 Holiday & Markdown Impact
Quantifies the 24–26% holiday sales uplift across store types. Identifies the top departments by holiday responsiveness. Scatter and bar charts for markdown spend vs sales, and a per-store Markdown ROI ranking.

### 🏪 Store Benchmarking
Compares every store against its type-peer average (Type A vs Type A, etc.). Shows revenue per square foot as the primary efficiency metric. Colour-coded performance gap chart and a full sortable scorecard.

### 📦 Department Demand Ranking
Ranks all 99 departments by total revenue, average weekly velocity, store coverage, and historical spike count. Includes a velocity vs coverage scatter plot for portfolio analysis.

### 📈 Demand Trend Explorer
Interactive store + department drill-down. Shows:
- Raw weekly sales with ±1.5σ demand bands
- 4-week and 12-week rolling averages
- Holiday week markers
- Year-over-year comparison (when multi-year data exists)
- Demand variability statistics (mean, peak, std dev, CV)

### 🌡️ External Factor Signals
Pearson correlation analysis of CPI, unemployment, fuel price and temperature against weekly sales. Per-factor scatter plots with trend lines. CPI × Unemployment heatmap showing average sales across macro-economic condition buckets.

---

## Technical Design Decisions

**Why CSV-based dashboard?** The Streamlit app uses `pandas` to load CSVs directly rather than connecting to PostgreSQL. This makes the dashboard deployable to Streamlit Cloud or any machine without a running database. The DBMS (schema, triggers, procedures, views) is the analytical backbone; the dashboard is the decision interface.

**Why rolling z-score for inventory alerts?** A fixed threshold (e.g. "flag if sales > $50,000") would miss context — a spike at a small Type C store is proportionally more significant than the same number at a large Type A store. Z-score normalises by each store-department's own history, making alerts meaningful regardless of store size.

**Why IQR for outlier detection?** The IQR method is robust to the non-normal distribution of retail sales data (right-skewed, holiday-clustered). It doesn't assume Gaussian distribution and is not distorted by the extreme holiday-week spikes that would inflate a mean-based threshold.

**Why Pearson correlation for external factors?** As a first-order signal, Pearson r identifies linear relationships between economic variables and sales. The correlation table with p-values allows statistical filtering of noise from genuine signals, giving buyers a ranked list of which external factors to monitor.

---

## Extensions & Future Work

**Forecasting Model Integration**  
The `vw_store_weekly_summary` view produces a clean `(date, total_sales)` time series per store, ready for SARIMA or Prophet. The notebook includes scaffolding for both. With one year of additional data, a seasonal decomposition (STL) model would capture the strong annual holiday pattern.

**Real-time Trigger Monitoring**  
The `sales_spike_log` and `markdown_anomaly_log` tables are designed to feed a live alert dashboard. With a scheduled Airflow DAG inserting weekly sales, the trigger system would automatically surface anomalies without any manual query.

**Markdown Optimisation Model**  
The markdown channel data (MarkDown1–5 represent different promotional types) can be used to train a regression model predicting sales lift per markdown type per store. This moves from descriptive ROI to predictive optimisation.

**Role-Based Multi-Store Access**  
The `analyst_role`, `manager_role`, and `admin_role` structure maps directly to a multi-tenant deployment: regional managers see only their store cluster, buyers see department-level aggregates, and data ops have full access.

---

## Project Milestones

| Milestone | Deliverable |
|-----------|-------------|
| 3 | ER diagram + relational schema + DDL |
| 4 | Data loading, triggers, stored procedures, 10 analytical queries |
| 5 | Views, role-based access, dashboard, forecasting notebook |

---

*Built for DS-604 Introduction to Data Management · THE INSIGHT EXPRESS*
