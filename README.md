# 🛒 Retail Store Sales Forecasting DBMS with Demand Analytics

**Course:** DS-604 Introduction to Data Management  
**Team:** THE INSIGHT EXPRESS  
**Members:** Sanjana (202518002) | Srishti (202518003) | Nikita (202518038)

---

## 📌 Project Overview

A full-stack Database Management System built on PostgreSQL that integrates store metadata, weekly sales transactions, and external economic features (holidays, markdowns, CPI, unemployment, fuel prices) to support:

- 📦 **Demand Forecasting** — weekly/monthly sales trend analysis
- 📊 **Markdown & Holiday Impact Analysis** — measure promotional effects
- 🏪 **Store & Department Performance** — regional demand intelligence
- 🔔 **Trigger-Based Alerting** — auto-flag sales spikes and markdown anomalies
- 🔮 **Forecasting Notebook** — SARIMA/Prophet on weekly_sales

---

## 📂 Dataset

| File | Description |
|------|-------------|
| `dataset/sales.csv` | Weekly sales per store and department |
| `dataset/stores.csv` | Store metadata (type, size, region) |
| `dataset/features.csv` | External features: temperature, fuel, markdowns, CPI, unemployment |

**Source:** [Kaggle — Retail Store Sales Forecasting](https://www.kaggle.com/datasets/manjeetsingh/retaildataset)

---

## 🗂️ Schema Design

### Entities
| Table | Primary Key | Description |
|-------|-------------|-------------|
| `store` | `store_id` | Store metadata (type, size, region) |
| `department` | `dept_id` | Department reference |
| `sales` | `sales_id` | Weekly sales transactions |
| `features` | `feature_id` | External economic features per store per week |
| `holiday` | `holiday_id` | Holiday calendar with name and season |

### Relationships
- `store` → `sales` (1:N)
- `department` → `sales` (1:N)
- `store` → `features` (1:N, time-series)
- `holiday` → `features` (1:N)

---

## 🗃️ Repository Structure

```
retail-store-dbms/
│
├── README.md
├── ER_Diagram.png
│
├── sql/
│   ├── schema.sql          ← DDL: CREATE TABLE with constraints
│   ├── triggers.sql        ← Triggers: sales spike, markdown anomaly
│   ├── procedures.sql      ← Stored procedures: monthly reports, holiday uplift
│   ├── queries.sql         ← 10 analytical queries
│   └── views.sql           ← 3 reusable views
│
├── dataset/
│   ├── sales.csv
│   ├── stores.csv
│   └── features.csv
│
├── notebooks/
│   └── final.ipynb         ← Full pipeline: DDL → Load → Queries → Views
│
├── dashboard/
│   ├── app.py              ← Streamlit dashboard
│   └── requirements.txt
│
└── ppt/
    └── project_presentation.pdf
```

---

## ⚙️ Setup Instructions

### Prerequisites
- PostgreSQL 14+
- Python 3.9+
- pip install -r dashboard/requirements.txt

### 1. Create schema
```bash
psql -U postgres -d your_database -f sql/schema.sql
```

### 2. Load data (via notebook)
```bash
jupyter notebook notebooks/final.ipynb
```

### 3. Run triggers & procedures
```bash
psql -U postgres -d your_database -f sql/triggers.sql
psql -U postgres -d your_database -f sql/procedures.sql
```

### 4. Launch dashboard
```bash
cd dashboard && streamlit run app.py
```

---

## 📊 Analytical Queries Summary

| # | Query | Business Purpose |
|---|-------|-----------------|
| 1 | Comprehensive Sales Report | 360° view per store/department/week |
| 2 | Holiday vs Non-Holiday Sales | Measure holiday uplift |
| 3 | Markdown Effectiveness | Correlation: markdown spend vs sales |
| 4 | Monthly Demand Aggregation | Inventory & planning signals |
| 5 | Store Type Performance | Compare Type A/B/C stores |
| 6 | Department Sales Outliers | IQR-based anomaly detection |
| 7 | CPI & Unemployment Impact | External factor regression proxy |
| 8 | Fuel Price vs Sales | Cost-of-living sales sensitivity |
| 9 | Top Departments by Revenue | Prioritize shelf space & investment |
| 10 | Data Quality Check | Orphan records, NULLs, negatives |

---

## 🚀 Extensions

- **Forecasting:** SARIMA / Prophet model in `notebooks/final.ipynb`
- **Dashboard:** Streamlit app with holiday vs. non-holiday charts, markdown impact, regional trends
- **Role-Based Access:**
  - `analyst_role` → run forecasting queries (SELECT only)
  - `manager_role` → monitor markdown & store performance
  - `admin_role` → full access (warehouse manager)
