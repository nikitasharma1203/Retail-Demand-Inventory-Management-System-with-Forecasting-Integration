# RetailIQ
### Retail Demand Forecasting & Inventory Intelligence Platform

[![Streamlit](https://img.shields.io/badge/Streamlit-Dashboard-FF4B4B?style=flat-square&logo=streamlit)](https://retail-demand-inventory-management-system-with-forecasting-int.streamlit.app/)
[![Web App](https://img.shields.io/badge/WebApp-Live-0A66C2?style=flat-square&logo=googlechrome)](https://retailiqplatform.netlify.app/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_14-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![XGBoost](https://img.shields.io/badge/Forecast-XGBoost_8.2%25_MAPE-FF6600?style=flat-square)](https://xgboost.readthedocs.io/)

Production-grade retail analytics system built on a 421K-row Walmart dataset. Covers the full data engineering and forecasting lifecycle — from PostgreSQL warehouse design to multi-model demand forecasting, inventory optimisation, and interactive dashboards.

---

## Results

| Metric | Value |
|---|---|
| Best forecast accuracy (XGBoost) | **8.2% MAPE, R² = 0.94** |
| Improvement over naïve baseline | **38% MAPE reduction** (18.4% → 8.2%) |
| Simulated inventory holding cost reduction | **15%** via EOQ-aligned reorder logic |
| Holiday sales uplift detected | **+30.05% to +33.57%** across store types |
| Best markdown ROI identified | **Store 32 — $8.62 revenue per $1 spent** |
| Data integrity | **100%** — 0 issues across 421K rows |
| Total revenue modelled (2010–2012) | **$3.43 Billion** |

---

## Architecture

```
CSV Data Sources (stores · sales · features)
              ↓
PostgreSQL Data Warehouse  [schema: retail]
              ↓
DDL — Tables · Indexes · Constraints · RBAC
              ↓
Triggers · Stored Procedures · BI Views
              ↓
Python Analytics Layer (SQLAlchemy · 10 queries)
              ↓
SARIMA · XGBoost · Prophet · K-Means
              ↓
Streamlit Dashboard  +  React Web App
```

---

## Forecasting

Four models were trained and evaluated on weekly store-level sales. XGBoost with lag and rolling window features outperformed all statistical and deep learning baselines.

### Model comparison (Store 1, weekly demand)

| Model | RMSE | MAE | MAPE | R² |
|---|---|---|---|---|
| **XGBoost** ✅ | **112** | **81** | **8.2%** | **0.94** |
| SARIMA (1,1,1)(1,1,1,52) | 189 | 141 | 12.1% | 0.89 |
| Prophet | 210 | 158 | 13.8% | 0.87 |
| Naïve Seasonal Baseline | 280 | 198 | 18.4% | 0.71 |

### Why XGBoost won

Statistical models (SARIMA, Prophet) model the time series directly and struggle with the external drivers in this dataset — CPI, fuel price, markdowns, and holiday flags interact non-linearly with sales. XGBoost, given lag features and rolling windows, learns these interactions explicitly:

```python
Features: lag_1, lag_2, lag_4, rolling_mean_4, month, week
Model: XGBRegressor(n_estimators=200, learning_rate=0.05, max_depth=5)
Train/Test split: 80/20 (114 train weeks / 29 test weeks)
```

**Feature importance:** lag_1 (38%) · rolling_mean_4 (27%) · lag_4 (16%) · month (10%)

The 38% weight on lag_1 confirms strong short-term autocorrelation in retail demand — last week's sales is the single best predictor of this week's sales. Rolling mean captures medium-term trend. Month captures residual seasonality not absorbed by the lag structure.

### Inventory optimisation (Store 1)

```
EOQ  = √(2 × 121,289,590 × 50 / 10)  =  49,251 units
ROP  = (avg_weekly_sales × lead_time) + safety_stock
     = (1,632,636 × 2) + 5,000  =  3,270,272 units
```

EOQ and reorder point calculations are automated via the `sp_reorder_check(store_id)` stored procedure for any store in the dataset.

---

## Database Design

**Schema:** `retail` · PostgreSQL 14

| Table | Rows | Description |
|---|---|---|
| `store` | 45 | Store metadata — type (A/B/C), size, region |
| `department` | 81 | Product department catalogue |
| `sales` | 421,570 | Weekly sales fact table |
| `features` | 8,190 | External drivers — CPI, fuel, markdowns, temperature |
| `anomaly_log` | auto | Trigger-populated spike detection log |

### Advanced DBMS features

**4 Business Intelligence Views**

| View | Purpose |
|---|---|
| `vw_holiday_sales_uplift` | Holiday vs regular average sales by store type |
| `vw_markdown_effectiveness` | Revenue per markdown dollar (ROI analysis) |
| `vw_top_departments_by_revenue` | Department ranking using `RANK() OVER` |
| `vw_store_weekly_summary` | Aggregated weekly time-series for forecasting input |

**3 Triggers**

| Trigger | Logic |
|---|---|
| `trg_guard_negative_sales` | Raises exception on negative weekly sales — enforces data integrity |
| `trg_sales_spike` | Logs to `anomaly_log` when sales exceed 2× historical average |
| `trg_markdown_anomaly` | Flags stores with high markdown spend but below-average sales |

**3 Stored Procedures**

| Procedure | Output |
|---|---|
| `sp_monthly_demand_report(year, month)` | Top departments + total revenue for any period |
| `sp_holiday_uplift()` | Uplift % per store type: A +30.05%, B +31.86%, C +33.57% |
| `sp_reorder_check(store_id)` | EOQ, reorder point, and stock status alert for any store |

**RBAC — 3 enterprise roles**

```sql
CREATE ROLE analyst_role;  -- SELECT on all views and tables
CREATE ROLE manager_role;  -- SELECT + UPDATE on retail.features
CREATE ROLE admin_role;    -- Full DDL: CREATE, DROP, TRUNCATE, GRANT
```

---

## 10 Analytical SQL Queries

| # | Query | Key Finding |
|---|---|---|
| Q1 | Comprehensive sales report | Multi-table JOIN with COALESCE for nulls |
| Q2 | Holiday vs non-holiday uplift | +30–33% uplift across all store types |
| Q3 | Markdown effectiveness | Store 32: $8.62 revenue per $1 markdown |
| Q4 | Monthly demand aggregation | Dept 20 peaks at $22.8M/month |
| Q5 | Store type performance | Type A = 73.6% of $3.43B total revenue |
| Q6 | Sales outlier detection | CTE + PERCENTILE_CONT IQR — 9 holiday outliers |
| Q7 | CPI & unemployment impact | Retail demand is inflation-resilient |
| Q8 | Fuel price sensitivity | Demand fuel-price inelastic ($2,449 max variance) |
| Q9 | Top departments by revenue | RANK() OVER — Dept 20 leads at $228M |
| Q10 | Data quality audit | UNION ALL + LEFT JOIN — 0 integrity issues |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Database | PostgreSQL 14 |
| ORM | SQLAlchemy + psycopg2 |
| Data Processing | Pandas, NumPy |
| Forecasting | SARIMA (statsmodels), Prophet (Meta), XGBoost |
| Clustering | Scikit-learn KMeans |
| Visualisation | Plotly, Matplotlib, Seaborn |
| Dashboard (Python) | Streamlit |
| Dashboard (Web) | React 18, Recharts, PapaParse |
| Deployment | Netlify, Streamlit Cloud |

---

## Repository Structure

```
RetailIQ/
├── retail-dashboard/          # React web app
│   └── src/
│       ├── App.js             # Dashboard UI (7 tabs)
│       ├── analytics.js       # 18 client-side analytics queries
│       └── demoData.js        # Synthetic Walmart-style demo data
├── app.py                     # Streamlit dashboard
├── notebooks/
│   └── final.ipynb            # Full pipeline — DBMS + analytics + forecasting
├── sql/
│   ├── schema.sql             # DDL
│   ├── views.sql              # 4 BI views
│   ├── triggers.sql           # 3 triggers
│   └── procedures.sql         # 3 stored procedures + RBAC
└── dataset/
    ├── stores.csv             # 45 stores
    ├── sales.csv              # 421,570 rows
    └── features.csv           # External economic drivers
```

---


