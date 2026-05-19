"""
Retail Store Sales Forecasting DBMS — Streamlit Dashboard
DS-604 | THE INSIGHT EXPRESS

Run:  streamlit run app.py
"""
import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import seaborn as sns
from sqlalchemy import create_engine, text
import warnings
warnings.filterwarnings("ignore")

# ── Page config ─────────────────────────────────────────────
st.set_page_config(
    page_title="Retail Sales Forecasting DBMS",
    page_icon="🛒",
    layout="wide",
)

# ── DB connection (cached) ───────────────────────────────────
@st.cache_resource
def get_engine():
    USER     = st.secrets.get("DB_USER",     "postgres")
    PASSWORD = st.secrets.get("DB_PASSWORD", "Nisha0123")
    HOST     = st.secrets.get("DB_HOST",     "localhost")
    PORT     = st.secrets.get("DB_PORT",     "5432")
    DATABASE = st.secrets.get("DB_NAME",     "retail_store")
    return create_engine(
        f"postgresql+psycopg2://{USER}:{PASSWORD}@{HOST}:{PORT}/{DATABASE}"
    )

@st.cache_data(ttl=300)
def run_query(sql: str) -> pd.DataFrame:
    engine = get_engine()
    with engine.connect() as conn:
        return pd.read_sql(text(sql), conn)

SCHEMA = "retail"

# ── Sidebar navigation ───────────────────────────────────────
st.sidebar.image("https://img.icons8.com/color/96/shopping-cart.png", width=60)
st.sidebar.title("📦 Retail DBMS")
st.sidebar.caption("DS-604 | THE INSIGHT EXPRESS")

page = st.sidebar.radio(
    "Navigate",
    [
        "🏠 Overview",
        "📅 Holiday Impact",
        "🏷️ Markdown Effectiveness",
        "🏪 Store Performance",
        "📦 Department Revenue",
        "🌡️ External Factors",
        "🔍 Data Quality",
        "🔮 Demand Forecast",
    ],
)

# ── Overview ────────────────────────────────────────────────
if page == "🏠 Overview":
    st.title("🛒 Retail Store Sales Forecasting DBMS")
    st.markdown(
        """
        **DS-604 Introduction to Data Management** | Team: *THE INSIGHT EXPRESS*  
        Sanjana (202518002) · Srishti (202518003) · Nikita (202518038)
        """
    )
    st.divider()

    col1, col2, col3, col4 = st.columns(4)
    try:
        total_sales   = run_query(f"SELECT SUM(weekly_sales) AS v FROM {SCHEMA}.sales;").iloc[0,0]
        total_stores  = run_query(f"SELECT COUNT(DISTINCT store_id) AS v FROM {SCHEMA}.store;").iloc[0,0]
        total_depts   = run_query(f"SELECT COUNT(DISTINCT dept_id)  AS v FROM {SCHEMA}.sales;").iloc[0,0]
        total_records = run_query(f"SELECT COUNT(*) AS v FROM {SCHEMA}.sales;").iloc[0,0]

        col1.metric("💰 Total Revenue",    f"${total_sales:,.0f}")
        col2.metric("🏪 Stores",           int(total_stores))
        col3.metric("📦 Departments",      int(total_depts))
        col4.metric("📝 Weekly Records",   f"{total_records:,}")
    except Exception as e:
        st.warning(f"Could not load metrics — check DB connection. Error: {e}")

    st.subheader("Schema Overview")
    st.markdown("""
    | Table | Rows (est.) | Purpose |
    |-------|------------|---------|
    | `retail.store` | 45 | Store metadata |
    | `retail.department` | 99 | Department catalogue |
    | `retail.sales` | ~421 K | Weekly sales fact table |
    | `retail.features` | ~8,190 | External economic features |
    | `retail.holiday` | ~10 | Holiday calendar |
    """)

