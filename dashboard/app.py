"""
RETAIL DEMAND INTELLIGENCE PLATFORM
DS-604 | THE INSIGHT EXPRESS
Sanjana (202518002) · Srishti (202518003) · Nikita (202518038)
"""

import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import seaborn as sns
from scipy import stats
import warnings, os

warnings.filterwarnings("ignore")

st.set_page_config(
    page_title="Retail Demand Intelligence",
    page_icon="📦",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;600&family=Courier+Prime:wght@400;700&display=swap');
html, body, [class*="css"] { font-family: 'DM Sans', sans-serif; background: #0e1117; color: #e8e4dc; }
h1, h2, h3 { font-family: 'Courier Prime', monospace; }
.block-container { padding: 2rem 2.5rem; }
.kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 28px; }
.kpi-card { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 20px 22px; position: relative; overflow: hidden; }
.kpi-card::before { content: ''; position: absolute; top:0; left:0; width:3px; height:100%; background: var(--accent); }
.kpi-card .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #8b949e; margin-bottom: 6px; }
.kpi-card .value { font-family: 'Courier Prime', monospace; font-size: 28px; font-weight: 700; color: #e8e4dc; }
.kpi-card .delta { font-size: 12px; margin-top: 4px; }
.alert-high   { background:#ff4b4b22; border-left:3px solid #ff4b4b; padding:10px 14px; border-radius:6px; margin:6px 0; }
.alert-medium { background:#ffa50022; border-left:3px solid #ffa500; padding:10px 14px; border-radius:6px; margin:6px 0; }
.alert-low    { background:#00c85322; border-left:3px solid #00c853; padding:10px 14px; border-radius:6px; margin:6px 0; }
.section-tag { font-family: 'Courier Prime', monospace; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #e8bd5c; border-bottom: 1px solid #e8bd5c33; padding-bottom: 6px; margin: 28px 0 18px; }
[data-testid="stSidebar"] { background: #0d1117; border-right: 1px solid #21262d; }
</style>
""", unsafe_allow_html=True)

# ── Data Loading ──────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'dataset')

@st.cache_data(show_spinner="Loading datasets…")
def load_data():
    sales    = pd.read_csv(os.path.join(DATA_DIR, 'sales.csv'))
    stores   = pd.read_csv(os.path.join(DATA_DIR, 'stores.csv'))
    features = pd.read_csv(os.path.join(DATA_DIR, 'features.csv'))
    sales['Date']    = pd.to_datetime(sales['Date'],    dayfirst=True, errors='coerce')
    features['Date'] = pd.to_datetime(features['Date'], dayfirst=True, errors='coerce')
    sales['IsHoliday']    = sales['IsHoliday'].astype(str).str.lower().map({'true':True,'false':False}).fillna(False)
    features['IsHoliday'] = features['IsHoliday'].astype(str).str.lower().map({'true':True,'false':False}).fillna(False)
    for c in ['MarkDown1','MarkDown2','MarkDown3','MarkDown4','MarkDown5']:
        features[c] = pd.to_numeric(features[c], errors='coerce').fillna(0)
    features['TotalMarkdown'] = features[['MarkDown1','MarkDown2','MarkDown3','MarkDown4','MarkDown5']].sum(axis=1)
    df = sales.merge(stores, on='Store').merge(features, on=['Store','Date'], how='left', suffixes=('','_f'))
    df['IsHoliday']     = df['IsHoliday'].fillna(False)
    df['TotalMarkdown'] = df['TotalMarkdown'].fillna(0)
    df['Year']          = df['Date'].dt.year
    df['Month']         = df['Date'].dt.month
    df['YearMonth']     = df['Date'].dt.to_period('M')
    return df, sales, stores, features

df, sales_raw, stores_raw, features_raw = load_data()

# ── Sidebar ───────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## 📦 Retail Intelligence")
    st.caption("THE INSIGHT EXPRESS · DS-604")
    st.divider()
    page = st.radio("Navigate", [
        "🏠  Command Centre",
        "🚨  Inventory Risk Alerts",
        "🎄  Holiday & Markdown Impact",
        "🏪  Store Benchmarking",
        "📦  Department Demand Ranking",
        "📈  Demand Trend Explorer",
        "🌡️  External Factor Signals",
    ])
    st.divider()
    st.markdown("**Global Filters**")
    store_type_filter = st.multiselect("Store Type", ['A','B','C'], default=['A','B','C'])
    year_filter = st.multiselect("Year", sorted(df['Year'].unique()), default=sorted(df['Year'].unique()))
    dff = df[df['Type'].isin(store_type_filter) & df['Year'].isin(year_filter)]
    st.caption(f"{len(dff):,} records selected")

# ── Theme helpers ─────────────────────────────────────────────
GOLD='#e8bd5c'; CORAL='#ff6b6b'; TEAL='#4ecdc4'; LAV='#a78bfa'; GREEN='#00c853'

def dark(ax, fig=None):
    ax.set_facecolor('#161b22')
    if fig: fig.patch.set_facecolor('#0e1117')
    for sp in ax.spines.values(): sp.set_edgecolor('#30363d')
    ax.tick_params(colors='#8b949e', labelsize=9)
    ax.xaxis.label.set_color('#8b949e'); ax.yaxis.label.set_color('#8b949e')
    ax.title.set_color('#e8e4dc')
    ax.grid(True, color='#21262d', lw=0.6, ls='--'); ax.set_axisbelow(True)

def fusd(x, pos=None):
    if x>=1e9: return f'${x/1e9:.1f}B'
    if x>=1e6: return f'${x/1e6:.1f}M'
    if x>=1e3: return f'${x/1e3:.0f}K'
    return f'${x:.0f}'

# ══════════════════════════════════════════════════════════════
# PAGE 1: COMMAND CENTRE
# ══════════════════════════════════════════════════════════════
if "Command Centre" in page:
    st.markdown("# 📦 Retail Demand Intelligence Platform")
    st.markdown("**A decision-support system for retail operations** — turning raw sales signals into inventory risk alerts, markdown ROI scores, and demand forecasting inputs.")

    total_rev   = dff['Weekly_Sales'].sum()
    avg_wk      = dff.groupby(['Store','Date'])['Weekly_Sales'].sum().mean()
    holiday_pct = dff[dff['IsHoliday']]['Weekly_Sales'].sum() / total_rev * 100
    n_stores    = dff['Store'].nunique()
    n_depts     = dff['Dept'].nunique()

    st.markdown(
        f"""<div class="kpi-grid">
          <div class="kpi-card" style="--accent:{GOLD}">
            <div class="label">Total Revenue</div><div class="value">{fusd(total_rev)}</div>
            <div class="delta" style="color:{GOLD}">{n_stores} stores · {n_depts} depts</div>
          </div>
          <div class="kpi-card" style="--accent:{TEAL}">
            <div class="label">Avg Weekly / Store</div><div class="value">{fusd(avg_wk)}</div>
            <div class="delta" style="color:{TEAL}">per store per week</div>
          </div>
          <div class="kpi-card" style="--accent:{CORAL}">
            <div class="label">Holiday Revenue Share</div><div class="value">{holiday_pct:.1f}%</div>
            <div class="delta" style="color:{CORAL}">of total revenue</div>
          </div>
          <div class="kpi-card" style="--accent:{LAV}">
            <div class="label">Store × Dept Combos</div><div class="value">{n_stores}×{n_depts}</div>
            <div class="delta" style="color:{LAV}">active combinations</div>
          </div>
        </div>""", unsafe_allow_html=True)

    col1, col2 = st.columns([3,2])
    with col1:
        st.markdown('<div class="section-tag">Monthly Revenue Trend</div>', unsafe_allow_html=True)
        monthly = dff.groupby('YearMonth')['Weekly_Sales'].sum().reset_index()
        monthly['dt'] = monthly['YearMonth'].dt.to_timestamp()
        fig, ax = plt.subplots(figsize=(9,3.5))
        dark(ax, fig)
        ax.fill_between(monthly['dt'], monthly['Weekly_Sales'], alpha=0.15, color=GOLD)
        ax.plot(monthly['dt'], monthly['Weekly_Sales'], color=GOLD, lw=2)
        hol = dff[dff['IsHoliday']].groupby('YearMonth')['Weekly_Sales'].sum().reset_index()
        hol['dt'] = hol['YearMonth'].dt.to_timestamp()
        ax.scatter(hol['dt'], hol['Weekly_Sales'], color=CORAL, s=40, zorder=5, label='Holiday month')
        ax.yaxis.set_major_formatter(mticker.FuncFormatter(fusd))
        ax.set_title('Monthly Revenue · holiday months highlighted', fontsize=11)
        ax.legend(facecolor='#161b22', edgecolor='#30363d', labelcolor='#e8e4dc', fontsize=9)
        plt.tight_layout(); st.pyplot(fig); plt.close()
    with col2:
        st.markdown('<div class="section-tag">Revenue by Store Type</div>', unsafe_allow_html=True)
        type_rev = dff.groupby('Type')['Weekly_Sales'].sum().sort_values(ascending=False)
        fig, ax = plt.subplots(figsize=(5,3.5))
        dark(ax, fig)
        bars = ax.bar(type_rev.index, type_rev.values, color=[GOLD,TEAL,CORAL][:len(type_rev)], edgecolor='#0e1117', width=0.5)
        for bar, val in zip(bars, type_rev.values):
            ax.text(bar.get_x()+bar.get_width()/2, val*1.01, fusd(val), ha='center', va='bottom', fontsize=9, color='#e8e4dc')
        ax.yaxis.set_major_formatter(mticker.FuncFormatter(fusd))
        ax.set_title('Total Revenue by Store Type', fontsize=11)
        plt.tight_layout(); st.pyplot(fig); plt.close()

    c1,c2,c3 = st.columns(3)
    with c1:
        st.markdown("**🚨 Inventory Risk**\n\nRetail loses ~$1.75T/year globally to overstock and stockout. This platform detects demand spikes and drops *before* they become stock crises — per store-department.")
    with c2:
        st.markdown("**🏷️ Markdown Intelligence**\n\nRetailers discount $300B annually, but most can't measure ROI. We correlate markdown spend against sales lift to identify *which stores benefit* and which are discounting wastefully.")
    with c3:
        st.markdown("**📈 Demand Forecasting**\n\nHoliday weeks drive 24–26% higher sales across all store types. Knowing which departments spike helps buyers plan procurement 4–6 weeks ahead of peak periods.")

# ══════════════════════════════════════════════════════════════
# PAGE 2: INVENTORY RISK ALERTS
# ══════════════════════════════════════════════════════════════
elif "Inventory Risk" in page:
    st.markdown("# 🚨 Inventory Risk Alerts")
    st.markdown("Identifies store-department pairs with **unusual demand signals** using a rolling z-score. Sudden spikes = stockout risk. Sustained drops = overstock risk.")

    @st.cache_data
    def compute_alerts(key):
        sub = dff.copy()
        results = []
        for (store, dept), g in sub.groupby(['Store','Dept']):
            g = g.sort_values('Date')
            if len(g) < 6: continue
            rm = g['Weekly_Sales'].rolling(6, min_periods=4).mean()
            rs = g['Weekly_Sales'].rolling(6, min_periods=4).std().replace(0, np.nan)
            z = (g['Weekly_Sales'] - rm) / rs
            last_z = z.iloc[-1]; last_val = g['Weekly_Sales'].iloc[-1]; hist_avg = g['Weekly_Sales'].mean()
            t4 = g['Weekly_Sales'].iloc[-4:].mean()
            tp = g['Weekly_Sales'].iloc[-8:-4].mean() if len(g)>=8 else hist_avg
            tchg = (t4-tp)/(tp+1e-9)*100
            if   last_z >  2.0: sev,atype = 'HIGH',   'Demand Spike — Stockout Risk'
            elif last_z >  1.2: sev,atype = 'MEDIUM', 'Above-Average Demand'
            elif last_z < -2.0: sev,atype = 'HIGH',   'Demand Crash — Overstock Risk'
            elif last_z < -1.2: sev,atype = 'MEDIUM', 'Below-Average Demand'
            elif tchg >  20:    sev,atype = 'MEDIUM', 'Rising Trend'
            elif tchg < -20:    sev,atype = 'MEDIUM', 'Declining Trend'
            else: continue
            results.append({'Store':store,'Dept':dept,'Alert':atype,'Severity':sev,
                             'Last Sales':round(last_val,0),'Hist Avg':round(hist_avg,0),
                             'Z-Score':round(last_z,2),'4wk Trend':f"{tchg:+.1f}%"})
        return pd.DataFrame(results)

    cache_key = str(store_type_filter) + str(year_filter)
    alerts_df = compute_alerts(cache_key)

    if alerts_df.empty:
        st.success("No significant risk alerts in the selected filters.")
    else:
        high   = alerts_df[alerts_df['Severity']=='HIGH']
        medium = alerts_df[alerts_df['Severity']=='MEDIUM']
        col1,col2,col3 = st.columns(3)
        col1.metric("🔴 HIGH Alerts",   len(high))
        col2.metric("🟡 MEDIUM Alerts", len(medium))
        col3.metric("Stores Flagged",  alerts_df['Store'].nunique())

        st.markdown("### 🔴 High Severity")
        for _, row in high.head(10).iterrows():
            icon = "📈" if "Spike" in row['Alert'] else "📉"
            st.markdown(f'<div class="alert-high">{icon} <b>Store {row["Store"]} · Dept {row["Dept"]}</b> — {row["Alert"]} | Last: ${row["Last Sales"]:,.0f} vs avg ${row["Hist Avg"]:,.0f} (z={row["Z-Score"]}) | {row["4wk Trend"]}</div>', unsafe_allow_html=True)

        st.markdown("### 🟡 Medium Severity")
        st.dataframe(medium.sort_values('Z-Score', key=abs, ascending=False).head(25), use_container_width=True, hide_index=True)

        st.markdown('<div class="section-tag">Alert Distribution by Store Type</div>', unsafe_allow_html=True)
        ma = alerts_df.merge(stores_raw, on='Store')
        tc = ma.groupby(['Type','Severity']).size().unstack(fill_value=0)
        fig, ax = plt.subplots(figsize=(8,3.5))
        dark(ax, fig)
        x = np.arange(len(tc)); w=0.35
        for i,(sev,color) in enumerate({'HIGH':CORAL,'MEDIUM':GOLD}.items()):
            if sev in tc.columns:
                ax.bar(x+i*w-w/2, tc[sev], w, label=sev, color=color, edgecolor='#0e1117')
        ax.set_xticks(x); ax.set_xticklabels([f"Type {t}" for t in tc.index])
        ax.set_ylabel("Alert Count"); ax.set_title("Risk Alerts by Store Type")
        ax.legend(facecolor='#161b22', edgecolor='#30363d', labelcolor='#e8e4dc')
        plt.tight_layout(); st.pyplot(fig); plt.close()

    st.markdown('<div class="section-tag">Drill-Down: Store + Department History</div>', unsafe_allow_html=True)
    c1,c2 = st.columns(2)
    with c1: sel_store = st.selectbox("Store", sorted(dff['Store'].unique()))
    with c2: sel_dept  = st.selectbox("Dept",  sorted(dff[dff['Store']==sel_store]['Dept'].unique()))
    ts = dff[(dff['Store']==sel_store)&(dff['Dept']==sel_dept)].sort_values('Date')
    if len(ts)>4:
        fig, ax = plt.subplots(figsize=(11,3.5))
        dark(ax, fig)
        roll = ts['Weekly_Sales'].rolling(4, min_periods=2).mean()
        ax.fill_between(ts['Date'], ts['Weekly_Sales'], alpha=0.10, color=TEAL)
        ax.plot(ts['Date'], ts['Weekly_Sales'], color=TEAL, lw=1.5, label='Weekly Sales')
        ax.plot(ts['Date'], roll, color=GOLD, lw=1.8, ls='--', label='4-wk avg')
        hts = ts[ts['IsHoliday']]
        ax.scatter(hts['Date'], hts['Weekly_Sales'], color=CORAL, s=50, zorder=6, label='Holiday')
        ax.yaxis.set_major_formatter(mticker.FuncFormatter(fusd))
        ax.set_title(f"Store {sel_store} · Dept {sel_dept}")
        ax.legend(facecolor='#161b22', edgecolor='#30363d', labelcolor='#e8e4dc', fontsize=9)
        plt.tight_layout(); st.pyplot(fig); plt.close()

# ══════════════════════════════════════════════════════════════
# PAGE 3: HOLIDAY & MARKDOWN IMPACT
# ══════════════════════════════════════════════════════════════
elif "Holiday" in page:
    st.markdown("# 🎄 Holiday & Markdown Impact Analysis")
    st.markdown("Quantifies revenue uplift from holiday weeks and the ROI of markdown spend by store type.")

    st.markdown('<div class="section-tag">Holiday Uplift by Store Type</div>', unsafe_allow_html=True)
    uplift = dff.groupby(['Type','IsHoliday'])['Weekly_Sales'].mean().unstack().rename(columns={True:'Holiday',False:'Regular'})
    uplift['Uplift %'] = ((uplift['Holiday']-uplift['Regular'])/uplift['Regular']*100).round(1)

    col1,col2 = st.columns([2,3])
    with col1:
        st.dataframe(uplift.style.format({'Holiday':'${:,.0f}','Regular':'${:,.0f}','Uplift %':'{:.1f}%'}), use_container_width=True)
        for t, row in uplift.iterrows():
            st.markdown(f'<div class="alert-low">Type <b>{t}</b>: <b style="color:{GOLD}">{row["Uplift %"]:+.1f}%</b> uplift on holiday weeks (${row["Holiday"]:,.0f} vs ${row["Regular"]:,.0f})</div>', unsafe_allow_html=True)
    with col2:
        fig, ax = plt.subplots(figsize=(7,4))
        dark(ax, fig)
        x = np.arange(len(uplift)); w=0.35
        b1 = ax.bar(x-w/2, uplift['Regular'], w, label='Regular', color=LAV, edgecolor='#0e1117')
        b2 = ax.bar(x+w/2, uplift['Holiday'], w, label='Holiday',  color=GOLD, edgecolor='#0e1117')
        for bars in [b1,b2]:
            for bar in bars:
                ax.text(bar.get_x()+bar.get_width()/2, bar.get_height()*1.01, fusd(bar.get_height()), ha='center', va='bottom', fontsize=8, color='#e8e4dc')
        ax.set_xticks(x); ax.set_xticklabels([f'Type {t}' for t in uplift.index])
        ax.yaxis.set_major_formatter(mticker.FuncFormatter(fusd))
        ax.set_title('Avg Weekly Sales: Regular vs Holiday')
        ax.legend(facecolor='#161b22', edgecolor='#30363d', labelcolor='#e8e4dc')
        plt.tight_layout(); st.pyplot(fig); plt.close()

    st.markdown('<div class="section-tag">Top Departments by Holiday Uplift</div>', unsafe_allow_html=True)
    du = dff.groupby(['Dept','IsHoliday'])['Weekly_Sales'].mean().unstack().rename(columns={True:'Hol',False:'Reg'}).dropna()
    du['Uplift%'] = ((du['Hol']-du['Reg'])/du['Reg']*100).round(1)
    top20d = du.sort_values('Uplift%', ascending=False).head(20)
    fig, ax = plt.subplots(figsize=(12,3.8))
    dark(ax, fig)
    ax.bar(top20d.index.astype(str), top20d['Uplift%'],
           color=[GOLD if v>0 else CORAL for v in top20d['Uplift%']], edgecolor='#0e1117')
    ax.axhline(0, color='#30363d', lw=1); ax.set_xlabel("Department"); ax.set_ylabel("Holiday Uplift (%)")
    ax.set_title("Holiday Sales Uplift % — Top 20 Departments")
    plt.tight_layout(); st.pyplot(fig); plt.close()

    st.markdown('<div class="section-tag">Markdown ROI by Store</div>', unsafe_allow_html=True)
    mde = dff[dff['TotalMarkdown']>0].groupby('Store').agg(avg_sales=('Weekly_Sales','mean'), total_md=('TotalMarkdown','sum'), weeks=('Date','count')).reset_index()
    mde['ROI'] = (mde['avg_sales'] / (mde['total_md']/mde['weeks'])).round(2)
    mde = mde.merge(stores_raw, on='Store').sort_values('ROI', ascending=False)
    col1,col2 = st.columns(2)
    with col1:
        fig, ax = plt.subplots(figsize=(6,4))
        dark(ax, fig)
        for t,c in zip(['A','B','C'],[GOLD,TEAL,CORAL]):
            s = mde[mde['Type']==t]
            ax.scatter(s['total_md'], s['avg_sales'], label=f'Type {t}', color=c, s=60, alpha=0.85, edgecolors='#0e1117')
        ax.set_xlabel("Total Markdown Spend ($)"); ax.set_ylabel("Avg Weekly Sales ($)")
        ax.set_title("Markdown Spend vs Sales"); ax.xaxis.set_major_formatter(mticker.FuncFormatter(fusd)); ax.yaxis.set_major_formatter(mticker.FuncFormatter(fusd))
        ax.legend(facecolor='#161b22', edgecolor='#30363d', labelcolor='#e8e4dc')
        plt.tight_layout(); st.pyplot(fig); plt.close()
    with col2:
        fig, ax = plt.subplots(figsize=(6,4))
        dark(ax, fig)
        top12 = mde.head(12)
        ax.barh(top12['Store'].astype(str), top12['ROI'], color=[GOLD if t=='A' else TEAL if t=='B' else CORAL for t in top12['Type']], edgecolor='#0e1117')
        ax.set_xlabel("Sales per Markdown Dollar"); ax.set_title("Top 12 Stores — Markdown ROI"); ax.invert_yaxis()
        plt.tight_layout(); st.pyplot(fig); plt.close()

# ══════════════════════════════════════════════════════════════
# PAGE 4: STORE BENCHMARKING
# ══════════════════════════════════════════════════════════════
elif "Benchmarking" in page:
    st.markdown("# 🏪 Store Benchmarking")
    st.markdown("Compares every store against its **type-peer average** — revenue per sq ft, sales efficiency, and performance gap.")

    ss = dff.groupby(['Store','Type','Size']).agg(total_rev=('Weekly_Sales','sum'), avg_weekly=('Weekly_Sales','mean')).reset_index()
    ss['rev_per_sqft'] = (ss['total_rev']/ss['Size']).round(2)
    peer = ss.groupby('Type')[['avg_weekly','rev_per_sqft']].mean().rename(columns={'avg_weekly':'peer_avg','rev_per_sqft':'peer_sqft'})
    ss = ss.merge(peer, on='Type')
    ss['vs_peer'] = ((ss['avg_weekly']-ss['peer_avg'])/ss['peer_avg']*100).round(1)

    col1,col2 = st.columns(2)
    with col1:
        st.markdown('<div class="section-tag">Revenue per Sq Ft by Store</div>', unsafe_allow_html=True)
        fig, ax = plt.subplots(figsize=(7,5))
        dark(ax, fig)
        for t,c in zip(['A','B','C'],[GOLD,TEAL,CORAL]):
            s = ss[ss['Type']==t]
            ax.scatter(s['Size'], s['rev_per_sqft'], label=f'Type {t}', color=c, s=70, alpha=0.85, edgecolors='#0e1117')
            for _, row in s.iterrows():
                ax.annotate(str(int(row['Store'])), (row['Size'], row['rev_per_sqft']), xytext=(4,3), textcoords='offset points', fontsize=7, color='#8b949e')
        ax.set_xlabel("Store Size (sq ft)"); ax.set_ylabel("Revenue per Sq Ft ($)")
        ax.set_title("Sales Efficiency: Revenue per Square Foot")
        ax.legend(facecolor='#161b22', edgecolor='#30363d', labelcolor='#e8e4dc')
        plt.tight_layout(); st.pyplot(fig); plt.close()
    with col2:
        st.markdown('<div class="section-tag">Performance vs Peer Average</div>', unsafe_allow_html=True)
        fig, ax = plt.subplots(figsize=(7,5))
        dark(ax, fig)
        ss_s = ss.sort_values('vs_peer', ascending=True)
        ax.barh(ss_s['Store'].astype(str), ss_s['vs_peer'], color=[GREEN if v>=0 else CORAL for v in ss_s['vs_peer']], edgecolor='#0e1117', lw=0.7)
        ax.axvline(0, color='#e8e4dc', lw=1); ax.set_xlabel("% vs Peer Type Average"); ax.set_title("Store vs Type-Peer Average")
        plt.tight_layout(); st.pyplot(fig); plt.close()

    st.markdown('<div class="section-tag">Full Store Scorecard</div>', unsafe_allow_html=True)
    sc = ss[['Store','Type','Size','avg_weekly','rev_per_sqft','vs_peer']].copy()
    sc.columns = ['Store','Type','Size','Avg Wkly Sales','Rev/SqFt','vs Peer %']
    st.dataframe(sc.sort_values('vs Peer %', ascending=False).style.format({'Avg Wkly Sales':'${:,.0f}','Rev/SqFt':'${:,.2f}','vs Peer %':'{:+.1f}%'}).background_gradient(subset=['vs Peer %'], cmap='RdYlGn'), use_container_width=True, hide_index=True)

# ══════════════════════════════════════════════════════════════
# PAGE 5: DEPARTMENT DEMAND RANKING
# ══════════════════════════════════════════════════════════════
elif "Department" in page:
    st.markdown("# 📦 Department Demand Ranking")
    st.markdown("Ranks all departments by revenue, velocity, coverage and volatility. **Directly informs shelf-space allocation and buyer investment decisions.**")

    dr = dff.groupby('Dept').agg(total_rev=('Weekly_Sales','sum'), avg_weekly=('Weekly_Sales','mean'), max_weekly=('Weekly_Sales','max'), stores=('Store','nunique')).reset_index().sort_values('total_rev', ascending=False).reset_index(drop=True)
    dr['Rank'] = dr.index + 1
    q1 = dff['Weekly_Sales'].quantile(0.25); q3 = dff['Weekly_Sales'].quantile(0.75); iqr = q3-q1
    spikes = dff[dff['Weekly_Sales']>q3+1.5*iqr].groupby('Dept').size().rename('Spike Weeks')
    dr = dr.merge(spikes, on='Dept', how='left').fillna({'Spike Weeks':0})
    dr['Spike Weeks'] = dr['Spike Weeks'].astype(int)

    col1,col2 = st.columns([3,2])
    with col1:
        st.markdown('<div class="section-tag">Top 20 Departments — Total Revenue</div>', unsafe_allow_html=True)
        top20 = dr.head(20)
        fig, ax = plt.subplots(figsize=(9,5))
        dark(ax, fig)
        cvals = np.linspace(0.3,1.0,len(top20))
        bcolors = plt.cm.YlOrBr(cvals)
        bars = ax.barh(top20['Dept'].astype(str)[::-1], top20['total_rev'][::-1], color=bcolors[::-1], edgecolor='#0e1117')
        for bar, val in zip(bars, top20['total_rev'][::-1]):
            ax.text(val*1.01, bar.get_y()+bar.get_height()/2, fusd(val), va='center', fontsize=8, color='#e8e4dc')
        ax.xaxis.set_major_formatter(mticker.FuncFormatter(fusd)); ax.set_title("Top 20 Departments by Total Revenue"); ax.set_ylabel("Department")
        plt.tight_layout(); st.pyplot(fig); plt.close()
    with col2:
        st.markdown('<div class="section-tag">Velocity vs Coverage</div>', unsafe_allow_html=True)
        fig, ax = plt.subplots(figsize=(5,5))
        dark(ax, fig)
        sc2 = ax.scatter(dr['stores'], dr['avg_weekly'], c=dr['total_rev'], cmap='YlOrBr', s=60, alpha=0.85, edgecolors='#0e1117')
        ax.set_xlabel("Stores Carrying"); ax.set_ylabel("Avg Weekly Sales ($)"); ax.set_title("Dept Velocity vs Coverage")
        ax.yaxis.set_major_formatter(mticker.FuncFormatter(fusd))
        cb = plt.colorbar(sc2, ax=ax); cb.ax.yaxis.label.set_color('#8b949e'); cb.ax.tick_params(colors='#8b949e')
        plt.tight_layout(); st.pyplot(fig); plt.close()

    st.dataframe(dr[['Rank','Dept','total_rev','avg_weekly','max_weekly','stores','Spike Weeks']].rename(columns={'total_rev':'Total Revenue','avg_weekly':'Avg Weekly','max_weekly':'Peak Weekly','stores':'Stores'}).style.format({'Total Revenue':'${:,.0f}','Avg Weekly':'${:,.0f}','Peak Weekly':'${:,.0f}'}).background_gradient(subset=['Total Revenue'], cmap='YlOrBr'), use_container_width=True, hide_index=True)

# ══════════════════════════════════════════════════════════════
# PAGE 6: DEMAND TREND EXPLORER
# ══════════════════════════════════════════════════════════════
elif "Demand Trend" in page:
    st.markdown("# 📈 Demand Trend Explorer")
    st.markdown("Explore any store-department's sales trajectory with rolling averages, ±1.5σ demand bands, and year-over-year comparison.")

    c1,c2 = st.columns(2)
    with c1: sel_store = st.selectbox("Store", sorted(dff['Store'].unique()))
    with c2: sel_dept  = st.selectbox("Dept",  sorted(dff[dff['Store']==sel_store]['Dept'].unique()))

    ts = dff[(dff['Store']==sel_store)&(dff['Dept']==sel_dept)].sort_values('Date').copy()
    if len(ts)<8:
        st.warning("Not enough data for this combination.")
    else:
        ts['Roll4']  = ts['Weekly_Sales'].rolling(4, min_periods=2).mean()
        ts['Roll12'] = ts['Weekly_Sales'].rolling(12, min_periods=4).mean()
        ts['Std4']   = ts['Weekly_Sales'].rolling(4, min_periods=2).std()
        ts['Upper']  = ts['Roll4'] + 1.5*ts['Std4']
        ts['Lower']  = (ts['Roll4'] - 1.5*ts['Std4']).clip(lower=0)

        fig, ax = plt.subplots(figsize=(12,4.5))
        dark(ax, fig)
        ax.fill_between(ts['Date'], ts['Lower'].fillna(0), ts['Upper'].fillna(ts['Weekly_Sales'].max()), alpha=0.10, color=TEAL, label='±1.5σ band')
        ax.plot(ts['Date'], ts['Weekly_Sales'], color=LAV, lw=1.3, alpha=0.7, label='Weekly sales')
        ax.plot(ts['Date'], ts['Roll4'],  color=GOLD, lw=2.0, label='4-wk avg')
        ax.plot(ts['Date'], ts['Roll12'], color=TEAL, lw=1.5, ls='--', label='12-wk trend')
        hts = ts[ts['IsHoliday']]
        ax.scatter(hts['Date'], hts['Weekly_Sales'], color=CORAL, s=55, zorder=6, label='Holiday')
        ax.yaxis.set_major_formatter(mticker.FuncFormatter(fusd))
        ax.set_title(f"Store {sel_store} · Dept {sel_dept} — Demand Trend")
        ax.legend(facecolor='#161b22', edgecolor='#30363d', labelcolor='#e8e4dc', fontsize=9, loc='upper left')
        plt.tight_layout(); st.pyplot(fig); plt.close()

        if ts['Year'].nunique()>1:
            st.markdown('<div class="section-tag">Year-over-Year Comparison</div>', unsafe_allow_html=True)
            ts['Week'] = ts['Date'].dt.isocalendar().week.astype(int)
            yoy = ts.groupby(['Year','Week'])['Weekly_Sales'].mean().unstack(level=0)
            fig, ax = plt.subplots(figsize=(12,3.5))
            dark(ax, fig)
            for year, color in zip(sorted(yoy.columns), [GOLD,TEAL,CORAL,LAV]):
                if year in yoy.columns:
                    ax.plot(yoy.index, yoy[year], label=str(year), color=color, lw=1.8)
            ax.set_xlabel("Week of Year"); ax.set_ylabel("Avg Weekly Sales ($)")
            ax.set_title("Year-over-Year Weekly Sales"); ax.yaxis.set_major_formatter(mticker.FuncFormatter(fusd))
            ax.legend(facecolor='#161b22', edgecolor='#30363d', labelcolor='#e8e4dc')
            plt.tight_layout(); st.pyplot(fig); plt.close()

        c1,c2,c3,c4 = st.columns(4)
        c1.metric("Mean Weekly", fusd(ts['Weekly_Sales'].mean()))
        c2.metric("Peak Week",   fusd(ts['Weekly_Sales'].max()))
        c3.metric("Std Dev",     fusd(ts['Weekly_Sales'].std()))
        c4.metric("Variability", f"{ts['Weekly_Sales'].std()/ts['Weekly_Sales'].mean()*100:.1f}%")

# ══════════════════════════════════════════════════════════════
# PAGE 7: EXTERNAL FACTOR SIGNALS
# ══════════════════════════════════════════════════════════════
elif "External" in page:
    st.markdown("# 🌡️ External Factor Signals")
    st.markdown("Quantifies how **macroeconomic conditions** (CPI, unemployment, fuel price, temperature) correlate with weekly sales across all store types.")

    fs = dff[dff['CPI'].notna()&dff['Unemployment'].notna()&dff['Fuel_Price'].notna()].copy()
    factors = {'Fuel_Price':('Fuel Price ($/gal)',CORAL),'CPI':('Consumer Price Index',GOLD),'Unemployment':('Unemployment (%)',TEAL),'Temperature':('Temperature (°F)',LAV)}

    corr_rows = []
    for col,(label,_) in factors.items():
        if col not in fs.columns: continue
        s = fs[[col,'Weekly_Sales']].dropna()
        r, p = stats.pearsonr(s[col], s['Weekly_Sales'])
        corr_rows.append({'Factor':label,'Pearson r':round(r,3),'p-value':round(p,4),'Significant':'✅' if p<0.05 else '❌'})
    corr_df = pd.DataFrame(corr_rows).sort_values('Pearson r', key=abs, ascending=False)

    col1,col2 = st.columns([2,3])
    with col1:
        st.markdown('<div class="section-tag">Correlation with Weekly Sales</div>', unsafe_allow_html=True)
        st.dataframe(corr_df, use_container_width=True, hide_index=True)
        st.caption("Pearson r: linear correlation. p < 0.05 = statistically significant.")
    with col2:
        fig, ax = plt.subplots(figsize=(7,4))
        dark(ax, fig)
        ax.bar(corr_df['Factor'], corr_df['Pearson r'], color=[GOLD if r>=0 else CORAL for r in corr_df['Pearson r']], edgecolor='#0e1117')
        ax.axhline(0, color='#e8e4dc', lw=0.8)
        ax.set_ylabel("Pearson r"); ax.set_title("External Factor Correlation with Weekly Sales")
        ax.set_xticklabels(corr_df['Factor'], rotation=20, ha='right')
        for i,(_, row) in enumerate(corr_df.iterrows()):
            ax.text(i, row['Pearson r']+(0.002 if row['Pearson r']>=0 else -0.005), f"{row['Pearson r']:+.3f}", ha='center', fontsize=9, color='#e8e4dc')
        plt.tight_layout(); st.pyplot(fig); plt.close()

    st.markdown('<div class="section-tag">Factor Scatter vs Weekly Sales</div>', unsafe_allow_html=True)
    sel_f = st.selectbox("Choose factor", list(factors.keys()), format_func=lambda x: factors[x][0])
    label, fcolor = factors[sel_f]
    sub = fs[[sel_f,'Weekly_Sales','Type']].dropna()
    fig, ax = plt.subplots(figsize=(10,4))
    dark(ax, fig)
    for t,c in zip(['A','B','C'],[GOLD,TEAL,CORAL]):
        s2 = sub[sub['Type']==t]
        ax.scatter(s2[sel_f], s2['Weekly_Sales'], label=f'Type {t}', color=c, s=18, alpha=0.35, edgecolors='none')
    m, b, r, _, _ = stats.linregress(sub[sel_f], sub['Weekly_Sales'])
    xs = np.linspace(sub[sel_f].min(), sub[sel_f].max(), 100)
    ax.plot(xs, m*xs+b, color='white', lw=1.5, ls='--', label=f'Trend (r={r:.3f})')
    ax.set_xlabel(label); ax.set_ylabel("Weekly Sales ($)"); ax.set_title(f"{label} vs Weekly Sales")
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(fusd))
    ax.legend(facecolor='#161b22', edgecolor='#30363d', labelcolor='#e8e4dc', fontsize=9)
    plt.tight_layout(); st.pyplot(fig); plt.close()

    st.markdown('<div class="section-tag">Sales Heatmap: CPI × Unemployment</div>', unsafe_allow_html=True)
    fs2 = fs.copy()
    fs2['CPI_B']   = pd.cut(fs2['CPI'],          bins=[0,130,160,300],  labels=['Low CPI','Mid CPI','High CPI'])
    fs2['Unemp_B'] = pd.cut(fs2['Unemployment'],  bins=[0,6,9,20],       labels=['Low (<6%)','Mid (6-9%)','High (>9%)'])
    htmap = fs2.groupby(['CPI_B','Unemp_B'])['Weekly_Sales'].mean().round(0).unstack().fillna(0)
    fig, ax = plt.subplots(figsize=(8,3.5))
    dark(ax, fig)
    sns.heatmap(htmap, ax=ax, cmap='YlOrBr', annot=True, fmt=',.0f', linewidths=0.5, linecolor='#0e1117', annot_kws={'size':10,'color':'#0e1117'})
    ax.set_title("Avg Weekly Sales: CPI × Unemployment Bucket"); ax.set_xlabel("Unemployment"); ax.set_ylabel("CPI Bucket")
    plt.tight_layout(); st.pyplot(fig); plt.close()