"""
RETAIL DEMAND INTELLIGENCE PLATFORM
Compatible with your dataset schema
"""

import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import seaborn as sns
from scipy import stats
import warnings
import os

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────
# PAGE CONFIG
# ─────────────────────────────────────────────────────────────

st.set_page_config(
    page_title="Retail Demand Intelligence",
    page_icon="📦",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ─────────────────────────────────────────────────────────────
# STYLING
# ─────────────────────────────────────────────────────────────

st.markdown("""
<style>
html, body, [class*="css"] {
    background-color: #0e1117;
    color: white;
}

.block-container {
    padding-top: 2rem;
}

.kpi-card {
    background: #161b22;
    padding: 18px;
    border-radius: 12px;
    border: 1px solid #30363d;
}

.section-title {
    font-size: 22px;
    font-weight: bold;
    margin-top: 20px;
    margin-bottom: 15px;
}
</style>
""", unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────
# DATA PATH
# ─────────────────────────────────────────────────────────────

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "dataset")

# ─────────────────────────────────────────────────────────────
# LOAD DATA
# ─────────────────────────────────────────────────────────────

@st.cache_data(show_spinner=True)
def load_data():

    # READ FILES
    sales = pd.read_csv(os.path.join(DATA_DIR, "sales.csv"))
    stores = pd.read_csv(os.path.join(DATA_DIR, "stores.csv"))
    features = pd.read_csv(os.path.join(DATA_DIR, "features.csv"))

    # CLEAN COLUMN NAMES
    sales.columns = sales.columns.str.strip().str.lower()
    stores.columns = stores.columns.str.strip().str.lower()
    features.columns = features.columns.str.strip().str.lower()

    # RENAME SALES COLUMNS
    sales.rename(columns={
        "store_id": "Store",
        "department": "Dept",
        "date": "Date",
        "weekly_sa": "Weekly_Sales",
        "is_holiday": "IsHoliday"
    }, inplace=True)

    # RENAME STORES COLUMNS
    stores.rename(columns={
        "store_id": "Store",
        "store_type": "Type",
        "store_size": "Size"
    }, inplace=True)

    # RENAME FEATURES COLUMNS
    # FIX DUPLICATE MARKDOWN COLUMNS
    features.columns = [
        "store_id",
        "date",
        "temperature",
        "fuel_price",
        "markdown1",
        "markdown2",
        "markdown3",
        "markdown4",
        "markdown5",
        "cpi",
        "unemployment",
        "is_holiday",
        "holiday_name",
        "season"
    ]

    # RENAME COLUMNS
    features.rename(columns={
        "store_id": "Store",
        "date": "Date",
        "temperature": "Temperature",
        "fuel_price": "Fuel_Price",
        "markdown1": "MarkDown1",
        "markdown2": "MarkDown2",
        "markdown3": "MarkDown3",
        "markdown4": "MarkDown4",
        "markdown5": "MarkDown5",
        "cpi": "CPI",
        "unemployment": "Unemployment",
        "is_holiday": "IsHoliday"
    }, inplace=True)

    # DATE CONVERSION
    sales["Date"] = pd.to_datetime(sales["Date"], errors="coerce")
    features["Date"] = pd.to_datetime(features["Date"], errors="coerce")

    # BOOLEAN FIX
    sales["IsHoliday"] = sales["IsHoliday"].astype(bool)
    features["IsHoliday"] = features["IsHoliday"].astype(bool)

    # MARKDOWN CLEANING
    markdown_cols = [
        "MarkDown1",
        "MarkDown2",
        "MarkDown3",
        "MarkDown4",
        "MarkDown5"
    ]

    for col in markdown_cols:
        if col in features.columns:
            features[col] = pd.to_numeric(
                features[col],
                errors="coerce"
            ).fillna(0)

    # TOTAL MARKDOWN
    features["TotalMarkdown"] = features[
        markdown_cols
    ].sum(axis=1)

    # MERGE DATA
    df = sales.merge(
        stores,
        on="Store",
        how="left"
    )

    df = df.merge(
        features,
        on=["Store", "Date"],
        how="left"
    )

    # FILL NA
    df["TotalMarkdown"] = df["TotalMarkdown"].fillna(0)

    # DATE FEATURES
    df["Year"] = df["Date"].dt.year
    df["Month"] = df["Date"].dt.month
    df["YearMonth"] = df["Date"].dt.to_period("M")

    return df


df = load_data()

# ─────────────────────────────────────────────────────────────
# SIDEBAR
# ─────────────────────────────────────────────────────────────

st.sidebar.title("📦 Retail Intelligence")

store_types = sorted(df["Type"].dropna().unique())

selected_types = st.sidebar.multiselect(
    "Store Type",
    store_types,
    default=store_types
)

years = sorted(df["Year"].dropna().unique())

selected_years = st.sidebar.multiselect(
    "Year",
    years,
    default=years
)

page = st.sidebar.radio(
    "Navigate",
    [
        "Dashboard",
        "Demand Trends",
        "Store Analysis",
        "Holiday Impact",
        "External Factors"
    ]
)

# FILTER
dff = df[
    (df["Type"].isin(selected_types)) &
    (df["Year"].isin(selected_years))
]

# ─────────────────────────────────────────────────────────────
# HELPER
# ─────────────────────────────────────────────────────────────

def money(x):
    if x >= 1e9:
        return f"${x/1e9:.1f}B"
    if x >= 1e6:
        return f"${x/1e6:.1f}M"
    if x >= 1e3:
        return f"${x/1e3:.1f}K"
    return f"${x:.0f}"

# ─────────────────────────────────────────────────────────────
# DASHBOARD
# ─────────────────────────────────────────────────────────────

if page == "Dashboard":

    st.title("📦 Retail Demand Intelligence")

    total_sales = dff["Weekly_Sales"].sum()
    avg_sales = dff["Weekly_Sales"].mean()
    stores = dff["Store"].nunique()
    departments = dff["Dept"].nunique()

    c1, c2, c3, c4 = st.columns(4)

    c1.metric("Total Revenue", money(total_sales))
    c2.metric("Avg Weekly Sales", money(avg_sales))
    c3.metric("Stores", stores)
    c4.metric("Departments", departments)

    st.markdown("---")

    st.subheader("Monthly Revenue Trend")

    monthly = dff.groupby("YearMonth")["Weekly_Sales"].sum().reset_index()
    monthly["YearMonth"] = monthly["YearMonth"].astype(str)

    fig, ax = plt.subplots(figsize=(12, 4))

    ax.plot(
        monthly["YearMonth"],
        monthly["Weekly_Sales"],
        linewidth=2
    )

    ax.tick_params(axis='x', rotation=45)

    st.pyplot(fig)

# ─────────────────────────────────────────────────────────────
# DEMAND TRENDS
# ─────────────────────────────────────────────────────────────

elif page == "Demand Trends":

    st.title("📈 Demand Trends")

    store = st.selectbox(
        "Select Store",
        sorted(dff["Store"].unique())
    )

    dept = st.selectbox(
        "Select Department",
        sorted(
            dff[dff["Store"] == store]["Dept"].unique()
        )
    )

    ts = dff[
        (dff["Store"] == store) &
        (dff["Dept"] == dept)
    ].sort_values("Date")

    ts["Rolling4"] = ts["Weekly_Sales"].rolling(4).mean()

    fig, ax = plt.subplots(figsize=(12, 5))

    ax.plot(
        ts["Date"],
        ts["Weekly_Sales"],
        label="Weekly Sales"
    )

    ax.plot(
        ts["Date"],
        ts["Rolling4"],
        linewidth=3,
        label="4 Week Average"
    )

    ax.legend()

    st.pyplot(fig)

# ─────────────────────────────────────────────────────────────
# STORE ANALYSIS
# ─────────────────────────────────────────────────────────────

elif page == "Store Analysis":

    st.title("🏪 Store Benchmarking")

    store_perf = dff.groupby(
        ["Store", "Type", "Size"]
    ).agg(
        TotalRevenue=("Weekly_Sales", "sum"),
        AvgSales=("Weekly_Sales", "mean")
    ).reset_index()

    store_perf["RevenuePerSqFt"] = (
        store_perf["TotalRevenue"] /
        store_perf["Size"]
    )

    fig, ax = plt.subplots(figsize=(10, 5))

    scatter = ax.scatter(
        store_perf["Size"],
        store_perf["RevenuePerSqFt"],
        s=80
    )

    ax.set_xlabel("Store Size")
    ax.set_ylabel("Revenue per Sq Ft")

    st.pyplot(fig)

    st.dataframe(store_perf)

# ─────────────────────────────────────────────────────────────
# HOLIDAY IMPACT
# ─────────────────────────────────────────────────────────────

elif page == "Holiday Impact":

    st.title("🎄 Holiday Impact")

    holiday = dff.groupby(
        "IsHoliday"
    )["Weekly_Sales"].mean()

    fig, ax = plt.subplots(figsize=(6, 4))

    ax.bar(
        ["Regular", "Holiday"],
        holiday.values
    )

    st.pyplot(fig)

    st.dataframe(holiday)

# ─────────────────────────────────────────────────────────────
# EXTERNAL FACTORS
# ─────────────────────────────────────────────────────────────

elif page == "External Factors":

    st.title("🌡️ External Factor Signals")

    factors = [
        "Fuel_Price",
        "CPI",
        "Unemployment",
        "Temperature"
    ]

    factor = st.selectbox(
        "Choose Factor",
        factors
    )

    sub = dff[
        [factor, "Weekly_Sales"]
    ].dropna()

    fig, ax = plt.subplots(figsize=(10, 5))

    ax.scatter(
        sub[factor],
        sub["Weekly_Sales"],
        alpha=0.4
    )

    ax.set_xlabel(factor)
    ax.set_ylabel("Weekly Sales")

    st.pyplot(fig)

    # CORRELATION
    r = sub[factor].corr(sub["Weekly_Sales"])

    st.metric(
        "Correlation",
        round(r, 3)
    )