# ── Holiday Impact ──────────────────────────────────────────
elif page == "📅 Holiday Impact":
    st.title("📅 Holiday vs Non-Holiday Sales")

    df = run_query(f"""
    SELECT st.store_type, s.is_holiday,
        ROUND(AVG(s.weekly_sales)::numeric, 2) AS avg_weekly_sales,
        ROUND(SUM(s.weekly_sales)::numeric, 2) AS total_sales,
        COUNT(*) AS num_records
    FROM {SCHEMA}.sales s
    JOIN {SCHEMA}.store st ON s.store_id = st.store_id
    GROUP BY st.store_type, s.is_holiday
    ORDER BY st.store_type, s.is_holiday DESC;
""")

    col1, col2 = st.columns(2)
    with col1:
        pivot = df.pivot(index="store_type", columns="is_holiday", values="avg_weekly_sales")
        pivot.columns = ["Non-Holiday", "Holiday"]
        fig, ax = plt.subplots(figsize=(7, 4))
        pivot.plot(kind="bar", ax=ax, color=["#4C72B0","#DD8452"], edgecolor="black")
        ax.set_title("Avg Weekly Sales by Store Type & Holiday Flag")
        ax.set_ylabel("Avg Weekly Sales ($)")
        ax.set_xlabel("Store Type")
        ax.tick_params(axis="x", rotation=0)
        ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"${x:,.0f}"))
        plt.tight_layout()
        st.pyplot(fig)

    with col2:
        uplift = run_query("SELECT * FROM retail.vw_holiday_sales_uplift;")
        st.subheader("Holiday Uplift %")
        st.dataframe(uplift, use_container_width=True)
        st.caption("Holiday uplift = (holiday avg − regular avg) / regular avg × 100")

# ── Markdown Effectiveness ──────────────────────────────────
elif page == "🏷️ Markdown Effectiveness":
    st.title("🏷️ Markdown Effectiveness")
    df = run_query("""
        SELECT * FROM retail.vw_markdown_effectiveness
        WHERE total_markdown_spend > 0
        ORDER BY markdown_roi DESC
        LIMIT 30;
    """)

    col1, col2 = st.columns(2)
    with col1:
        fig, ax = plt.subplots(figsize=(7,4))
        sns.scatterplot(data=df, x="total_markdown_spend", y="avg_weekly_sales",
                        hue="store_type", size="weeks_tracked",
                        sizes=(40, 200), ax=ax, palette="Set2")
        ax.set_title("Markdown Spend vs Avg Weekly Sales")
        ax.set_xlabel("Total Markdown Spend ($)")
        ax.set_ylabel("Avg Weekly Sales ($)")
        ax.xaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"${x/1e3:.0f}K"))
        plt.tight_layout()
        st.pyplot(fig)

    with col2:
        fig2, ax2 = plt.subplots(figsize=(7,4))
        top10 = df.head(10)
        ax2.barh(top10["store_id"].astype(str), top10["markdown_roi"],
                 color="#55A868", edgecolor="black")
        ax2.set_title("Top 10 Stores — Markdown ROI")
        ax2.set_xlabel("Sales per Markdown Dollar")
        ax2.invert_yaxis()
        plt.tight_layout()
        st.pyplot(fig2)

    st.subheader("Detailed Table")
    st.dataframe(df, use_container_width=True)

# ── Store Performance ───────────────────────────────────────
elif page == "🏪 Store Performance":
    st.title("🏪 Store Type Performance")
    df = run_query(f"""
        SELECT st.store_type,
            COUNT(DISTINCT st.store_id)  AS num_stores,
            ROUND(SUM(s.weekly_sales)::numeric, 2) AS total_revenue,
            ROUND(AVG(s.weekly_sales)::numeric, 2) AS avg_weekly_sales,
            ROUND(AVG(st.store_size)::numeric, 0)  AS avg_store_size
        FROM {SCHEMA}.sales s
        JOIN {SCHEMA}.store st ON s.store_id = st.store_id
        GROUP BY st.store_type ORDER BY total_revenue DESC;
    """)
    col1, col2 = st.columns(2)
    with col1:
        fig, ax = plt.subplots(figsize=(5,5))
        ax.pie(df["total_revenue"], labels=df["store_type"],
               autopct="%1.1f%%", startangle=140,
               colors=["#4C72B0","#55A868","#C44E52"])
        ax.set_title("Revenue Share by Store Type")
        plt.tight_layout()
        st.pyplot(fig)
    with col2:
        st.dataframe(df, use_container_width=True)


    # Spike alerts log
    try:
        spikes = run_query(f"""
            SELECT * FROM {SCHEMA}.sales_spike_log
            ORDER BY logged_at DESC LIMIT 20;
        """)
        if len(spikes):
            st.subheader("🔔 Sales Spike Alerts (Trigger Log)")
            st.dataframe(spikes, use_container_width=True)
    except Exception:
        pass

