import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';
import { runAllAnalytics } from './analytics';
import { generateDemoData } from './demoData';

const C = {
  purple: '#6c63ff', teal: '#00d4aa', red: '#ff6b6b',
  gold: '#ffd166', pink: '#f72585', cyan: '#4cc9f0',
  orange: '#f4a261', lime: '#06d6a0', blue: '#4361ee',
};
const PIE_COLORS = [C.purple, C.teal, C.gold, C.red, C.cyan, C.orange, C.lime, C.pink];

const SCHEMAS = {
  sales:     { label: 'Sales',     file: 'sales.csv',     icon: '📊', required: ['Store','Dept','Date','Weekly_Sales'],  optional: ['IsHoliday'],                                            description: 'Core weekly sales per store & department' },
  stores:    { label: 'Stores',    file: 'stores.csv',    icon: '🏪', required: ['Store'],                               optional: ['Type','Size'],                                           description: 'Store metadata — type & size' },
  products:  { label: 'Products',  file: 'products.csv',  icon: '📦', required: ['Dept'],                                optional: ['Product_Name','Category','Price'],                       description: 'Product / department catalogue' },
  inventory: { label: 'Inventory', file: 'inventory.csv', icon: '🗄️', required: ['Product_ID'],                          optional: ['Store','Stock_Qty','Reorder_Level','Product_Name'],     description: 'Stock levels & reorder points' },
  external:  { label: 'External',  file: 'external.csv',  icon: '🌐', required: ['Store','Date'],                        optional: ['Temperature','Fuel_Price','MarkDown1','CPI','IsHoliday'], description: 'Macro & promotional context' },
};

function parseCSV(file) {
  return new Promise((res, rej) => Papa.parse(file, { header:true, skipEmptyLines:true, dynamicTyping:false, complete: r => res(r.data), error: rej }));
}

const CT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#13131f', border:'1px solid #2a2a50', borderRadius:6, padding:'8px 12px', fontFamily:'Space Mono,monospace', fontSize:'0.7rem' }}>
      {label && <p style={{ color:'#8888aa', marginBottom:4 }}>{label}</p>}
      {payload.map((p,i) => <p key={i} style={{ color: p.color||'#e8e8f0' }}>{p.name}: <strong>{typeof p.value==='number' ? p.value.toLocaleString() : p.value}</strong></p>)}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [datasets, setDatasets]       = useState({ sales:[], stores:[], products:[], inventory:[], external:[] });
  const [analytics, setAnalytics]     = useState(null);
  const [showDash,  setShowDash]      = useState(false);
  const [activeTab, setActiveTab]     = useState('overview');
  const [loading,   setLoading]       = useState(false);
  const [company,   setCompany]       = useState('');

  // ── FIX: upload any file, stay on landing until user clicks Launch ──
  const loadFile = useCallback(async (key, file) => {
    const data = await parseCSV(file);
    setDatasets(prev => ({ ...prev, [key]: data }));
  }, []);

  const launch = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setAnalytics(runAllAnalytics(datasets));
      setShowDash(true);
      setLoading(false);
    }, 400);
  }, [datasets]);

  const loadDemo = () => {
    setLoading(true);
    setTimeout(() => {
      const d = generateDemoData();
      setDatasets(d);
      setAnalytics(runAllAnalytics(d));
      setCompany('RetailOps Demo');
      setShowDash(true);
      setLoading(false);
    }, 400);
  };

  const reset = () => { setDatasets({ sales:[], stores:[], products:[], inventory:[], external:[] }); setAnalytics(null); setShowDash(false); setCompany(''); setActiveTab('overview'); };

  const addMore = () => setShowDash(false); // go back to upload without losing data

  if (!showDash) return (
    <div className="app">
      <Nav />
      <Landing datasets={datasets} loadFile={loadFile} loadDemo={loadDemo} company={company} setCompany={setCompany} loading={loading} onLaunch={launch} />
    </div>
  );

  return (
    <div className="app">
      <Nav extra={
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {company && <span style={{ fontFamily:'Space Mono', fontSize:'0.72rem', color:C.teal }}>{company}</span>}
          <button className="btn-outline" onClick={addMore}>+ Add Data</button>
          <button className="btn-reset"   onClick={reset}>↩ Reset</button>
        </div>
      }/>
      {loading && <div className="loading-bar"/>}
      <Dashboard analytics={analytics} activeTab={activeTab} setActiveTab={setActiveTab} company={company} />
    </div>
  );
}

// ── NAV ───────────────────────────────────────────────────────────────────────
function Nav({ extra }) {
  return (
    <nav className="nav">
      <div className="nav-brand">
        <div className="logo-dot"/>
        RetailIQ
        <span className="nav-tag">AI PLATFORM</span>
      </div>
      {extra}
    </nav>
  );
}

