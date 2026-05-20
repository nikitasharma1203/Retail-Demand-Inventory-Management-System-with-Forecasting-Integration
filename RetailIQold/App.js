import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart,
  Scatter, Legend, ReferenceLine,
} from 'recharts';
import { runAllAnalytics } from './analytics';
import { generateDemoData } from './demoData';

// ── COLORS ──────────────────────────────────────────────────────────────────
const C = {
  purple: '#6c63ff', teal: '#00d4aa', red: '#ff6b6b',
  gold: '#ffd166', pink: '#f72585', cyan: '#4cc9f0',
  orange: '#f4a261', lime: '#06d6a0', violet: '#7b2d8b',
  blue: '#4361ee',
};
const PIE_COLORS = [C.purple, C.teal, C.gold, C.red, C.cyan, C.orange, C.lime, C.pink];

// ── CUSTOM TOOLTIP ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#13131f', border: '1px solid #2a2a50', borderRadius: 6, padding: '8px 12px', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem' }}>
      {label && <p style={{ color: '#8888aa', marginBottom: 4 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#e8e8f0' }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ── SCHEMA DEFINITIONS ───────────────────────────────────────────────────────
const SCHEMAS = {
  sales: {
    label: 'Sales (sales.csv)',
    required: ['Store', 'Dept', 'Date', 'Weekly_Sales'],
    optional: ['IsHoliday'],
    description: 'Core weekly sales per store and department',
  },
  stores: {
    label: 'Stores (stores.csv)',
    required: ['Store'],
    optional: ['Type', 'Size'],
    description: 'Store metadata — type & size',
  },
  products: {
    label: 'Products (products.csv)',
    required: ['Dept'],
    optional: ['Product_Name', 'Category', 'Price', 'Unit_Price'],
    description: 'Product/department catalogue',
  },
  inventory: {
    label: 'Inventory (inventory.csv)',
    required: ['Product_ID'],
    optional: ['Store', 'Stock_Qty', 'Reorder_Level', 'Product_Name'],
    description: 'Current stock levels & reorder points',
  },
  external: {
    label: 'External Drivers (external.csv)',
    required: ['Store', 'Date'],
    optional: ['Temperature', 'Fuel_Price', 'MarkDown1', 'CPI', 'Unemployment', 'IsHoliday'],
    description: 'Macro & promotional context',
  },
};

// ── PARSE CSV ────────────────────────────────────────────────────────────────
function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: r => resolve(r.data),
      error: reject,
    });
  });
}