# ── Department Revenue ──────────────────────────────────────
elif page == "📦 Department Revenue":
    st.title("📦 Top Departments by Revenue")
    df = run_query("SELECT * FROM retail.vw_top_departments_by_revenue LIMIT 30;")
    top_n = st.slider("Show top N departments", 5, 30, 15)
    df_top = df.head(top_n)

    fig, ax = plt.subplots(figsize=(12, 5))
    sns.barplot(data=df_top, x="dept_name", y="total_revenue",
                palette="Blues_d", ax=ax)
    ax.set_title(f"Top {top_n} Departments — Total Revenue")
    ax.set_xlabel("Department")
    ax.set_ylabel("Total Revenue ($)")
    ax.tick_params(axis="x", rotation=45)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"${x/1e6:.1f}M"))
    plt.tight_layout()
    st.pyplot(fig)

    st.subheader("Full Table")
    st.dataframe(df, use_container_width=True)

# ── External Factors ────────────────────────────────────────
elif page == "🌡️ External Factors":
    st.title("🌡️ CPI, Unemployment & Fuel Price Impact")

    df_cpi = run_query(f"""
        SELECT
            CASE WHEN f.cpi < 130 THEN 'Low CPI'
                 WHEN f.cpi < 160 THEN 'Mid CPI' ELSE 'High CPI' END AS cpi_bucket,
            ROUND(AVG(s.weekly_sales)::numeric, 2) AS avg_sales, COUNT(*) AS n
        FROM {SCHEMA}.sales s
        JOIN {SCHEMA}.features f ON s.store_id=f.store_id AND s.sale_date=f.feature_date
        WHERE f.cpi IS NOT NULL GROUP BY cpi_bucket ORDER BY avg_sales DESC;
    """)

    df_fuel = run_query(f"""
        SELECT
            CASE WHEN f.fuel_price < 3.0 THEN 'Cheap'
                 WHEN f.fuel_price < 3.5 THEN 'Normal'
                 WHEN f.fuel_price < 4.0 THEN 'High' ELSE 'Very High' END AS fuel_bucket,
            ROUND(AVG(s.weekly_sales)::numeric, 2) AS avg_sales
        FROM {SCHEMA}.sales s
        JOIN {SCHEMA}.features f ON s.store_id=f.store_id AND s.sale_date=f.feature_date
        WHERE f.fuel_price IS NOT NULL GROUP BY fuel_bucket ORDER BY avg_sales DESC;
    """)


    col1, col2 = st.columns(2)
    with col1:
        fig, ax = plt.subplots(figsize=(6,4))
        ax.bar(df_cpi["cpi_bucket"], df_cpi["avg_sales"],
               color=["#4C72B0","#55A868","#C44E52"])
        ax.set_title("Avg Sales by CPI Bucket")
        ax.set_ylabel("Avg Weekly Sales ($)")
        ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x,_: f"${x:,.0f}"))
        plt.tight_layout()
        st.pyplot(fig)

    with col2:
        fig2, ax2 = plt.subplots(figsize=(6,4))
        ax2.bar(df_fuel["fuel_bucket"], df_fuel["avg_sales"],
                color=["#DD8452","#937860","#C44E52","#8C8C8C"])
        ax2.set_title("Avg Sales by Fuel Price Bucket")
        ax2.set_ylabel("Avg Weekly Sales ($)")
        ax2.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x,_: f"${x:,.0f}"))
        plt.tight_layout()
        st.pyplot(fig2)

# ── Data Quality ────────────────────────────────────────────
elif page == "🔍 Data Quality":
    st.title("🔍 Data Quality & Orphan Check")
    df = run_query(f"""
        WITH dq AS (
            SELECT 'Sales with no Store'         AS issue, COUNT(*) AS cnt
            FROM {SCHEMA}.sales s LEFT JOIN {SCHEMA}.store st ON s.store_id=st.store_id
            WHERE st.store_id IS NULL
            UNION ALL
            SELECT 'Negative weekly_sales',       COUNT(*) FROM {SCHEMA}.sales WHERE weekly_sales < 0
            UNION ALL
            SELECT 'NULL weekly_sales',           COUNT(*) FROM {SCHEMA}.sales WHERE weekly_sales IS NULL
            UNION ALL
            SELECT 'Features with NULL CPI',      COUNT(*) FROM {SCHEMA}.features WHERE cpi IS NULL
            UNION ALL
            SELECT 'Features with NULL fuel',     COUNT(*) FROM {SCHEMA}.features WHERE fuel_price IS NULL
            UNION ALL
            SELECT 'Sales rows without Features', COUNT(*)
            FROM {SCHEMA}.sales s
            LEFT JOIN {SCHEMA}.features f ON s.store_id=f.store_id AND s.sale_date=f.feature_date
            WHERE f.store_id IS NULL
        )
        SELECT * FROM dq ORDER BY cnt DESC;
    """)

    all_clean = df["cnt"].sum() == 0
    if all_clean:
        st.success("✅ No data quality issues found! Dataset is clean.")
    else:
        st.warning("⚠️ Some data quality issues detected.")
    st.dataframe(df, use_container_width=True)

    # Markdown anomaly log
    try:
        anomalies = run_query(f"SELECT * FROM {SCHEMA}.markdown_anomaly_log ORDER BY logged_at DESC LIMIT 20;")
        if len(anomalies):
            st.subheader("🏷️ Markdown Anomaly Alerts")
            st.dataframe(anomalies, use_container_width=True)
    except Exception:
        pass

