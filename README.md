# 🛒 RetailIQ — Retail Demand & Inventory Analytics Platform

> **A generalised, deployable analytics dashboard for retail companies.**  
> Upload your dataset in the standard schema, get instant analytics — no database, no backend, no setup.

https://agent-6a0c3d35871da200776--retaildemanmanagement.netlify.app/

---

## 📌 What Is This?

RetailIQ is a **full-stack analytics platform built entirely in the browser**. Any retail company can:

1. Upload their data as CSV files in a standard schema format
2. Instantly receive a rich, interactive analytics dashboard
3. Get actionable insights — zero SQL, zero backend, zero cost

This project serves as a real-world case study of a **Retail Demand & Inventory Management DBMS** — demonstrating how structured data can drive business intelligence through automated query analytics.

---

## 🎯 Key Features

| Feature | Description |
|---|---|
| **Upload & Analyze** | Drag-and-drop CSV upload for 5 data sources |
| **KPI Dashboard** | Revenue, avg weekly sales, holiday lift, stockout count |
| **Sales Analysis** | Trends, store rankings, department breakdown, top SKUs |
| **Inventory Health** | Stockout detection, low-stock alerts, EOQ reorder suggestions |
| **External Drivers** | CPI impact, fuel price correlation, markdown ROI analysis |
| **AI Insights** | Auto-generated findings from your data |
| **Demo Mode** | One-click Walmart-style synthetic dataset for exploration |
| **Zero Backend** | All analytics computed in-browser — fully client-side |
| **Deployable** | Works on Vercel, Netlify, GitHub Pages — one command deploy |

---

## 🗂️ Data Schema

The platform accepts **5 CSV files**. Column names are flexible — common aliases are auto-detected.

### 1. `sales.csv` *(required)*
Core weekly sales records by store and department.

| Column | Required | Type | Description |
|---|---|---|---|
| `Store` | ✅ | Integer | Store ID |
| `Dept` | ✅ | Integer | Department ID |
| `Date` | ✅ | Date (YYYY-MM-DD) | Week start date |
| `Weekly_Sales` | ✅ | Float | Weekly sales amount ($) |
| `IsHoliday` | ○ | Boolean (TRUE/FALSE) | Holiday week flag |

### 2. `stores.csv` *(optional)*
Store metadata for enrichment and segmentation.

| Column | Required | Type | Description |
|---|---|---|---|
| `Store` | ✅ | Integer | Store ID |
| `Type` | ○ | String (A/B/C) | Store tier/type |
| `Size` | ○ | Integer | Store size in sq ft |

### 3. `products.csv` *(optional)*
Product and department catalogue.

| Column | Required | Type | Description |
|---|---|---|---|
| `Dept` | ✅ | Integer | Department ID (join key) |
| `Product_Name` | ○ | String | Human-readable name |
| `Category` | ○ | String | Product category |
| `Price` / `Unit_Price` | ○ | Float | Unit price |

### 4. `inventory.csv` *(optional)*
Current stock levels for stockout and reorder analysis.

| Column | Required | Type | Description |
|---|---|---|---|
| `Product_ID` | ✅ | String/Int | Product or SKU ID |
| `Store` | ○ | Integer | Store ID |
| `Stock_Qty` / `Units_In_Stock` | ○ | Integer | Current stock level |
| `Reorder_Level` / `Reorder_Point` | ○ | Integer | Minimum stock before reorder |
| `Product_Name` | ○ | String | Product label |

### 5. `external.csv` *(optional)*
Macro-economic and promotional context data (enables External Drivers tab).

| Column | Required | Type | Description |
|---|---|---|---|
| `Store` | ✅ | Integer | Store ID |
| `Date` | ✅ | Date | Week start date |
| `Temperature` | ○ | Float | Regional temperature (°F) |
| `Fuel_Price` | ○ | Float | Local fuel price ($/gallon) |
| `MarkDown1`–`MarkDown5` | ○ | Float | Promotional markdown percentage |
| `CPI` / `Consumer_Price_Index` | ○ | Float | Consumer Price Index |
| `Unemployment` | ○ | Float | Regional unemployment rate |
| `IsHoliday` | ○ | Boolean | Holiday week flag |