// ── UPLOAD ZONE ──────────────────────────────────────────────────────────────
function UploadZone({ label, onFile, loaded, required }) {
  const [drag, setDrag] = useState(false);
  return (
    <div
      className={`upload-zone ${drag ? 'drag-over' : ''}`}
      style={{ padding: '1.5rem', position: 'relative', borderColor: loaded ? 'var(--accent-secondary)' : undefined }}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
    >
      <input type="file" accept=".csv" onChange={e => e.target.files[0] && onFile(e.target.files[0])} />
      <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{loaded ? '✅' : '📁'}</div>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 4, color: loaded ? 'var(--accent-secondary)' : 'var(--text-primary)' }}>
        {loaded ? 'Loaded!' : label}
      </div>
      <div style={{ fontFamily: 'Space Mono', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
        {required ? `Required: ${required.join(', ')}` : 'optional'}
      </div>
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [datasets, setDatasets] = useState({ sales: [], stores: [], products: [], inventory: [], external: [] });
  const [analytics, setAnalytics] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState('');

  const loadFile = useCallback(async (key, file) => {
    const data = await parseCSV(file);
    setDatasets(prev => {
      const next = { ...prev, [key]: data };
      if (next.sales?.length > 0) {
        setLoading(true);
        setTimeout(() => {
          setAnalytics(runAllAnalytics(next));
          setLoading(false);
        }, 100);
      }
      return next;
    });
  }, []);

  const loadDemo = () => {
    setLoading(true);
    setTimeout(() => {
      const demo = generateDemoData();
      setDatasets(demo);
      setAnalytics(runAllAnalytics(demo));
      setCompanyName('Walmart Demo');
      setLoading(false);
    }, 300);
  };

  const reset = () => {
    setDatasets({ sales: [], stores: [], products: [], inventory: [], external: [] });
    setAnalytics(null);
    setCompanyName('');
    setActiveTab('overview');
  };

  if (!analytics) {
    return (
      <div className="app">
        <Nav />
        <Landing datasets={datasets} loadFile={loadFile} loadDemo={loadDemo} companyName={companyName} setCompanyName={setCompanyName} loading={loading} />
      </div>
    );
  }

  return (
    <div className="app">
      <Nav extra={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {companyName && <span style={{ fontFamily: 'Space Mono', fontSize: '0.72rem', color: 'var(--accent-secondary)' }}>{companyName}</span>}
          <button className="btn-reset" onClick={reset}>↩ Reset</button>
        </div>
      } />
      {loading && <div className="loading-bar" style={{ width: '100%' }} />}
      <Dashboard analytics={analytics} activeTab={activeTab} setActiveTab={setActiveTab} kpis={analytics.kpis} companyName={companyName} />
    </div>
  );
}

// ── NAV ──────────────────────────────────────────────────────────────────────
function Nav({ extra }) {
  return (
    <nav className="nav">
      <div className="nav-brand">
        <div className="logo-dot" />
        RetailIQ
        <span className="nav-tag">ANALYTICS</span>
      </div>
      {extra}
    </nav>
  );
}

// ── LANDING ──────────────────────────────────────────────────────────────────
function Landing({ datasets, loadFile, loadDemo, companyName, setCompanyName, loading }) {
  const [view, setView] = useState('upload'); // upload | schema

  const salesLoaded = datasets.sales.length > 0;

  return (
    <main className="landing">
      <h1 className="landing-title">
        Retail Demand<br /><span>Analytics Platform</span>
      </h1>
      <p className="landing-sub">
        Upload your retail dataset in the standard schema format and get instant<br />
        analytics — sales trends, inventory health, demand forecasting insights,<br />
        and macro-economic impact — all in one dashboard.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
        <div className="upload-tabs">
          <button className={`upload-tab ${view === 'upload' ? 'active' : ''}`} onClick={() => setView('upload')}>Upload Data</button>
          <button className={`upload-tab ${view === 'schema' ? 'active' : ''}`} onClick={() => setView('schema')}>Schema Guide</button>
        </div>
      </div>

      {view === 'upload' && (
        <div className="upload-area">
          {salesLoaded && (
            <div className="status-bar">
              <div className="status-dot" />
              Sales data loaded ({datasets.sales.length.toLocaleString()} records). Enrich with additional files or view dashboard now.
            </div>
          )}

          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ fontFamily: 'Space Mono', fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Company / Project Name (optional)</label>
            <input
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="e.g. FreshMart Retail"
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6,
                padding: '0.5rem 0.9rem', color: 'var(--text-primary)', fontFamily: 'Space Mono',
                fontSize: '0.78rem', width: '100%', outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
            {Object.entries(SCHEMAS).map(([key, schema]) => (
              <UploadZone
                key={key}
                label={schema.label}
                required={schema.required}
                loaded={datasets[key].length > 0}
                onFile={f => loadFile(key, f)}
              />
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <button
              className="btn-demo"
              onClick={loadDemo}
              disabled={loading}
              style={{ marginRight: 12 }}
            >
              {loading ? '⟳ Generating...' : '▶ Load Demo Dataset (Walmart-style)'}
            </button>
          </div>
        </div>
      )}

      {view === 'schema' && (
        <div style={{ width: '100%', maxWidth: 860 }}>
          <div style={{ fontFamily: 'Space Mono', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.8 }}>
            Your CSVs must include at minimum the <span style={{ color: 'var(--accent-secondary)' }}>required columns</span>. Extra columns are ignored.
            Column names are flexible — the engine auto-detects common aliases.
          </div>
          <div className="schema-grid">
            {Object.entries(SCHEMAS).map(([key, schema]) => (
              <div className="schema-card" key={key}>
                <h4>{schema.label.split('(')[0].trim()}</h4>
                <p style={{ fontFamily: 'Space Mono', fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: 8 }}>{schema.description}</p>
                <ul>
                  {schema.required.map(c => <li key={c}><span style={{ color: 'var(--accent-secondary)' }}>*</span>{c}</li>)}
                  {schema.optional.map(c => <li key={c}><span style={{ color: 'var(--text-muted)' }}>○</span>{c}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1.2rem', padding: '0.8rem 1rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'Space Mono', fontSize: '0.65rem', color: 'var(--text-secondary)', lineHeight: 1.9 }}>
            <strong style={{ color: 'var(--accent-gold)' }}>⚡ Compatibility:</strong> Fully compatible with the Walmart M5 Forecasting dataset format.
            Supports column aliases: <code style={{ color: 'var(--accent-secondary)' }}>Units_In_Stock</code> → Stock_Qty, <code style={{ color: 'var(--accent-secondary)' }}>Consumer_Price_Index</code> → CPI, etc.
          </div>
        </div>
      )}
    </main>
  );
}

// ── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ analytics, activeTab, setActiveTab, kpis, companyName }) {
  const tabs = [
    { id: 'overview', label: '⬡ Overview' },
    { id: 'sales', label: '📈 Sales Analysis' },
    { id: 'inventory', label: '📦 Inventory' },
    { id: 'external', label: '🌐 External Drivers' },
    { id: 'insights', label: '💡 Insights' },
  ];

  return (
    <main className="dashboard">
      <div className="dash-header">
        <div>
          <h1>{companyName || 'Retail Analytics'} Dashboard</h1>
          <p>{kpis.recordCount?.toLocaleString()} sales records · {kpis.storeCount} stores · {kpis.deptCount} departments</p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="kpi-row">
        <KPICard label="Total Revenue" value={`$${(+kpis.totalSales / 1e6).toFixed(2)}M`} sub="across all stores & weeks" color={C.purple} />
        <KPICard label="Avg Weekly Sales" value={`$${(+kpis.avgWeeklySales).toLocaleString()}`} sub="per store-dept-week" color={C.teal} />
        <KPICard label="Stores" value={kpis.storeCount} sub="retail locations" color={C.gold} />
        <KPICard label="Departments" value={kpis.deptCount} sub="product categories" color={C.cyan} />
        <KPICard label="Holiday Lift" value={`${kpis.holidayLift}%`} sub="vs. non-holiday weeks" color={C.orange} />
        <KPICard label="Stockout Risk" value={kpis.stockoutCount} sub="zero-stock SKU-stores" color={kpis.stockoutCount > 0 ? C.red : C.teal} />
      </div>

      {/* Tabs */}
      <div className="dash-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`dash-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab analytics={analytics} />}
      {activeTab === 'sales' && <SalesTab analytics={analytics} />}
      {activeTab === 'inventory' && <InventoryTab analytics={analytics} />}
      {activeTab === 'external' && <ExternalTab analytics={analytics} />}
      {activeTab === 'insights' && <InsightsTab analytics={analytics} />}
    </main>
  );
}

function KPICard({ label, value, sub, color }) {
  return (
    <div className="kpi-card" style={{ '--kpi-color': color }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// ── OVERVIEW TAB ─────────────────────────────────────────────────────────────
function OverviewTab({ analytics }) {
  return (
    <>
      <div className="section">
        <div className="section-title">Revenue Trend</div>
        <div className="chart-card">
          <h3>Monthly Revenue <em>aggregated across all stores</em></h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={analytics.monthlyRevenue}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.purple} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.purple} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35" />
              <XAxis dataKey="month" tick={{ fill: '#8888aa', fontSize: 10, fontFamily: 'Space Mono' }} />
              <YAxis tickFormatter={v => `$${(v / 1e6).toFixed(1)}M`} tick={{ fill: '#8888aa', fontSize: 10, fontFamily: 'Space Mono' }} />
              <Tooltip content={<CustomTooltip />} formatter={v => [`$${v.toLocaleString()}`, 'Revenue']} />
              <Area type="monotone" dataKey="sales" stroke={C.purple} fill="url(#salesGrad)" strokeWidth={2} name="Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-grid cols-2">
        <div className="chart-card">
          <h3>Top Stores by Revenue</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics.salesByStore.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35" horizontal={false} />
              <XAxis type="number" tickFormatter={v => `$${(v / 1e6).toFixed(1)}M`} tick={{ fill: '#8888aa', fontSize: 9, fontFamily: 'Space Mono' }} />
              <YAxis type="category" dataKey="store" tick={{ fill: '#8888aa', fontSize: 9, fontFamily: 'Space Mono' }} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="sales" name="Total Sales" radius={[0, 3, 3, 0]}>
                {analytics.salesByStore.slice(0, 10).map((_, i) => (
                  <Cell key={i} fill={i === 0 ? C.purple : i < 3 ? C.teal : '#2a2a50'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Department Revenue Share</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={analytics.categoryShare} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                {analytics.categoryShare.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} formatter={v => [`$${v.toLocaleString()}`, 'Revenue']} />
              <Legend formatter={v => <span style={{ fontSize: '0.65rem', fontFamily: 'Space Mono', color: '#8888aa' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

// ── SALES TAB ────────────────────────────────────────────────────────────────
function SalesTab({ analytics }) {
  return (
    <>
      <div className="section">
        <div className="section-title">Weekly Sales Trend</div>
        <div className="chart-card">
          <h3>Weekly Sales <em>with holiday markers</em></h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={analytics.weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35" />
              <XAxis dataKey="date" tick={{ fill: '#8888aa', fontSize: 9, fontFamily: 'Space Mono' }} interval={Math.floor(analytics.weeklyTrend.length / 8)} />
              <YAxis tickFormatter={v => `$${(v / 1e6).toFixed(1)}M`} tick={{ fill: '#8888aa', fontSize: 10, fontFamily: 'Space Mono' }} />
              <Tooltip content={<CustomTooltip />} />
              {analytics.weeklyTrend.filter(d => d.holiday).map((d, i) => (
                <ReferenceLine key={i} x={d.date} stroke={C.gold} strokeOpacity={0.5} strokeDasharray="3 3" />
              ))}
              <Line type="monotone" dataKey="sales" stroke={C.teal} dot={false} strokeWidth={2} name="Weekly Sales" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ fontFamily: 'Space Mono', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 8 }}>
            — Gold vertical lines mark holiday weeks
          </div>
        </div>
      </div>

      <div className="chart-grid cols-2">
        <div className="chart-card">
          <h3>Store Performance Matrix</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics.storePerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35" />
              <XAxis dataKey="store" tick={{ fill: '#8888aa', fontSize: 9, fontFamily: 'Space Mono' }} />
              <YAxis tickFormatter={v => `${v}%`} tick={{ fill: '#8888aa', fontSize: 10, fontFamily: 'Space Mono' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="score" name="Performance Score" radius={[3, 3, 0, 0]}>
                {analytics.storePerformance.map((d, i) => (
                  <Cell key={i} fill={d.score > 80 ? C.teal : d.score > 50 ? C.purple : '#2a2a50'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Department Sales Breakdown <em>top 10</em></h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics.salesByDept.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35" horizontal={false} />
              <XAxis type="number" tickFormatter={v => `$${(v / 1e6).toFixed(1)}M`} tick={{ fill: '#8888aa', fontSize: 9, fontFamily: 'Space Mono' }} />
              <YAxis type="category" dataKey="dept" tick={{ fill: '#8888aa', fontSize: 9, fontFamily: 'Space Mono' }} width={55} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="sales" name="Total Sales" fill={C.cyan} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Top Products</div>
        <div className="chart-card">
          <h3>Top 10 Departments / SKUs by Revenue</h3>
          <div className="table-wrapper">
            <table>
              <thead><tr>
                <th>#</th><th>Name</th><th>Category</th>
                <th>Total Sales</th><th>Avg Weekly</th>
              </tr></thead>
              <tbody>
                {analytics.topProducts.map((p, i) => (
                  <tr key={i}>
                    <td><span className={`badge ${i === 0 ? 'badge-gold' : i < 3 ? 'badge-purple' : 'badge-green'}`}>{i + 1}</span></td>
                    <td>{p.name}</td>
                    <td><span className="badge badge-purple">{p.category}</span></td>
                    <td style={{ color: 'var(--accent-secondary)' }}>${p.totalSales.toLocaleString()}</td>
                    <td>${p.avgSales.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">All Store Rankings</div>
        <div className="chart-card">
          <h3>Store Revenue Table</h3>
          <div className="table-wrapper">
            <table>
              <thead><tr>
                <th>Store</th><th>Type</th><th>Size (sqft)</th>
                <th>Total Sales</th><th>Avg Weekly</th><th>Weeks</th>
              </tr></thead>
              <tbody>
                {analytics.salesByStore.map((s, i) => (
                  <tr key={i}>
                    <td><strong>{s.store}</strong></td>
                    <td><span className="badge badge-gold">{s.type}</span></td>
                    <td style={{ fontFamily: 'Space Mono', fontSize: '0.68rem' }}>{s.size ? s.size.toLocaleString() : '—'}</td>
                    <td style={{ color: 'var(--accent-secondary)' }}>${s.sales.toLocaleString()}</td>
                    <td>${s.avgWeekly.toLocaleString()}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{s.weeks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

// ── INVENTORY TAB ────────────────────────────────────────────────────────────
function InventoryTab({ analytics }) {
  return (
    <>
      <div className="chart-grid cols-2">
        <div className="chart-card">
          <h3>Inventory Status Breakdown</h3>
          {(() => {
            const counts = analytics.inventoryStatus.reduce((m, r) => {
              m[r.status] = (m[r.status] || 0) + 1;
              return m;
            }, {});
            const data = Object.entries(counts).map(([name, value]) => ({ name, value }));
            const colorMap = { OK: C.teal, LOW: C.gold, STOCKOUT: C.red, OVERSTOCK: C.purple };
            return (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} paddingAngle={3}>
                    {data.map((d, i) => <Cell key={i} fill={colorMap[d.name] || C.cyan} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend formatter={v => <span style={{ fontSize: '0.65rem', fontFamily: 'Space Mono', color: '#8888aa' }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            );
          })()}
        </div>

        <div className="chart-card">
          <h3>⚠ Stockout & Low-Stock Alerts <em>top 10 by urgency</em></h3>
          {analytics.stockoutRisk.length === 0 ? (
            <div className="empty">✅ No stockout risks detected</div>
          ) : (
            <div className="table-wrapper" style={{ maxHeight: 220, overflowY: 'auto' }}>
              <table>
                <thead><tr><th>Product</th><th>Store</th><th>Qty</th><th>Reorder</th><th>Status</th></tr></thead>
                <tbody>
                  {analytics.stockoutRisk.map((r, i) => (
                    <tr key={i}>
                      <td>{r.product}</td>
                      <td>{r.store}</td>
                      <td style={{ color: r.qty === 0 ? C.red : C.gold }}>{r.qty}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{r.reorder}</td>
                      <td><span className={`badge ${r.urgency === 'CRITICAL' ? 'badge-red' : 'badge-gold'}`}>{r.urgency}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Reorder Recommendations</div>
        <div className="chart-card">
          <h3>Automated Reorder Alerts <em>EOQ-based suggestions</em></h3>
          {analytics.reorderAlerts.length === 0 ? (
            <div className="empty">✅ All inventory above reorder points</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead><tr>
                  <th>Product</th><th>Current Stock</th><th>Reorder Point</th>
                  <th>Deficit</th><th>Suggested Order (EOQ)</th>
                </tr></thead>
                <tbody>
                  {analytics.reorderAlerts.map((r, i) => (
                    <tr key={i}>
                      <td><strong>{r.product}</strong></td>
                      <td style={{ color: r.qty === 0 ? C.red : C.gold }}>{r.qty}</td>
                      <td>{r.reorder}</td>
                      <td style={{ color: C.red }}>-{r.deficit}</td>
                      <td><span className="badge badge-purple">{r.eoq} units</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Full Inventory Snapshot</div>
        <div className="chart-card">
          <h3>Current Stock Levels</h3>
          <div className="table-wrapper" style={{ maxHeight: 340, overflowY: 'auto' }}>
            <table>
              <thead><tr>
                <th>Product</th><th>Store</th><th>Category</th>
                <th>Stock Qty</th><th>Reorder Level</th><th>Status</th>
              </tr></thead>
              <tbody>
                {analytics.inventoryStatus.map((r, i) => (
                  <tr key={i}>
                    <td>{r.product}</td>
                    <td>{r.store}</td>
                    <td><span className="badge badge-purple">{r.category}</span></td>
                    <td style={{ color: r.status === 'STOCKOUT' ? C.red : r.status === 'LOW' ? C.gold : 'inherit' }}>{r.qty}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.reorder}</td>
                    <td><span className={`badge ${r.status === 'OK' ? 'badge-green' : r.status === 'STOCKOUT' ? 'badge-red' : r.status === 'OVERSTOCK' ? 'badge-purple' : 'badge-gold'}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

// ── EXTERNAL DRIVERS TAB ─────────────────────────────────────────────────────
function ExternalTab({ analytics }) {
  const noExternal = !analytics.markdownImpact?.length && !analytics.cpiEffect?.length && !analytics.fuelPriceSales?.length;

  if (noExternal) {
    return (
      <div className="chart-card" style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>🌐</div>
        <div style={{ fontFamily: 'Space Mono', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Upload <strong style={{ color: 'var(--accent-secondary)' }}>external.csv</strong> to unlock macro-economic analysis
        </div>
        <div style={{ fontFamily: 'Space Mono', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 8 }}>
          Includes: CPI impact, fuel price correlation, markdown effects, unemployment analysis
        </div>
      </div>
    );
  }

  return (
    <>
      {analytics.markdownImpact?.length > 0 && (
        <div className="section">
          <div className="section-title">Markdown Impact</div>
          <div className="chart-card">
            <h3>Average Sales by Markdown Level</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={analytics.markdownImpact}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35" />
                <XAxis dataKey="label" tick={{ fill: '#8888aa', fontSize: 10, fontFamily: 'Space Mono' }} />
                <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} tick={{ fill: '#8888aa', fontSize: 10, fontFamily: 'Space Mono' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avg" name="Avg Weekly Sales" fill={C.gold} radius={[3, 3, 0, 0]}>
                  {analytics.markdownImpact.map((d, i) => <Cell key={i} fill={[C.purple, C.teal, C.gold, C.red][i % 4]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="chart-grid cols-2">
        {analytics.cpiEffect?.length > 0 && (
          <div className="chart-card">
            <h3>CPI vs. Sales Correlation</h3>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={analytics.cpiEffect}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35" />
                <XAxis dataKey="cpi" tick={{ fill: '#8888aa', fontSize: 9, fontFamily: 'Space Mono' }} />
                <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} tick={{ fill: '#8888aa', fontSize: 9, fontFamily: 'Space Mono' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avgSales" name="Avg Sales" fill={C.cyan} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {analytics.fuelPriceSales?.length > 0 && (
          <div className="chart-card">
            <h3>Fuel Price vs. Sales</h3>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={analytics.fuelPriceSales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35" />
                <XAxis dataKey="fuel" tick={{ fill: '#8888aa', fontSize: 9, fontFamily: 'Space Mono' }} />
                <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} tick={{ fill: '#8888aa', fontSize: 9, fontFamily: 'Space Mono' }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="avgSales" stroke={C.orange} strokeWidth={2} dot={false} name="Avg Sales" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {analytics.holidayEffect?.length > 0 && (
        <div className="section">
          <div className="section-title">Holiday Effect</div>
          <div className="chart-card">
            <h3>Sales Across Holiday vs Non-Holiday Weeks</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={analytics.holidayEffect.filter((_, i) => i % 2 === 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35" />
                <XAxis dataKey="date" tick={{ fill: '#8888aa', fontSize: 9, fontFamily: 'Space Mono' }} interval={4} />
                <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} tick={{ fill: '#8888aa', fontSize: 9, fontFamily: 'Space Mono' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="sales" name="Avg Sales" radius={[2, 2, 0, 0]}>
                  {analytics.holidayEffect.filter((_, i) => i % 2 === 0).map((d, i) => (
                    <Cell key={i} fill={d.isHoliday ? C.gold : C.purple} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ fontFamily: 'Space Mono', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 6 }}>
              <span style={{ color: C.gold }}>█</span> Holiday week &nbsp; <span style={{ color: C.purple }}>█</span> Non-holiday week
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── INSIGHTS TAB ─────────────────────────────────────────────────────────────
function InsightsTab({ analytics }) {
  return (
    <>
      <div className="section">
        <div className="section-title">AI-Generated Insights</div>
        <div className="insights-grid">
          {analytics.insights.map((ins, i) => (
            <div className="insight-card" key={i} style={{ '--insight-color': ins.color }}>
              <h4>{ins.title}</h4>
              <p>{ins.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Query Results Summary</div>
        <div className="chart-grid cols-3">
          <SummaryBox title="Top Store" value={analytics.salesByStore[0]?.store ?? '—'} sub={`$${((analytics.salesByStore[0]?.sales ?? 0) / 1e6).toFixed(2)}M revenue`} color={C.purple} />
          <SummaryBox title="Top Department" value={analytics.salesByDept[0]?.dept ?? '—'} sub={`$${((analytics.salesByDept[0]?.sales ?? 0) / 1e6).toFixed(2)}M revenue`} color={C.teal} />
          <SummaryBox title="Critical Stockouts" value={analytics.stockoutRisk.filter(r => r.urgency === 'CRITICAL').length} sub="items at zero stock" color={C.red} />
          <SummaryBox title="Low Stock Alerts" value={analytics.stockoutRisk.filter(r => r.urgency === 'WARNING').length} sub="below reorder point" color={C.gold} />
          <SummaryBox title="Reorder Actions" value={analytics.reorderAlerts.length} sub="suggested immediately" color={C.orange} />
          <SummaryBox title="Holiday Weeks" value={analytics.weeklyTrend.filter(d => d.holiday).length} sub="in dataset period" color={C.cyan} />
        </div>
      </div>

      <div className="section">
        <div className="section-title">Recommendations</div>
        <div className="chart-card">
          <h3>Action Items Based on Data</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 4 }}>
            {[
              { icon: '📦', text: `Prioritize restocking ${analytics.reorderAlerts.length} products flagged below reorder level to prevent revenue loss.`, color: C.gold },
              { icon: '🎯', text: `Focus promotional spending on top-performing departments — they drive disproportionate revenue share.`, color: C.purple },
              { icon: '📅', text: `Pre-stock 2–3 weeks before identified holiday periods for a projected ${analytics.kpis.holidayLift}% sales uplift.`, color: C.teal },
              { icon: '🏪', text: `Investigate performance gap between top and bottom stores — operational best practices can be transferred.`, color: C.cyan },
              { icon: '💹', text: `Monitor CPI and fuel price trends as leading indicators to adjust markdown strategies proactively.`, color: C.orange },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '0.75rem 1rem', background: 'var(--bg-card2)', borderRadius: 6, borderLeft: `3px solid ${item.color}` }}>
                <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{item.icon}</span>
                <p style={{ fontFamily: 'Space Mono', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function SummaryBox({ title, value, sub, color }) {
  return (
    <div className="chart-card" style={{ textAlign: 'center', padding: '1.2rem' }}>
      <div style={{ fontFamily: 'Space Mono', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'Space Mono', fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>
    </div>
  );
}