# ── Demand Forecast ─────────────────────────────────────────
elif page == "🔮 Demand Forecast":
    st.title("🔮 Demand Forecast")

    store_ids = run_query(f"SELECT DISTINCT store_id FROM {SCHEMA}.store ORDER BY store_id;")
    selected_store = st.selectbox("Select Store", store_ids["store_id"].tolist())

    ts = run_query(f"""
    SELECT sale_date AS ds, total_weekly_sales AS y
    FROM {SCHEMA}.vw_store_weekly_summary
    WHERE store_id = {selected_store}
    ORDER BY sale_date;
""")

# Ensure both ds and y are valid
    ts["ds"] = pd.to_datetime(ts["ds"], errors="coerce")   # coerce invalid dates to NaT
    ts = ts.dropna(subset=["ds", "y"])                     # drop rows with NaN in ds or y
    ts = ts.set_index("ds").sort_index()

    prophet_df = ts.reset_index()[["ds", "y"]]


    st.subheader(f"Store {selected_store} — Historical Weekly Sales")
    fig, ax = plt.subplots(figsize=(13, 4))
    ax.plot(ts.index, ts["y"], linewidth=1.3, color="steelblue")
    ax.set_ylabel("Weekly Sales ($)")
    ax.set_xlabel("Date")
    ax.set_title(f"Store {selected_store} Weekly Sales")
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"${x/1e6:.1f}M"))
    plt.tight_layout()
    st.pyplot(fig)

    forecast_weeks = st.slider("Forecast horizon (weeks)", 4, 26, 12)

    try:
        from prophet import Prophet
        prophet_df = ts.reset_index().rename(columns={"ds": "ds", "y": "y"})
        prophet_df["ds"] = pd.to_datetime(prophet_df["ds"])
        prophet_df = prophet_df.dropna(subset=["y"])

        m = Prophet(yearly_seasonality=True, weekly_seasonality=False,
                    daily_seasonality=False, interval_width=0.95)
        m.fit(prophet_df)

        future   = m.make_future_dataframe(periods=forecast_weeks, freq="W")
        forecast = m.predict(future)

        fig2, ax2 = plt.subplots(figsize=(13, 5))
        ax2.plot(prophet_df["ds"], prophet_df["y"], label="Actual", color="steelblue")
        ax2.plot(forecast["ds"], forecast["yhat"], label="Forecast", color="darkorange")
        ax2.fill_between(forecast["ds"], forecast["yhat_lower"], forecast["yhat_upper"],
                         alpha=0.2, color="darkorange", label="95% CI")
        ax2.set_title(f"Store {selected_store} — Prophet {forecast_weeks}-Week Forecast")
        ax2.set_ylabel("Weekly Sales ($)")
        ax2.legend()
        ax2.yaxis.set_major_formatter(mticker.FuncFormatter(lambda x,_: f"${x/1e6:.1f}M"))
        plt.tight_layout()
        st.pyplot(fig2)

        st.subheader("Forecast Table (next weeks)")
        future_only = forecast[forecast["ds"] > prophet_df["ds"].max()][
            ["ds", "yhat", "yhat_lower", "yhat_upper"]
        ].round(2)
        future_only.columns = ["Date", "Forecast ($)", "Lower CI", "Upper CI"]
        st.dataframe(future_only, use_container_width=True)

    except ImportError:
        st.info("Prophet not installed. Run `pip install prophet` to enable forecasting.")
        st.markdown("""
        **Alternative:** SARIMA model is available in `notebooks/final.ipynb`.
        Install with: `pip install statsmodels`
        """)