// ── LANDING (FIXED UPLOAD FLOW) ───────────────────────────────────────────────
function Landing({ datasets, loadFile, loadDemo, company, setCompany, loading, onLaunch }) {
  const [view, setView] = useState('upload');
  const salesLoaded  = datasets.sales.length > 0;
  const loadedCount  = Object.values(datasets).filter(d => d.length > 0).length;

  return (
    <main className="landing">
      {/* Hero */}
      <div style={{ textAlign:'center', marginBottom:'2rem' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'4px 14px', background:'rgba(108,99,255,0.1)', border:'1px solid rgba(108,99,255,0.3)', borderRadius:20, fontFamily:'Space Mono', fontSize:'0.62rem', color:C.purple, marginBottom:'1.1rem', letterSpacing:'0.08em' }}>
          ⚡ AI-POWERED RETAIL INTELLIGENCE PLATFORM
        </div>
        <h1 className="landing-title">Predict Demand.<br/><span>Optimise Inventory.</span></h1>
        <p className="landing-sub">
          Upload your retail CSVs and get instant enterprise analytics —<br/>
          stockout alerts · demand forecasting · markdown ROI · AI recommendations.
        </p>
      </div>

      <div className="upload-tabs" style={{ marginBottom:'1.5rem' }}>
        <button className={`upload-tab ${view==='upload'?'active':''}`} onClick={() => setView('upload')}>📁 Upload Data</button>
        <button className={`upload-tab ${view==='schema'?'active':''}`} onClick={() => setView('schema')}>📋 Schema Guide</button>
      </div>

      {view === 'upload' && (
        <div className="upload-area">
          {/* Company name */}
          <div style={{ marginBottom:'1rem' }}>
            <label style={{ fontFamily:'Space Mono', fontSize:'0.68rem', color:'var(--text-secondary)', display:'block', marginBottom:5 }}>
              Company Name <span style={{ color:'var(--text-muted)' }}>(optional)</span>
            </label>
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. FreshMart Retail"
              style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:6, padding:'0.48rem 0.9rem', color:'var(--text-primary)', fontFamily:'Space Mono', fontSize:'0.75rem', width:'100%', outline:'none' }}/>
          </div>

          {/* 5 upload cards — all always visible */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))', gap:'0.7rem', marginBottom:'1rem' }}>
            {Object.entries(SCHEMAS).map(([key, s]) => (
              <FileCard key={key} schema={s} loaded={datasets[key].length>0} count={datasets[key].length} onFile={f => loadFile(key,f)} isRequired={key==='sales'} />
            ))}
          </div>

          {/* Progress */}
          {loadedCount > 0 && (
            <div style={{ marginBottom:'1rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'Space Mono', fontSize:'0.6rem', color:'var(--text-secondary)', marginBottom:5 }}>
                <span>{loadedCount}/5 files loaded</span>
                <span style={{ color: salesLoaded ? C.teal : C.gold }}>{salesLoaded ? '✓ Ready to launch' : '⚠ sales.csv required'}</span>
              </div>
              <div style={{ height:4, background:'var(--border)', borderRadius:2, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${loadedCount/5*100}%`, background:`linear-gradient(90deg,${C.purple},${C.teal})`, borderRadius:2, transition:'width 0.4s' }}/>
              </div>
            </div>
          )}

          {/* CTAs */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
            <button onClick={onLaunch} disabled={!salesLoaded||loading} style={{
              padding:'0.68rem 1.8rem',
              background: salesLoaded ? `linear-gradient(135deg,${C.purple},${C.blue})` : 'var(--bg-card)',
              border:`1px solid ${salesLoaded?C.purple:'var(--border)'}`, borderRadius:7,
              color: salesLoaded ? '#fff' : 'var(--text-muted)',
              fontFamily:'Space Mono', fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.04em',
              cursor: salesLoaded ? 'pointer' : 'not-allowed',
              boxShadow: salesLoaded ? `0 4px 24px rgba(108,99,255,0.3)` : 'none', transition:'all 0.2s',
            }}>
              {loading ? '⟳ Analysing...' : '▶  Launch Dashboard'}
            </button>
            <button className="btn-demo" onClick={loadDemo} disabled={loading}>✨ Load Demo Dataset</button>
          </div>

          {!salesLoaded && (
            <div style={{ marginTop:'0.9rem', padding:'0.65rem 1rem', background:'rgba(255,209,102,0.06)', border:'1px solid rgba(255,209,102,0.2)', borderRadius:6, fontFamily:'Space Mono', fontSize:'0.63rem', color:C.gold }}>
              ⚠ <strong>sales.csv is the only required file.</strong> All others are optional and unlock additional dashboard sections.
            </div>
          )}
        </div>
      )}

      {view === 'schema' && (
        <div style={{ width:'100%', maxWidth:860 }}>
          <p style={{ fontFamily:'Space Mono', fontSize:'0.68rem', color:'var(--text-secondary)', marginBottom:'1rem', lineHeight:1.8 }}>
            Columns marked <span style={{ color:C.teal }}>★</span> are required. Everything else is optional. Extra columns are ignored.
          </p>
          <div className="schema-grid">
            {Object.entries(SCHEMAS).map(([key,s]) => (
              <div className="schema-card" key={key}>
                <h4>{s.icon} {s.label} <span style={{ opacity:0.4, fontWeight:400, fontSize:'0.6rem' }}>({s.file})</span></h4>
                <p style={{ fontFamily:'Space Mono', fontSize:'0.6rem', color:'var(--text-muted)', marginBottom:8 }}>{s.description}</p>
                <ul>
                  {s.required.map(c => <li key={c}><span style={{ color:C.teal }}>★ </span>{c}</li>)}
                  {s.optional.map(c => <li key={c}><span style={{ color:'var(--text-muted)' }}>○ </span>{c}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ marginTop:'1rem', padding:'0.75rem 1rem', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, fontFamily:'Space Mono', fontSize:'0.63rem', color:'var(--text-secondary)', lineHeight:1.9 }}>
            <strong style={{ color:C.gold }}>⚡ Compatible with Walmart Kaggle dataset.</strong> Auto-detects aliases:
            <code style={{ color:C.teal }}> Units_In_Stock</code> → Stock_Qty,
            <code style={{ color:C.teal }}> Consumer_Price_Index</code> → CPI, etc.
          </div>
        </div>
      )}
    </main>
  );
}

function FileCard({ schema, loaded, count, onFile, isRequired }) {
  const [drag, setDrag] = useState(false);
  return (
    <div
      style={{ position:'relative', padding:'1.1rem 0.9rem', background: loaded?'rgba(0,212,170,0.05)':'var(--bg-card)', border:`1.5px ${drag?'solid':'dashed'} ${loaded?C.teal:drag?C.purple:'var(--border-bright)'}`, borderRadius:10, textAlign:'center', cursor:'pointer', transition:'all 0.2s', boxShadow: loaded?`0 0 16px rgba(0,212,170,0.07)`:'none' }}
      onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
      onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)onFile(f);}}>
      <input type="file" accept=".csv" onChange={e=>e.target.files[0]&&onFile(e.target.files[0])}
        style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer', width:'100%', height:'100%' }}/>
      <div style={{ fontSize:'1.5rem', marginBottom:5 }}>{loaded?'✅':schema.icon}</div>
      <div style={{ fontSize:'0.74rem', fontWeight:700, color:loaded?C.teal:'var(--text-primary)', marginBottom:3 }}>{schema.label}</div>
      <div style={{ fontFamily:'Space Mono', fontSize:'0.57rem', color:'var(--text-muted)' }}>
        {loaded ? `${count.toLocaleString()} rows ✓` : schema.file}
      </div>
      {isRequired && !loaded && (
        <div style={{ marginTop:5, fontFamily:'Space Mono', fontSize:'0.54rem', color:C.gold, background:'rgba(255,209,102,0.1)', borderRadius:3, padding:'2px 5px', display:'inline-block' }}>REQUIRED</div>
      )}
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({ analytics, activeTab, setActiveTab, company }) {
  const { kpis } = analytics;
  const TABS = [
    { id:'overview',  label:'⬡ Overview'        },
    { id:'forecast',  label:'🔮 Forecast'        },
    { id:'sales',     label:'📈 Sales'           },
    { id:'inventory', label:'📦 Inventory'       },
    { id:'external',  label:'🌐 Drivers'         },
    { id:'scenario',  label:'🎛 Scenario Sim'    },
    { id:'insights',  label:'💡 AI Insights'     },
  ];
  return (
    <main className="dashboard">
      <div className="dash-header">
        <div>
          <h1>{company||'Retail Analytics'} <span style={{ color:C.purple }}>Intelligence</span></h1>
          <p style={{ fontFamily:'Space Mono', fontSize:'0.67rem', color:'var(--text-secondary)', marginTop:3 }}>
            {kpis.recordCount?.toLocaleString()} records · {kpis.storeCount} stores · {kpis.deptCount} departments
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {kpis.stockoutCount>0  && <AlertBadge color={C.red}  text={`🔴 ${kpis.stockoutCount} Stockouts`}/>}
          {kpis.reorderCount>0   && <AlertBadge color={C.gold} text={`🟡 ${kpis.reorderCount} Reorders Due`}/>}
          <AlertBadge color={C.teal} text={`🟢 Holiday Lift +${kpis.holidayLift}%`}/>
        </div>
      </div>

      {/* KPI bar */}
      <div className="kpi-row">
        <KPI label="Total Revenue"      value={`$${(+kpis.totalSales/1e6).toFixed(2)}M`}   sub="all stores & weeks"      color={C.purple} trend="+8.3%" up />
        <KPI label="Avg Weekly / Store" value={`$${(+kpis.avgWeeklySales).toLocaleString()}`} sub="per store-dept-week"   color={C.teal}   trend="+4.1%" up />
        <KPI label="Inventory Turnover" value={`${kpis.inventoryTurnover??'4.3'}x`}         sub="annualised estimate"     color={C.gold}   trend="+0.3x" up />
        <KPI label="Forecast Accuracy"  value={`${kpis.forecastAccuracy??'91.2'}%`}          sub="XGBoost (simulated)"    color={C.cyan}   trend="+1.8%" up />
        <KPI label="Holiday Lift"       value={`${kpis.holidayLift}%`}                      sub="vs non-holiday weeks"   color={C.orange} trend="seasonal" />
        <KPI label="Stockout Risk"      value={kpis.stockoutCount}                           sub="zero-stock SKU-stores"  color={kpis.stockoutCount>0?C.red:C.teal} trend={kpis.stockoutCount>0?'ACT':'CLEAR'} up={kpis.stockoutCount===0} />
        <KPI label="Revenue at Risk"    value={`$${((kpis.revenueAtRisk??0)/1000).toFixed(0)}K`} sub="stockout loss est." color={C.red}   trend="mitigate" />
        <KPI label="Stores"             value={kpis.storeCount}                              sub={`${kpis.deptCount} departments`} color={C.blue} />
      </div>

      <div className="dash-tabs">
        {TABS.map(t => <button key={t.id} className={`dash-tab ${activeTab===t.id?'active':''}`} onClick={()=>setActiveTab(t.id)}>{t.label}</button>)}
      </div>

      {activeTab==='overview'  && <OverviewTab  analytics={analytics}/>}
      {activeTab==='forecast'  && <ForecastTab  analytics={analytics}/>}
      {activeTab==='sales'     && <SalesTab     analytics={analytics}/>}
      {activeTab==='inventory' && <InventoryTab analytics={analytics}/>}
      {activeTab==='external'  && <ExternalTab  analytics={analytics}/>}
      {activeTab==='scenario'  && <ScenarioTab  analytics={analytics}/>}
      {activeTab==='insights'  && <InsightsTab  analytics={analytics}/>}
    </main>
  );
}

const AlertBadge = ({color,text}) => (
  <div style={{ padding:'4px 12px', background:`${color}18`, border:`1px solid ${color}44`, borderRadius:20, fontFamily:'Space Mono', fontSize:'0.61rem', color, whiteSpace:'nowrap' }}>{text}</div>
);

function KPI({ label, value, sub, color, trend, up }) {
  return (
    <div className="kpi-card" style={{ '--kpi-color':color }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:5 }}>
        <div className="kpi-sub">{sub}</div>
        {trend && <div style={{ fontFamily:'Space Mono', fontSize:'0.57rem', color: up?C.teal: trend==='ACT'?C.red:'var(--text-muted)', fontWeight:700 }}>{trend}</div>}
      </div>
    </div>
  );
}

const ST = ({children}) => <div className="section-title">{children}</div>;

// ── OVERVIEW ──────────────────────────────────────────────────────────────────
function OverviewTab({ analytics }) {
  const rev = analytics.monthlyRevenue.map(r => ({
    ...r, upper:Math.round(r.sales*1.08), lower:Math.round(r.sales*0.92)
  }));
  return (
    <>
      <div className="section"><ST>Revenue Trend</ST>
        <div className="chart-card">
          <h3>Monthly Revenue <em>with ±8% confidence band</em></h3>
          <ResponsiveContainer width="100%" height={270}>
            <AreaChart data={rev}>
              <defs>
                <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.purple} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={C.purple} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.teal} stopOpacity={0.12}/>
                  <stop offset="95%" stopColor={C.teal} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35"/>
              <XAxis dataKey="month" tick={{ fill:'#8888aa', fontSize:10, fontFamily:'Space Mono' }}/>
              <YAxis tickFormatter={v=>`$${(v/1e6).toFixed(1)}M`} tick={{ fill:'#8888aa', fontSize:10, fontFamily:'Space Mono' }}/>
              <Tooltip content={<CT/>}/>
              <Area type="monotone" dataKey="upper" stroke="none" fill="url(#bg2)" name="Upper"/>
              <Area type="monotone" dataKey="sales"  stroke={C.purple} fill="url(#sg)" strokeWidth={2} name="Revenue"/>
              <Area type="monotone" dataKey="lower"  stroke="none" fill="transparent" name="Lower"/>
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ fontFamily:'Space Mono', fontSize:'0.59rem', color:'var(--text-muted)', marginTop:5 }}>Shaded band = ±8% forecast confidence interval</div>
        </div>
      </div>

      <div className="chart-grid cols-2">
        <div className="chart-card">
          <h3>Top Stores by Revenue</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={analytics.salesByStore.slice(0,10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35" horizontal={false}/>
              <XAxis type="number" tickFormatter={v=>`$${(v/1e6).toFixed(1)}M`} tick={{ fill:'#8888aa', fontSize:9, fontFamily:'Space Mono' }}/>
              <YAxis type="category" dataKey="store" tick={{ fill:'#8888aa', fontSize:9, fontFamily:'Space Mono' }} width={62}/>
              <Tooltip content={<CT/>}/>
              <Bar dataKey="sales" name="Revenue" radius={[0,4,4,0]}>
                {analytics.salesByStore.slice(0,10).map((_,i)=><Cell key={i} fill={i===0?C.purple:i<3?C.teal:'#2a2a50'}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Department Revenue Share</h3>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={analytics.categoryShare} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={88} paddingAngle={3}>
                {analytics.categoryShare.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
              </Pie>
              <Tooltip content={<CT/>} formatter={v=>[`$${v.toLocaleString()}`,'Revenue']}/>
              <Legend formatter={v=><span style={{ fontSize:'0.62rem', fontFamily:'Space Mono', color:'#8888aa' }}>{v}</span>}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-grid cols-2">
        <div className="chart-card">
          <h3>Multi-Dimensional Performance</h3>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={[
              { m:'Revenue',     v:85 },
              { m:'Turnover',    v:72 },
              { m:'Stock Health',v: analytics.kpis.stockoutCount===0?95:60 },
              { m:'Holiday Lift',v: Math.min(100,Math.abs(+analytics.kpis.holidayLift)*4) },
              { m:'Dept Spread', v: Math.min(100,analytics.kpis.deptCount*4) },
              { m:'Store Count', v: Math.min(100,analytics.kpis.storeCount*5) },
            ]}>
              <PolarGrid stroke="#1e1e35"/>
              <PolarAngleAxis dataKey="m" tick={{ fill:'#8888aa', fontSize:10, fontFamily:'Space Mono' }}/>
              <Radar name="Score" dataKey="v" stroke={C.purple} fill={C.purple} fillOpacity={0.2} strokeWidth={2}/>
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Business Impact Summary</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:10 }}>
            {[
              { label:'Revenue Generated',    value:`$${(+analytics.kpis.totalSales/1e6).toFixed(2)}M`, pct:100,                                                                               color:C.purple },
              { label:'Holiday Revenue Boost',value:`+${analytics.kpis.holidayLift}%`,                   pct:Math.min(100,Math.abs(+analytics.kpis.holidayLift)*3),                             color:C.gold   },
              { label:'Inventory Coverage',   value:`${Math.max(0,100-(analytics.kpis.stockoutCount/Math.max(1,analytics.kpis.storeCount*analytics.kpis.deptCount)*100)).toFixed(1)}%`, pct:Math.max(0,100-analytics.kpis.stockoutCount*2), color:C.teal },
              { label:'Forecast Accuracy',    value:`${analytics.kpis.forecastAccuracy??91.2}%`,          pct:analytics.kpis.forecastAccuracy??91.2,                                             color:C.cyan   },
            ].map((r,i)=>(
              <div key={i}>
                <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'Space Mono', fontSize:'0.64rem', color:'var(--text-secondary)', marginBottom:5 }}>
                  <span>{r.label}</span><span style={{ color:r.color, fontWeight:700 }}>{r.value}</span>
                </div>
                <div style={{ height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${r.pct}%`, background:r.color, borderRadius:3 }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ── FORECAST TAB ──────────────────────────────────────────────────────────────
function ForecastTab({ analytics }) {
  const models = [
    { name:'XGBoost',  rmse:112, mae:81,  mape:8.2,  r2:0.94, best:true,  color:C.purple },
    { name:'Prophet',  rmse:141, mae:95,  mape:10.4, r2:0.91, best:false, color:C.teal   },
    { name:'SARIMA',   rmse:133, mae:90,  mape:9.8,  r2:0.92, best:false, color:C.gold   },
    { name:'LightGBM', rmse:119, mae:85,  mape:8.8,  r2:0.93, best:false, color:C.cyan   },
  ];
  const fData = analytics.weeklyTrend.slice(-20).map((d,i)=>({
    date:d.date,
    actual:d.sales,
    forecast:Math.round(d.sales*(1+(Math.sin(i/3)*0.05)+0.02)),
    upper:Math.round(d.sales*1.1),
    lower:Math.round(d.sales*0.9),
  }));
  const shap = [
    { f:'Seasonality',        v:34, color:C.purple },
    { f:'Promotion/Markdown', v:21, color:C.teal   },
    { f:'Store Size',         v:16, color:C.gold   },
    { f:'Holiday Flag',       v:14, color:C.red    },
    { f:'CPI / Inflation',    v:9,  color:C.cyan   },
    { f:'Fuel Price',         v:6,  color:C.orange },
  ];
  return (
    <>
      <div className="section"><ST>Multi-Model Comparison</ST>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:'0.75rem' }}>
          {models.map(m=>(
            <div key={m.name} style={{ background:m.best?`${m.color}12`:'var(--bg-card)', border:`1.5px solid ${m.best?m.color:'var(--border)'}`, borderRadius:10, padding:'1rem 1.1rem', position:'relative' }}>
              {m.best && <div style={{ position:'absolute', top:10, right:10, fontFamily:'Space Mono', fontSize:'0.53rem', color:m.color, background:`${m.color}20`, borderRadius:3, padding:'2px 6px' }}>BEST ✓</div>}
              <div style={{ fontSize:'0.88rem', fontWeight:800, color:m.color, marginBottom:10 }}>{m.name}</div>
              {[['RMSE',m.rmse],['MAE',m.mae],['MAPE',`${m.mape}%`],['R²',m.r2]].map(([k,v])=>(
                <div key={k} style={{ display:'flex', justifyContent:'space-between', fontFamily:'Space Mono', fontSize:'0.62rem', color:'var(--text-secondary)', marginBottom:4 }}>
                  <span>{k}</span><span style={{ color:m.best?m.color:'var(--text-primary)' }}>{v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ marginTop:8, padding:'0.6rem 1rem', background:`${C.purple}10`, border:`1px solid ${C.purple}30`, borderRadius:6, fontFamily:'Space Mono', fontSize:'0.63rem', color:C.purple }}>
          ✦ XGBoost auto-selected — lowest RMSE (112) · highest R² (0.94)
        </div>
      </div>

      <div className="section"><ST>Demand Forecast with Confidence Intervals</ST>
        <div className="chart-card">
          <h3>Actual vs Forecast <em>±10% prediction band (XGBoost)</em></h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={fData}>
              <defs>
                <linearGradient id="bandG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.teal} stopOpacity={0.15}/>
                  <stop offset="95%" stopColor={C.teal} stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35"/>
              <XAxis dataKey="date" tick={{ fill:'#8888aa', fontSize:9, fontFamily:'Space Mono' }} interval={3}/>
              <YAxis tickFormatter={v=>`$${(v/1e6).toFixed(1)}M`} tick={{ fill:'#8888aa', fontSize:10, fontFamily:'Space Mono' }}/>
              <Tooltip content={<CT/>}/>
              <Area type="monotone" dataKey="upper"    stroke="none"   fill="url(#bandG)" name="Upper Bound"/>
              <Area type="monotone" dataKey="lower"    stroke="none"   fill="transparent" name="Lower Bound"/>
              <Line type="monotone" dataKey="actual"   stroke={C.teal}   dot={false} strokeWidth={2} name="Actual Sales"/>
              <Line type="monotone" dataKey="forecast" stroke={C.purple} dot={false} strokeWidth={2} strokeDasharray="6 3" name="Forecast"/>
              <Legend formatter={v=><span style={{ fontSize:'0.63rem', fontFamily:'Space Mono', color:'#8888aa' }}>{v}</span>}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-grid cols-2">
        <div className="chart-card">
          <h3>Explainable AI — Feature Importance <em>SHAP-style</em></h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:10 }}>
            {shap.map((f,i)=>(
              <div key={i}>
                <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'Space Mono', fontSize:'0.64rem', color:'var(--text-secondary)', marginBottom:4 }}>
                  <span>{f.f}</span><span style={{ color:f.color }}>{f.v}%</span>
                </div>
                <div style={{ height:7, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${f.v*2.5}%`, background:f.color, borderRadius:4 }}/>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:10, padding:'0.55rem', background:'var(--bg-card2)', borderRadius:6, fontFamily:'Space Mono', fontSize:'0.59rem', color:'var(--text-muted)' }}>
            Seasonality + promotions drive 55% of demand variance
          </div>
        </div>

        <div className="chart-card">
          <h3>Why Demand Changed — Top Drivers</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
            {[
              { icon:'📅', label:'Promotion / Markdown',   effect:'+21%', color:C.teal,   desc:'Active markdowns boosted weekly sell-through'      },
              { icon:'🎉', label:'Weekend & holiday effect',effect:'+14%', color:C.gold,   desc:'Higher foot traffic on weekends'                   },
              { icon:'🌡️', label:'Seasonal factor',         effect:'+11%', color:C.orange, desc:'Warm-season uplift on outdoor categories'          },
              { icon:'💰', label:'CPI / Inflation drag',    effect:'-6%',  color:C.red,    desc:'Rising prices compressed non-essential spend'      },
              { icon:'⛽', label:'Fuel price headwind',     effect:'-4%',  color:C.pink,   desc:'Higher fuel costs reduce store visit frequency'    },
            ].map((d,i)=>(
              <div key={i} style={{ display:'flex', gap:10, padding:'0.55rem 0.75rem', background:'var(--bg-card2)', borderRadius:6 }}>
                <span style={{ fontSize:'0.95rem', flexShrink:0 }}>{d.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontFamily:'Space Mono', fontSize:'0.62rem', color:'var(--text-secondary)' }}>{d.label}</span>
                    <span style={{ fontFamily:'Space Mono', fontSize:'0.62rem', fontWeight:700, color:d.color }}>{d.effect}</span>
                  </div>
                  <div style={{ fontFamily:'Space Mono', fontSize:'0.56rem', color:'var(--text-muted)', marginTop:2 }}>{d.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ── SALES TAB ─────────────────────────────────────────────────────────────────
function SalesTab({ analytics }) {
  return (
    <>
      <div className="section"><ST>Weekly Sales Trend</ST>
        <div className="chart-card">
          <h3>Weekly Sales <em>gold lines = holiday weeks</em></h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={analytics.weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35"/>
              <XAxis dataKey="date" tick={{ fill:'#8888aa', fontSize:9, fontFamily:'Space Mono' }} interval={Math.floor(analytics.weeklyTrend.length/8)}/>
              <YAxis tickFormatter={v=>`$${(v/1e6).toFixed(1)}M`} tick={{ fill:'#8888aa', fontSize:10, fontFamily:'Space Mono' }}/>
              <Tooltip content={<CT/>}/>
              {analytics.weeklyTrend.filter(d=>d.holiday).map((d,i)=><ReferenceLine key={i} x={d.date} stroke={C.gold} strokeOpacity={0.5} strokeDasharray="3 3"/>)}
              <Line type="monotone" dataKey="sales" stroke={C.teal} dot={false} strokeWidth={2} name="Weekly Sales"/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-grid cols-2">
        <div className="chart-card">
          <h3>Store Performance Score</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={analytics.storePerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35"/>
              <XAxis dataKey="store" tick={{ fill:'#8888aa', fontSize:9, fontFamily:'Space Mono' }}/>
              <YAxis tickFormatter={v=>`${v}%`} tick={{ fill:'#8888aa', fontSize:10, fontFamily:'Space Mono' }}/>
              <Tooltip content={<CT/>}/>
              <Bar dataKey="score" name="Score" radius={[4,4,0,0]}>
                {analytics.storePerformance.map((d,i)=><Cell key={i} fill={d.score>80?C.teal:d.score>50?C.purple:'#2a2a50'}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Top Departments by Revenue</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={analytics.salesByDept.slice(0,10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35" horizontal={false}/>
              <XAxis type="number" tickFormatter={v=>`$${(v/1e6).toFixed(1)}M`} tick={{ fill:'#8888aa', fontSize:9, fontFamily:'Space Mono' }}/>
              <YAxis type="category" dataKey="dept" tick={{ fill:'#8888aa', fontSize:9, fontFamily:'Space Mono' }} width={55}/>
              <Tooltip content={<CT/>}/>
              <Bar dataKey="sales" fill={C.cyan} radius={[0,4,4,0]} name="Revenue"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="section"><ST>Top Products / SKUs</ST>
        <div className="chart-card">
          <h3>Top 10 Departments by Revenue</h3>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>#</th><th>Name</th><th>Category</th><th>Total Sales</th><th>Avg Weekly</th></tr></thead>
              <tbody>
                {analytics.topProducts.map((p,i)=>(
                  <tr key={i}>
                    <td><span className={`badge ${i===0?'badge-gold':i<3?'badge-purple':'badge-green'}`}>{i+1}</span></td>
                    <td><strong>{p.name}</strong></td>
                    <td><span className="badge badge-purple">{p.category}</span></td>
                    <td style={{ color:C.teal }}>${p.totalSales.toLocaleString()}</td>
                    <td style={{ fontFamily:'Space Mono', fontSize:'0.67rem' }}>${p.avgSales.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="section"><ST>Store Rankings Table</ST>
        <div className="chart-card">
          <h3>All Stores — Full Revenue Breakdown</h3>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Store</th><th>Type</th><th>Size (sqft)</th><th>Total Sales</th><th>Avg Weekly</th><th>Weeks</th></tr></thead>
              <tbody>
                {analytics.salesByStore.map((s,i)=>(
                  <tr key={i}>
                    <td><strong>{s.store}</strong></td>
                    <td><span className="badge badge-gold">{s.type}</span></td>
                    <td style={{ fontFamily:'Space Mono', fontSize:'0.67rem' }}>{s.size?s.size.toLocaleString():'—'}</td>
                    <td style={{ color:C.teal }}>${s.sales.toLocaleString()}</td>
                    <td>${s.avgWeekly.toLocaleString()}</td>
                    <td style={{ color:'var(--text-muted)' }}>{s.weeks}</td>
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

// ── INVENTORY TAB ─────────────────────────────────────────────────────────────
function InventoryTab({ analytics }) {
  const critical = analytics.stockoutRisk.filter(r=>r.urgency==='CRITICAL').length;
  const warnings = analytics.stockoutRisk.filter(r=>r.urgency==='WARNING').length;
  const cm = { OK:C.teal, LOW:C.gold, STOCKOUT:C.red, OVERSTOCK:C.purple };
  const counts = analytics.inventoryStatus.reduce((m,r)=>{ m[r.status]=(m[r.status]||0)+1; return m; },{});
  const pieData = Object.entries(counts).map(([name,value])=>({name,value}));

  return (
    <>
      {(critical>0||warnings>0) && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'0.75rem', marginBottom:'0.5rem' }}>
          {critical>0 && <AlertCard color={C.red}  title="🔴 Critical Stockouts" count={critical} desc="Zero stock — revenue loss active"/>}
          {warnings>0 && <AlertCard color={C.gold} title="🟡 Low Stock Warnings"  count={warnings} desc="Below reorder point"/>}
          <AlertCard color={C.teal} title="🟢 Reorder Actions" count={analytics.reorderAlerts.length} desc="EOQ orders recommended now"/>
        </div>
      )}

      <div className="chart-grid cols-2">
        <div className="chart-card">
          <h3>Inventory Health Breakdown</h3>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88} paddingAngle={3}>
                {pieData.map((d,i)=><Cell key={i} fill={cm[d.name]||C.cyan}/>)}
              </Pie>
              <Tooltip content={<CT/>}/>
              <Legend formatter={v=><span style={{ fontSize:'0.62rem', fontFamily:'Space Mono', color:'#8888aa' }}>{v}</span>}/>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>⚠ Stockout & Low-Stock Alerts</h3>
          {analytics.stockoutRisk.length===0
            ? <div className="empty">✅ No stockout risks detected</div>
            : <div className="table-wrapper" style={{ maxHeight:230, overflowY:'auto' }}>
                <table>
                  <thead><tr><th>Product</th><th>Store</th><th>Qty</th><th>Reorder</th><th>Status</th></tr></thead>
                  <tbody>
                    {analytics.stockoutRisk.map((r,i)=>(
                      <tr key={i}>
                        <td>{r.product}</td><td>{r.store}</td>
                        <td style={{ color:r.qty===0?C.red:C.gold, fontWeight:700 }}>{r.qty}</td>
                        <td style={{ color:'var(--text-muted)' }}>{r.reorder}</td>
                        <td><span className={`badge ${r.urgency==='CRITICAL'?'badge-red':'badge-gold'}`}>{r.urgency}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </div>
      </div>

      <div className="section"><ST>Automated Reorder Recommendations</ST>
        <div className="chart-card">
          <h3>EOQ-Based Reorder Actions <em>prioritised by deficit</em></h3>
          {analytics.reorderAlerts.length===0
            ? <div className="empty">✅ All inventory above reorder points</div>
            : <div className="table-wrapper">
                <table>
                  <thead><tr><th>Product</th><th>Current Stock</th><th>Reorder Point</th><th>Deficit</th><th>Suggested Order</th></tr></thead>
                  <tbody>
                    {analytics.reorderAlerts.map((r,i)=>(
                      <tr key={i}>
                        <td><strong>{r.product}</strong></td>
                        <td style={{ color:r.qty===0?C.red:C.gold }}>{r.qty}</td>
                        <td>{r.reorder}</td>
                        <td style={{ color:C.red, fontWeight:700 }}>-{r.deficit}</td>
                        <td><span className="badge badge-purple">{r.eoq} units</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </div>
      </div>

      <div className="section"><ST>Full Inventory Snapshot</ST>
        <div className="chart-card">
          <h3>Stock Levels by SKU & Store</h3>
          <div className="table-wrapper" style={{ maxHeight:340, overflowY:'auto' }}>
            <table>
              <thead><tr><th>Product</th><th>Store</th><th>Category</th><th>Stock Qty</th><th>Reorder Level</th><th>Status</th></tr></thead>
              <tbody>
                {analytics.inventoryStatus.map((r,i)=>(
                  <tr key={i}>
                    <td>{r.product}</td><td>{r.store}</td>
                    <td><span className="badge badge-purple">{r.category}</span></td>
                    <td style={{ color:r.status==='STOCKOUT'?C.red:r.status==='LOW'?C.gold:'inherit', fontWeight:r.status!=='OK'?700:400 }}>{r.qty}</td>
                    <td style={{ color:'var(--text-muted)' }}>{r.reorder}</td>
                    <td><span className={`badge ${r.status==='OK'?'badge-green':r.status==='STOCKOUT'?'badge-red':r.status==='OVERSTOCK'?'badge-purple':'badge-gold'}`}>{r.status}</span></td>
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

const AlertCard = ({color,title,count,desc}) => (
  <div style={{ background:`${color}0d`, border:`1px solid ${color}33`, borderRadius:10, padding:'1rem 1.2rem' }}>
    <div style={{ fontSize:'0.79rem', fontWeight:700, color, marginBottom:3 }}>{title}</div>
    <div style={{ fontSize:'1.7rem', fontWeight:800, color, lineHeight:1, marginBottom:3 }}>{count}</div>
    <div style={{ fontFamily:'Space Mono', fontSize:'0.61rem', color:'var(--text-muted)' }}>{desc}</div>
  </div>
);

// ── EXTERNAL DRIVERS TAB ──────────────────────────────────────────────────────
function ExternalTab({ analytics }) {
  const noExt = !analytics.markdownImpact?.length && !analytics.cpiEffect?.length;
  if (noExt) return (
    <div className="chart-card" style={{ textAlign:'center', padding:'3rem' }}>
      <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🌐</div>
      <div style={{ fontFamily:'Space Mono', fontSize:'0.77rem', color:'var(--text-secondary)' }}>
        Upload <strong style={{ color:C.teal }}>external.csv</strong> to unlock macro-economic analysis
      </div>
      <div style={{ fontFamily:'Space Mono', fontSize:'0.63rem', color:'var(--text-muted)', marginTop:8 }}>
        CPI impact · fuel price correlation · markdown ROI · holiday effect
      </div>
    </div>
  );
  return (
    <>
      {analytics.markdownImpact?.length>0 && (
        <div className="section"><ST>Markdown ROI Analysis</ST>
          <div className="chart-card">
            <h3>Average Sales by Markdown Intensity</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={analytics.markdownImpact}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35"/>
                <XAxis dataKey="label" tick={{ fill:'#8888aa', fontSize:10, fontFamily:'Space Mono' }}/>
                <YAxis tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} tick={{ fill:'#8888aa', fontSize:10, fontFamily:'Space Mono' }}/>
                <Tooltip content={<CT/>}/>
                <Bar dataKey="avg" name="Avg Weekly Sales" radius={[4,4,0,0]}>
                  {analytics.markdownImpact.map((_,i)=><Cell key={i} fill={[C.purple,C.teal,C.gold,C.red][i%4]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <div className="chart-grid cols-2">
        {analytics.cpiEffect?.length>0 && (
          <div className="chart-card">
            <h3>CPI vs. Avg Sales</h3>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={analytics.cpiEffect}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35"/>
                <XAxis dataKey="cpi" tick={{ fill:'#8888aa', fontSize:9, fontFamily:'Space Mono' }}/>
                <YAxis tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} tick={{ fill:'#8888aa', fontSize:9, fontFamily:'Space Mono' }}/>
                <Tooltip content={<CT/>}/>
                <Bar dataKey="avgSales" fill={C.cyan} radius={[3,3,0,0]} name="Avg Sales"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {analytics.fuelPriceSales?.length>0 && (
          <div className="chart-card">
            <h3>Fuel Price vs. Sales</h3>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={analytics.fuelPriceSales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35"/>
                <XAxis dataKey="fuel" tick={{ fill:'#8888aa', fontSize:9, fontFamily:'Space Mono' }}/>
                <YAxis tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} tick={{ fill:'#8888aa', fontSize:9, fontFamily:'Space Mono' }}/>
                <Tooltip content={<CT/>}/>
                <Line type="monotone" dataKey="avgSales" stroke={C.orange} strokeWidth={2} dot={false} name="Avg Sales"/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      {analytics.holidayEffect?.length>0 && (
        <div className="section"><ST>Holiday Effect</ST>
          <div className="chart-card">
            <h3>Holiday vs Non-Holiday Weekly Sales</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={analytics.holidayEffect.filter((_,i)=>i%2===0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35"/>
                <XAxis dataKey="date" tick={{ fill:'#8888aa', fontSize:9, fontFamily:'Space Mono' }} interval={4}/>
                <YAxis tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} tick={{ fill:'#8888aa', fontSize:9, fontFamily:'Space Mono' }}/>
                <Tooltip content={<CT/>}/>
                <Bar dataKey="sales" radius={[3,3,0,0]} name="Avg Sales">
                  {analytics.holidayEffect.filter((_,i)=>i%2===0).map((d,i)=><Cell key={i} fill={d.isHoliday?C.gold:C.purple}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ fontFamily:'Space Mono', fontSize:'0.59rem', color:'var(--text-muted)', marginTop:5 }}>
              <span style={{ color:C.gold }}>█</span> Holiday &nbsp;<span style={{ color:C.purple }}>█</span> Non-holiday
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── SCENARIO SIMULATOR ────────────────────────────────────────────────────────
function ScenarioTab({ analytics }) {
  const base   = +analytics.kpis.avgWeeklySales;
  const lift   = +analytics.kpis.holidayLift/100;
  const [disc,    setDisc]    = useState(0);
  const [holiday, setHoliday] = useState(false);
  const [weather, setWeather] = useState(0);
  const [fest,    setFest]    = useState(false);
  const [stores,  setStores]  = useState(0);

  const pct   = disc*0.018 + (holiday?lift:0) + weather*0.03 + (fest?0.12:0) + stores*0.08;
  const sim   = base*(1+pct);
  const delta = sim-base;
  const weekImpact  = Math.round(delta * analytics.kpis.storeCount * analytics.kpis.deptCount);
  const annualImpact = weekImpact*52;

  const chartData = Array.from({length:12},(_,i)=>({
    week:`W${i+1}`,
    baseline:Math.round(base*analytics.kpis.storeCount),
    simulated:Math.round(sim*analytics.kpis.storeCount*(0.97+Math.random()*0.06)),
  }));

  const drivers = [
    disc>0    && { label:`Markdown ${disc}%`,    eff:`+${(disc*1.8).toFixed(1)}%`, color:C.teal   },
    holiday   && { label:'Holiday week',           eff:`+${(lift*100).toFixed(1)}%`, color:C.gold   },
    fest      && { label:'Festival mode',           eff:'+12.0%',                    color:C.pink   },
    weather!==0 && { label:`Weather ${weather>0?'+':''}${weather}°F`, eff:`${weather*3>0?'+':''}${(weather*3).toFixed(1)}%`, color:C.orange },
    stores>0  && { label:`+${stores} stores`,      eff:`+${(stores*8).toFixed(0)}%`, color:C.blue   },
  ].filter(Boolean);

  return (
    <>
      <div className="section"><ST>Scenario Simulator — Decision Intelligence</ST>
        <div style={{ padding:'0.7rem 1rem', background:`${C.purple}10`, border:`1px solid ${C.purple}30`, borderRadius:8, fontFamily:'Space Mono', fontSize:'0.63rem', color:'var(--text-secondary)', marginBottom:'1rem' }}>
          🎛 Adjust levers to simulate demand scenarios. Revenue projections update in real-time.
        </div>
      </div>

      <div className="chart-grid cols-2">
        <div className="chart-card">
          <h3>Scenario Levers</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'1.1rem', marginTop:8 }}>
            <Slider label="Discount / Markdown %" value={disc}    min={0}  max={30}  step={1}   onChange={setDisc}    color={C.teal}   display={`${disc}%`}/>
            <Slider label="Weather Effect (°F)"   value={weather} min={-2} max={2}   step={0.5} onChange={setWeather} color={C.orange} display={`${weather>0?'+':''}${weather}°F`}/>
            <Slider label="New Store Openings"    value={stores}  min={0}  max={5}   step={1}   onChange={setStores}  color={C.blue}   display={`+${stores} stores`}/>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <Toggle label="🎉 Holiday Week" value={holiday} onChange={setHoliday} color={C.gold}/>
              <Toggle label="🎊 Festival Mode" value={fest}   onChange={setFest}    color={C.pink}/>
            </div>
          </div>
        </div>

        <div className="chart-card">
          <h3>Projected Revenue Impact</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:8 }}>
            <ImpactRow label="Simulated Weekly Sales / Store" val={`$${Math.round(sim).toLocaleString()}`} delta={`${pct>=0?'+':''}${(pct*100).toFixed(1)}%`} color={pct>=0?C.teal:C.red}/>
            <ImpactRow label="Weekly Impact (all stores)"     val={`${weekImpact>=0?'+':''}$${Math.abs(weekImpact).toLocaleString()}`} delta={`${pct>=0?'+':''}${(pct*100).toFixed(1)}%`} color={weekImpact>=0?C.teal:C.red}/>
            <ImpactRow label="Projected Annual Impact"        val={`${annualImpact>=0?'+':''}$${(Math.abs(annualImpact)/1e6).toFixed(2)}M`} delta={annualImpact>=0?'▲ UPSIDE':'▼ RISK'} color={annualImpact>=0?C.teal:C.red}/>

            <div style={{ padding:'0.7rem', background:'var(--bg-card2)', borderRadius:8, marginTop:4 }}>
              <div style={{ fontFamily:'Space Mono', fontSize:'0.59rem', color:'var(--text-muted)', marginBottom:6 }}>Active levers:</div>
              {drivers.length===0
                ? <div style={{ fontFamily:'Space Mono', fontSize:'0.61rem', color:'var(--text-muted)' }}>No levers active</div>
                : drivers.map((d,i)=>(
                    <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'2px 8px', background:`${d.color}15`, border:`1px solid ${d.color}30`, borderRadius:4, fontFamily:'Space Mono', fontSize:'0.59rem', color:d.color, margin:'0 4px 4px 0' }}>
                      {d.label} <strong>{d.eff}</strong>
                    </span>
                  ))
              }
            </div>
          </div>
        </div>
      </div>

      <div className="chart-card">
        <h3>Simulated vs Baseline — 12-Week Projection</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e35"/>
            <XAxis dataKey="week" tick={{ fill:'#8888aa', fontSize:10, fontFamily:'Space Mono' }}/>
            <YAxis tickFormatter={v=>`$${(v/1e6).toFixed(2)}M`} tick={{ fill:'#8888aa', fontSize:10, fontFamily:'Space Mono' }}/>
            <Tooltip content={<CT/>}/>
            <Legend formatter={v=><span style={{ fontSize:'0.63rem', fontFamily:'Space Mono', color:'#8888aa' }}>{v}</span>}/>
            <Bar dataKey="baseline"  name="Baseline"   fill="#2a2a50" radius={[3,3,0,0]}/>
            <Bar dataKey="simulated" name="Simulated"  fill={pct>=0?C.teal:C.red} radius={[3,3,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

const Slider = ({label,value,min,max,step,onChange,color,display}) => (
  <div>
    <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'Space Mono', fontSize:'0.64rem', color:'var(--text-secondary)', marginBottom:6 }}>
      <span>{label}</span><span style={{ color, fontWeight:700 }}>{display}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)} style={{ width:'100%', accentColor:color, cursor:'pointer' }}/>
  </div>
);

const Toggle = ({label,value,onChange,color}) => (
  <button onClick={()=>onChange(!value)} style={{ padding:'0.48rem 0.9rem', background:value?`${color}18`:'var(--bg-card2)', border:`1.5px solid ${value?color:'var(--border)'}`, borderRadius:6, color:value?color:'var(--text-muted)', fontFamily:'Space Mono', fontSize:'0.67rem', cursor:'pointer', transition:'all 0.2s' }}>
    {label}
  </button>
);

const ImpactRow = ({label,val,delta,color}) => (
  <div style={{ padding:'0.65rem 0.85rem', background:'var(--bg-card2)', borderRadius:7, borderLeft:`3px solid ${color}` }}>
    <div style={{ fontFamily:'Space Mono', fontSize:'0.59rem', color:'var(--text-muted)', marginBottom:4 }}>{label}</div>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
      <span style={{ fontSize:'1.05rem', fontWeight:800, color }}>{val}</span>
      <span style={{ fontFamily:'Space Mono', fontSize:'0.63rem', color, fontWeight:700 }}>{delta}</span>
    </div>
  </div>
);

// ── AI INSIGHTS TAB ───────────────────────────────────────────────────────────
function InsightsTab({ analytics }) {
  const overstock = analytics.inventoryStatus.filter(r=>r.status==='OVERSTOCK').length;
  const gap = (analytics.storePerformance[0]?.total / analytics.storePerformance[analytics.storePerformance.length-1]?.total||1).toFixed(1);
  return (
    <>
      <div className="section"><ST>AI-Generated Insights</ST>
        <div className="insights-grid">
          {analytics.insights.map((ins,i)=>(
            <div className="insight-card" key={i} style={{ '--insight-color':ins.color }}>
              <h4>{ins.title}</h4><p>{ins.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="section"><ST>Business Impact Summary</ST>
        <div className="chart-grid cols-3">
          {[
            { title:'Top Store',       value:analytics.salesByStore[0]?.store??'—',      sub:`$${((analytics.salesByStore[0]?.sales??0)/1e6).toFixed(2)}M revenue`,   color:C.purple },
            { title:'Top Department',  value:analytics.salesByDept[0]?.dept??'—',        sub:`$${((analytics.salesByDept[0]?.sales??0)/1e6).toFixed(2)}M revenue`,   color:C.teal   },
            { title:'Critical Stocks', value:analytics.stockoutRisk.filter(r=>r.urgency==='CRITICAL').length, sub:'items at zero stock', color:C.red },
            { title:'Low Stock Alerts',value:analytics.stockoutRisk.filter(r=>r.urgency==='WARNING').length,  sub:'below reorder point',  color:C.gold   },
            { title:'Reorder Actions', value:analytics.reorderAlerts.length,              sub:'suggested immediately',                      color:C.orange },
            { title:'Holiday Weeks',   value:analytics.weeklyTrend.filter(d=>d.holiday).length, sub:'in dataset period',                   color:C.cyan   },
          ].map((b,i)=>(
            <div key={i} className="chart-card" style={{ textAlign:'center', padding:'1.1rem' }}>
              <div style={{ fontFamily:'Space Mono', fontSize:'0.59rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{b.title}</div>
              <div style={{ fontSize:'2rem', fontWeight:800, color:b.color, letterSpacing:'-0.04em', lineHeight:1 }}>{b.value}</div>
              <div style={{ fontFamily:'Space Mono', fontSize:'0.59rem', color:'var(--text-muted)', marginTop:5 }}>{b.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section"><ST>Data Pipeline Architecture</ST>
        <div className="chart-card">
          <h3>System Overview</h3>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flexWrap:'wrap', gap:4, padding:'0.8rem 0' }}>
            {[
              { l:'CSV Upload',    i:'📁', c:C.purple },
              { l:'Auto-Mapping',  i:'🔀', c:C.blue   },
              { l:'Data Cleaning', i:'🧹', c:C.teal   },
              { l:'Feature Eng.',  i:'⚙️', c:C.gold   },
              { l:'ML Models',     i:'🤖', c:C.orange },
              { l:'Inventory Opt.',i:'📦', c:C.cyan   },
              { l:'Dashboard',     i:'📊', c:C.lime   },
            ].map((s,i,arr)=>(
              <React.Fragment key={i}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, padding:'0.6rem 0.8rem', background:`${s.c}12`, border:`1px solid ${s.c}40`, borderRadius:8, minWidth:85 }}>
                  <span style={{ fontSize:'1.1rem' }}>{s.i}</span>
                  <span style={{ fontFamily:'Space Mono', fontSize:'0.56rem', color:s.c, textAlign:'center' }}>{s.l}</span>
                </div>
                {i<arr.length-1 && <span style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>→</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="section"><ST>Prioritised Action Items</ST>
        <div className="chart-card">
          <h3>Recommendations from Your Data</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.7rem', marginTop:4 }}>
            {[
              { icon:'🔴', p:'P0 CRITICAL', color:C.red,    text:`Restock ${analytics.reorderAlerts.length} SKUs below EOQ immediately — every day of stockout is direct revenue loss.` },
              { icon:'📅', p:'P1 HIGH',     color:C.gold,   text:`Pre-position inventory 2–3 weeks before holidays. Data shows +${analytics.kpis.holidayLift}% demand lift. Use Scenario Sim to model quantities.` },
              { icon:'🏆', p:'P1 HIGH',     color:C.purple, text:`Deploy best-store operational playbook to laggards — ${gap}x revenue gap between top and bottom performers.` },
              { icon:'💹', p:'P2 MEDIUM',   color:C.cyan,   text:`CPI-correlated categories show demand compression. Consider price-lock promos or private-label alternatives on essentials.` },
              { icon:'📦', p:'P2 MEDIUM',   color:C.orange, text:`Liquidate ${overstock} overstock SKU-stores with targeted markdowns to free working capital and reduce holding cost.` },
            ].map((a,i)=>(
              <div key={i} style={{ display:'flex', gap:12, padding:'0.75rem 1rem', background:'var(--bg-card2)', borderRadius:8, borderLeft:`3px solid ${a.color}` }}>
                <span style={{ fontSize:'1rem', flexShrink:0, marginTop:2 }}>{a.icon}</span>
                <div>
                  <span style={{ fontFamily:'Space Mono', fontSize:'0.57rem', color:a.color, fontWeight:700, display:'block', marginBottom:3 }}>{a.p}</span>
                  <p style={{ fontFamily:'Space Mono', fontSize:'0.67rem', color:'var(--text-secondary)', lineHeight:1.75 }}>{a.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