> **Compatibility**: Directly compatible with the [Walmart M5 Forecasting Dataset](https://www.kaggle.com/c/walmart-recruiting-store-sales-forecasting) format on Kaggle.

---

## 📊 Analytics Queries Implemented

The platform runs the following analyses automatically from your data:

### Sales Intelligence
- **Q1: Total Revenue by Store** — Ranked store performance, type segmentation
- **Q2: Weekly Sales Trend** — Time-series across all weeks, holiday markers
- **Q3: Department Revenue Breakdown** — Share of wallet per dept
- **Q4: Top SKU/Product Analysis** — Best performing products by total & avg sales
- **Q5: Monthly Revenue Aggregation** — Seasonality and growth trends
- **Q6: Store Performance Score** — Normalized performance index vs. best store

### Inventory Management
- **Q7: Inventory Status Scan** — Classifies every SKU as OK / LOW / STOCKOUT / OVERSTOCK
- **Q8: Stockout Risk Detection** — Lists all zero-stock and below-reorder items by urgency
- **Q9: EOQ-based Reorder Suggestions** — Auto-calculated Economic Order Quantities
- **Q10: Category Inventory Distribution** — Stock coverage across product categories

### External Factor Analysis
- **Q11: Holiday Lift Quantification** — % uplift in sales during holiday vs. non-holiday weeks
- **Q12: Markdown ROI Analysis** — Average sales at No / Low / Mid / High markdown levels
- **Q13: CPI vs. Sales Correlation** — Demand sensitivity to inflation (bucketed CPI ranges)
- **Q14: Fuel Price Impact** — Sales variation across fuel price bands
- **Q15: Temperature-Sales Relationship** — Seasonal demand patterns

### Business Insights
- **Q16: Revenue Concentration Analysis** — Top 3 department share of total revenue
- **Q17: Store Type Benchmarking** — A/B/C tier performance comparison
- **Q18: Automated Insight Generation** — 5 data-driven recommendations per dataset

---

## 🚀 Deployment Guide

### Option A: Vercel (Recommended — 1 minute)

```bash
# 1. Fork or clone this repo
git clone https://github.com/nikitasharma1203/Retail-Demand-Inventory-Management-System-with-Forecasting-Integration
cd retail-dashboard

# 2. Install & build
npm install
npm run build

# 3. Deploy via Vercel CLI
npx vercel --prod
```

Or connect the GitHub repo to [vercel.com](https://vercel.com) for automatic deployments.

**Build Settings for Vercel:**
- Framework Preset: `Create React App`
- Build Command: `npm run build`
- Output Directory: `build`

### Option B: Netlify

```bash
npm run build
# Drag the /build folder to netlify.com/drop
```

Or via Netlify CLI:
```bash
npx netlify deploy --prod --dir=build
```

### Option C: GitHub Pages

```bash
npm install gh-pages --save-dev
# Add to package.json: "homepage": "https://yourusername.github.io/repo-name"
npm run build && npx gh-pages -d build
```

### Option D: Local Development

```bash
npm install
npm start
# Open http://localhost:3000
```

---

## 🏗️ Architecture

```
RetailIQ/
├── public/
│   └── index.html              # Entry HTML
├── src/
│   ├── App.js                  # Main UI — landing, dashboard, all tabs
│   ├── analytics.js            # Pure JS analytics engine (all 18 queries)
│   ├── demoData.js             # Synthetic dataset generator
│   ├── index.js                # React entry point
│   └── index.css               # Complete design system (CSS variables)
├── package.json
└── README.md
```

**Tech Stack:**
- **React 18** — UI framework
- **Recharts** — All charts (Area, Bar, Line, Pie, Scatter)
- **PapaParse** — CSV parsing (client-side, no upload limit)
- **Syne + Space Mono** — Typography
- **Zero backend** — All compute happens in the browser

**Design Principles:**
- All analytics are pure functions: `(datasets) → insights`
- Column name aliases handle real-world naming inconsistencies
- Graceful degradation when optional files are missing
- Buckets, groupBy, and aggregation without SQL or server

---

## 🎨 UI Design

The dashboard uses an **industrial dark aesthetic** with:
- Deep void backgrounds (`#080810`)
- Vivid accent colors for each data dimension
- Monospaced fonts for data, display fonts for headings
- Animated KPI cards, glowing live indicators
- 5 tabbed sections: Overview / Sales / Inventory / External Drivers / Insights

---

## 🔄 How To Use With Real Company Data

1. **Export** your company's sales data from your ERP/POS/WMS
2. **Map** columns to the schema (rename headers in Excel if needed)
3. **Save** as separate CSV files per entity
4. **Upload** to RetailIQ — analysis is instant
5. **Share** the dashboard URL (if deployed) or export findings

**Minimum viable input:** Just `sales.csv` with Store, Dept, Date, Weekly_Sales — everything else enriches the analysis but is optional.

---

## 📋 Example Dataset Sources

| Dataset | Source | Compatibility |
|---|---|---|
| Walmart Store Sales | [Kaggle](https://www.kaggle.com/c/walmart-recruiting-store-sales-forecasting) | ✅ Direct |
| M5 Forecasting | [Kaggle](https://www.kaggle.com/c/m5-forecasting-accuracy) | ✅ With mapping |
| Retail Transaction Data | UCI ML Repository | ✅ With mapping |
| Your Company's ERP Export | Internal | ✅ Schema mapping |

---

## 🧠 Academic Context

This platform operationalises the following DBMS concepts from the Retail Demand & Inventory Management System:

| DBMS Concept | Implementation |
|---|---|
| Relational joins | Multi-file key-based merging (Store, Date, Dept) |
| Aggregate queries | GroupBy + sum/avg functions across dimensions |
| Constraint validation | Required column detection with schema guide |
| Derived attributes | EOQ calculation, performance scores, holiday lift % |
| External entity integration | Macro data join (CPI, Fuel, Markdown) |
| Demand forecasting hooks | Seasonal trend visualization as forecast baseline |
| Automated alerts | Reorder trigger logic (Stock_Qty ≤ Reorder_Level) |

---

## 👩‍💻 Built By

**Nikita Sharma** — DBMS Project, 2024  
Retail Demand & Inventory Management System with Forecasting Integration

---

## 📄 License

MIT — Free to use, deploy, and adapt for any retail analytics use case.
=======

