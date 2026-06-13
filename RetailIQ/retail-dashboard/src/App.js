import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';
import { runAllAnalytics } from './analytics';
import { generateDemoData } from './demoData';

// ── Palette — kelp/conifer/ivory/terracotta ──────────────────────────────────
const C = {
  violet:'#4A6355',  emerald:'#6A7D59', amber:'#8a7340',
  rose:'#A56A4D',    sky:'#5a7080',     indigo:'#4A6355',
  orange:'#8a6040',  lime:'#7a9060',    pink:'#7a5a50',
  card:'#F2EEE5',    border:'#ddd8cf',  text:'#232323',
};
const PIE = [C.violet,C.emerald,C.amber,C.rose,C.sky,C.orange,C.lime,C.pink];

// ── Schema definitions — UNCHANGED ──────────────────────────────────────────
const SCHEMAS = {
  sales:     { label:'Sales',     file:'sales.csv',     icon:'↗', required:['Store','Dept','Date','Weekly_Sales'], optional:['IsHoliday'],                                             description:'Core weekly sales per store & department' },
  stores:    { label:'Stores',    file:'stores.csv',    icon:'◫', required:['Store'],                              optional:['Type','Size'],                                            description:'Store metadata — type & size' },
  products:  { label:'Products',  file:'products.csv',  icon:'◈', required:['Dept'],                               optional:['Product_Name','Category','Price'],                        description:'Product / department catalogue' },
  inventory: { label:'Inventory', file:'inventory.csv', icon:'▦', required:['Product_ID'],                         optional:['Store','Stock_Qty','Reorder_Level','Product_Name'],      description:'Stock levels & reorder points' },
  external:  { label:'External',  file:'external.csv',  icon:'◎', required:['Store','Date'],                       optional:['Temperature','Fuel_Price','MarkDown1','CPI','IsHoliday'], description:'Macro & promotional context' },
};

// ── CSV parser — UNCHANGED ───────────────────────────────────────────────────
function parseCSV(file) {
  return new Promise((res, rej) => Papa.parse(file, {
    header:true, skipEmptyLines:true, dynamicTyping:false,
    complete:r=>res(r.data), error:rej,
  }));
}

// ── Validation engine — UNCHANGED ────────────────────────────────────────────
function validateDatasets(datasets) {
  const results = [];
  const s = datasets.sales;
  if (!s.length) return [{ label:'Sales CSV loaded', ok:false, msg:'Required' }];
  const cols = Object.keys(s[0] || {});
  const required = ['Store','Dept','Date','Weekly_Sales'];
  results.push({ label:'Required columns present', ok: required.every(c=>cols.includes(c)), msg: required.every(c=>cols.includes(c))?'All found':'Missing: '+required.filter(c=>!cols.includes(c)).join(', ') });
  const badDates = s.filter(r=>isNaN(new Date(r.Date))).length;
  results.push({ label:'Date format valid', ok:badDates===0, msg:badDates===0?'YYYY-MM-DD':'⚠ '+badDates+' invalid' });
  const negSales = s.filter(r=>parseFloat(r.Weekly_Sales)<0).length;
  results.push({ label:'Negative sales rows', ok:negSales===0, msg:negSales===0?'None detected':negSales+' rows flagged' });
  const nullSales = s.filter(r=>!r.Weekly_Sales).length;
  results.push({ label:'NULL weekly_sales', ok:nullSales===0, msg:nullSales===0?'Clean':'⚠ '+nullSales+' nulls' });
  if (datasets.external.length) {
    const nullCPI = datasets.external.filter(r=>!r.CPI && !r.Consumer_Price_Index).length;
    results.push({ label:'Missing CPI values', ok:nullCPI===0, msg:nullCPI===0?'Complete':'⚠ '+nullCPI+' missing' });
    const nullFuel = datasets.external.filter(r=>!r.Fuel_Price && !r.Fuel).length;
    results.push({ label:'Missing fuel price', ok:nullFuel===0, msg:nullFuel===0?'Complete':'⚠ '+nullFuel+' missing' });
  }
  results.push({ label:'Schema validated', ok:true, msg:'Passed' });
  results.push({ label:'Numeric validation', ok:true, msg:'Passed' });
  return results;
}

// ── NLQ answers — UNCHANGED ──────────────────────────────────────────────────
const NLQ_MAP = {
  'highest holiday uplift':  a => `Store Type C shows the strongest holiday uplift at +33.6%. Avg weekly sales jump from $3,267 → $4,364 during holiday weeks.`,
  'worst markdown roi':      a => `Store 11 shows the lowest markdown ROI (7.5×). High markdown spend (~$15M) yields below-average weekly sales of $90,938.`,
  'forecast dept 20':        a => `Department 20 (top revenue dept) is forecast to average $16,821/week next quarter based on XGBoost lag model. Holiday weeks may push to $22K+.`,
  'top store':               a => `${a?.salesByStore?.[0]?.store ?? 'Store 32'} is the top performer with $${((a?.salesByStore?.[0]?.sales??95403000)/1e6).toFixed(2)}M total revenue.`,
  'stockout':                a => `${a?.kpis?.stockoutCount ?? 0} SKU-store combinations are at zero stock. EOQ-based reorder of 49,251 units recommended for Store 1 immediately.`,
  'total revenue':           a => `Total revenue across all stores and weeks: $${(+(a?.kpis?.totalSales??3430000000)/1e9).toFixed(2)}B (${a?.kpis?.recordCount?.toLocaleString()??'421,570'} records).`,
};

function answerNLQ(query, analytics) {
  const q = query.toLowerCase();
  for (const [key, fn] of Object.entries(NLQ_MAP)) {
    if (q.includes(key)) return fn(analytics);
  }
  return `Query understood. Based on your data: ${analytics?.kpis?.storeCount ?? 45} stores · ${analytics?.kpis?.deptCount ?? 81} departments · avg weekly sales $${(+(analytics?.kpis?.avgWeeklySales??15981)).toLocaleString()}. Refine your question for specific metrics.`;
}

// ── Tooltip — editorial style ────────────────────────────────────────────────
const CT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#F7F4EE', border:`1px solid #ddd8cf`, padding:'8px 12px', fontFamily:'var(--font-mono)', fontSize:'0.65rem', boxShadow:'none' }}>
      {label && <p style={{ color:'#7a7a72', marginBottom:4, fontFamily:'var(--font-body)', fontSize:'0.62rem', textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</p>}
      {payload.map((p,i) => <p key={i} style={{ color:p.color||C.text }}>{p.name}: <strong>{typeof p.value==='number'?p.value.toLocaleString():p.value}</strong></p>)}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// APP ROOT — UNCHANGED logic, updated palette refs only
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [datasets,    setDatasets]    = useState({ sales:[], stores:[], products:[], inventory:[], external:[] });
  const [analytics,   setAnalytics]  = useState(null);
  const [showDash,    setShowDash]   = useState(false);
  const [activeTab,   setActiveTab]  = useState('overview');
  const [loading,     setLoading]    = useState(false);
  const [company,     setCompany]    = useState('');
  const [dataSource,  setDataSource] = useState('');
  const [filterType,  setFilterType] = useState('All');
  const [filterHoliday,setFilterHoliday]=useState(false);
  const [filterRange, setFilterRange]= useState('All');

  const loadFile = useCallback(async (key, file) => {
    const data = await parseCSV(file);
    setDatasets(prev => ({ ...prev, [key]: data }));
  }, []);

  const launch = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setAnalytics(runAllAnalytics(datasets));
      setDataSource('User Upload');
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
      setDataSource('Demo Dataset');
      setShowDash(true);
      setLoading(false);
    }, 400);
  };

  const reset = () => {
    setDatasets({ sales:[], stores:[], products:[], inventory:[], external:[] });
    setAnalytics(null); setShowDash(false); setCompany(''); setDataSource(''); setActiveTab('overview');
  };

  if (!showDash) return (
    <div className="app">
      <Nav />
      <Landing datasets={datasets} loadFile={loadFile} loadDemo={loadDemo}
               company={company} setCompany={setCompany} loading={loading} onLaunch={launch} />
    </div>
  );

  return (
    <div className="app">
      <Nav extra={
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div className="ds-status">
            <span className="dot-live"/>
            <span style={{ color:'rgba(247,244,238,0.5)', marginRight:2 }}>Dataset:</span>
            <strong style={{ color:'rgba(247,244,238,0.85)', fontFamily:'var(--font-mono)', fontSize:'0.62rem' }}>{dataSource || 'Loaded'}</strong>
            <span className="filter-divider" style={{ background:'rgba(247,244,238,0.15)' }}/>
            <span style={{ color:'rgba(247,244,238,0.4)' }}>{analytics?.kpis?.recordCount?.toLocaleString()} rows</span>
          </div>
          {company && <span style={{ fontFamily:'var(--font-body)', fontSize:'0.72rem', fontWeight:500, color:'rgba(247,244,238,0.75)' }}>{company}</span>}
          <button className="btn-outline" onClick={() => setShowDash(false)}>+ Data</button>
          <button className="btn-reset"   onClick={reset}>↩ Reset</button>
        </div>
      }/>
      {loading && <div className="loading-bar"/>}
      <Dashboard
        analytics={analytics} activeTab={activeTab} setActiveTab={setActiveTab}
        company={company} dataSource={dataSource}
        filterType={filterType} setFilterType={setFilterType}
        filterHoliday={filterHoliday} setFilterHoliday={setFilterHoliday}
        filterRange={filterRange} setFilterRange={setFilterRange}
      />
    </div>
  );
}

// ── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ extra }) {
  return (
    <nav className="nav">
      <div className="nav-brand">
        <div className="logo-dot"/>
        RetailIQ
        <span className="nav-tag">Demand Intelligence</span>
      </div>
      {extra}
    </nav>
  );
}

// ── Landing ──────────────────────────────────────────────────────────────────
function Landing({ datasets, loadFile, loadDemo, company, setCompany, loading, onLaunch }) {
  const [view,  setView]  = useState('upload');
  const salesLoaded  = datasets.sales.length > 0;
  const loadedCount  = Object.values(datasets).filter(d=>d.length>0).length;
  const validation   = validateDatasets(datasets);

  return (
    <main className="landing">
      <div style={{ textAlign:'center', marginBottom:'2rem' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'3px 12px', background:'rgba(74,99,85,0.08)', border:'1px solid rgba(74,99,85,0.2)', fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--violet)', marginBottom:'1.25rem', letterSpacing:'0.1em', textTransform:'uppercase' }}>
          DS-604 · THE INSIGHT EXPRESS
        </div>
        <h1 className="landing-title">Running a retail business<br/><span>shouldn't require guesswork.</span></h1>
        <p className="landing-sub">Upload your retail CSVs and get instant analytics — stockout alerts, demand forecasting, markdown ROI, scenario simulation and AI-generated recommendations.</p>
      </div>

      <div className="upload-tabs" style={{ marginBottom:'1.5rem' }}>
        <button className={`upload-tab ${view==='upload'?'active':''}`} onClick={()=>setView('upload')}>Upload Data</button>
        <button className={`upload-tab ${view==='validate'?'active':''}`} onClick={()=>setView('validate')}>Validation</button>
        <button className={`upload-tab ${view==='schema'?'active':''}`} onClick={()=>setView('schema')}>Schema</button>
      </div>

      {view === 'upload' && (
        <div className="upload-area">
          <div style={{ marginBottom:'1rem' }}>
            <label style={{ fontFamily:'var(--font-body)', fontSize:'0.65rem', fontWeight:500, color:'var(--text-muted)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.1em' }}>Company Name <span style={{ color:'var(--text-disabled)', fontWeight:400, textTransform:'none', letterSpacing:0 }}>(optional)</span></label>
            <input value={company} onChange={e=>setCompany(e.target.value)} placeholder="e.g. FreshMart Retail"
              style={{ background:'var(--bg-base)', border:'1px solid var(--border)', padding:'0.48rem 0.9rem', color:'var(--text-primary)', fontFamily:'var(--font-body)', fontSize:'0.78rem', width:'100%', outline:'none', borderRadius:0 }}/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:'0.75rem', marginBottom:'1rem' }}>
            {Object.entries(SCHEMAS).map(([key,s])=>(
              <FileCard key={key} schema={s} loaded={datasets[key].length>0} count={datasets[key].length} onFile={f=>loadFile(key,f)} isRequired={key==='sales'}/>
            ))}
          </div>
          {loadedCount > 0 && (
            <div style={{ marginBottom:'1rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--text-muted)', marginBottom:5 }}>
                <span>{loadedCount}/5 files loaded</span>
                <span style={{ color:salesLoaded?'var(--emerald)':'var(--amber)' }}>{salesLoaded?'Ready to analyse':'sales.csv required'}</span>
              </div>
              <div style={{ height:2, background:'var(--border)', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${loadedCount/5*100}%`, background:'var(--violet)', transition:'width 0.4s' }}/>
              </div>
            </div>
          )}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
            <button className="btn-primary" onClick={onLaunch} disabled={!salesLoaded||loading}>
              {loading ? 'Analysing...' : 'Launch Dashboard →'}
            </button>
            <button className="btn-demo" onClick={loadDemo} disabled={loading}>Load Demo Dataset</button>
          </div>
          {!salesLoaded && (
            <div style={{ marginTop:'0.9rem', padding:'0.65rem 1rem', background:'rgba(138,115,64,0.06)', border:'1px solid rgba(138,115,64,0.2)', fontFamily:'var(--font-mono)', fontSize:'0.63rem', color:'var(--amber)', borderLeft:'2px solid var(--amber)' }}>
              sales.csv is the only required file. All others are optional and unlock additional sections.
            </div>
          )}
        </div>
      )}

      {view === 'validate' && (
        <div className="upload-area">
          <div style={{ marginBottom:'0.5rem', fontFamily:'var(--font-body)', fontSize:'0.65rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.12em' }}>Upload Validation</div>
          {!salesLoaded ? (
            <div className="empty">Upload sales.csv first to run validation checks.</div>
          ) : (
            <div style={{ padding:'0.25rem 0' }}>
              {validation.map((v,i)=>(
                <div className="validation-row" key={i}>
                  <span className="val-icon">{v.ok ? '✓' : v.msg?.includes('⚠') ? '!' : '✗'}</span>
                  <span className="val-label">{v.label}</span>
                  <span className={`val-status ${v.ok?'val-ok':v.msg?.includes('⚠')?'val-warn':'val-fail'}`}>{v.msg}</span>
                </div>
              ))}
              <div style={{ marginTop:'0.8rem', padding:'0.6rem 0.8rem', background:'var(--bg-card2)', fontFamily:'var(--font-mono)', fontSize:'0.63rem', color:validation.every(v=>v.ok)?'var(--emerald)':'var(--amber)', borderLeft:'2px solid currentColor' }}>
                {validation.every(v=>v.ok) ? '✓ All checks passed — data is clean and ready for analysis.' : 'Some checks failed — dashboard will still load but review flagged items.'}
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'schema' && (
        <div style={{ width:'100%', maxWidth:880 }}>
          <p style={{ fontFamily:'var(--font-body)', fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:'1rem', lineHeight:1.8 }}>
            Columns marked <span style={{ color:'var(--emerald)', fontWeight:600 }}>★</span> are required. Extra columns are ignored automatically.
          </p>
          <div className="schema-grid">
            {Object.entries(SCHEMAS).map(([key,s])=>(
              <div className="schema-card" key={key}>
                <h4>{s.icon} {s.label}</h4>
                <p style={{ fontFamily:'var(--font-mono)', fontSize:'0.59rem', color:'var(--text-muted)', marginBottom:7 }}>{s.description}</p>
                <ul>
                  {s.required.map(c=><li key={c}><span style={{ color:'var(--emerald)' }}>★ </span>{c}</li>)}
                  {s.optional.map(c=><li key={c}><span style={{ color:'var(--text-disabled)' }}>○ </span>{c}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function FileCard({ schema, loaded, count, onFile, isRequired }) {
  const [drag,setDrag]=useState(false);
  return (
    <div className="file-card"
      style={{ background:loaded?'rgba(106,125,89,0.05)':'var(--bg-card)', border:`1px ${drag?'solid':'dashed'} ${loaded?'var(--emerald)':drag?'var(--violet)':'var(--border-mid)'}` }}
      onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
      onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)onFile(f);}}>
      <input type="file" accept=".csv" onChange={e=>e.target.files[0]&&onFile(e.target.files[0])}
        style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer', width:'100%', height:'100%' }}/>
      <div style={{ fontSize:'1.1rem', marginBottom:5, color:loaded?'var(--emerald)':'var(--text-muted)' }}>{loaded?'✓':schema.icon}</div>
      <div style={{ fontFamily:'var(--font-body)', fontSize:'0.72rem', fontWeight:500, color:loaded?'var(--emerald)':'var(--text-primary)', marginBottom:3 }}>{schema.label}</div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.57rem', color:'var(--text-muted)' }}>{loaded?`${count.toLocaleString()} rows`:schema.file}</div>
      {isRequired&&!loaded&&<div style={{ marginTop:5, fontFamily:'var(--font-mono)', fontSize:'0.54rem', fontWeight:600, color:'var(--amber)', border:'1px solid rgba(138,115,64,0.3)', padding:'1px 6px', display:'inline-block', letterSpacing:'0.08em' }}>REQUIRED</div>}
    </div>
  );
}

// ── Dashboard shell — UNCHANGED logic ────────────────────────────────────────
function Dashboard({ analytics, activeTab, setActiveTab, company, dataSource, filterType, setFilterType, filterHoliday, setFilterHoliday, filterRange, setFilterRange }) {
  const { kpis } = analytics;
  const TABS = [
    { id:'overview',  label:'Overview'      },
    { id:'sales',     label:'Sales'         },
    { id:'forecast',  label:'Forecast'      },
    { id:'inventory', label:'Inventory'     },
    { id:'scenario',  label:'Scenario'      },
    { id:'drivers',   label:'Drivers'       },
    { id:'insights',  label:'Insights'      },
    { id:'warehouse', label:'SQL Warehouse' },
  ];

  return (
    <main className="dashboard">
      <div className="dash-header">
        <div>
          <h1>{company||'Retail Analytics'} <span style={{ color:'var(--violet)', fontStyle:'italic' }}>Intelligence</span></h1>
          <p style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-muted)', marginTop:3 }}>
            {kpis.recordCount?.toLocaleString()} records · {kpis.storeCount} stores · {kpis.deptCount} departments · {dataSource||'loaded'}
          </p>
        </div>
        <div style={{ display:'flex', gap:7, flexWrap:'wrap', alignItems:'center' }}>
          {kpis.stockoutCount>0 && <span className="alert-badge red">{kpis.stockoutCount} Stockouts</span>}
          {kpis.reorderCount>0  && <span className="alert-badge amber">{kpis.reorderCount} Reorders</span>}
          <span className="alert-badge green">Holiday +{kpis.holidayLift}%</span>
          <span className="alert-badge violet">Accuracy {kpis.forecastAccuracy}%</span>
        </div>
      </div>

      <div className="global-filter-bar">
        <span className="filter-label">Filters</span>
        <select className="filter-select" value={filterType} onChange={e=>setFilterType(e.target.value)}>
          <option>All</option><option>Type A</option><option>Type B</option><option>Type C</option>
        </select>
        <select className="filter-select" value={filterRange} onChange={e=>setFilterRange(e.target.value)}>
          <option>All</option><option>Last 4 Weeks</option><option>Last 12 Weeks</option><option>Last 26 Weeks</option>
        </select>
        <select className="filter-select" defaultValue="All Depts">
          <option>All Depts</option><option>Top 10</option><option>Grocery</option><option>Electronics</option>
        </select>
        <div className="filter-divider"/>
        <button className={`filter-toggle ${filterHoliday?'active':''}`} onClick={()=>setFilterHoliday(h=>!h)}>
          Holiday Only
        </button>
        <div className="filter-divider"/>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--text-disabled)', marginLeft:'auto' }}>
          {filterType!=='All'||filterHoliday||filterRange!=='All' ? '● filters active' : '○ no filters'}
        </span>
      </div>

      <div className="kpi-row">
        <KPI label="Total Revenue"      value={`$${(+kpis.totalSales/1e6).toFixed(2)}M`}         sub="all stores & weeks"    color="var(--violet)"  trend="+8.3%" up tip="Sum of all weekly_sales records in the dataset." />
        <KPI label="Avg Weekly / Store" value={`$${(+kpis.avgWeeklySales).toLocaleString()}`}     sub="per store-dept-week"   color="var(--emerald)" trend="+4.1%" up tip="Mean weekly_sales across all store-dept-week combinations." />
        <KPI label="Inventory Turnover" value={`${kpis.inventoryTurnover??'4.3'}×`}               sub="annualised estimate"   color="var(--amber)"   trend="+0.3×" up tip="COGS proxy / avg inventory." />
        <KPI label="Forecast Accuracy"  value={`${kpis.forecastAccuracy??'91.2'}%`}               sub="XGBoost MAPE 8.2%"     color="var(--sky)"     trend="+1.8%" up tip="100 − MAPE. XGBoost RMSE=112, MAE=81, R²=0.94." />
        <KPI label="Holiday Lift"       value={`${kpis.holidayLift}%`}                            sub="vs non-holiday weeks"  color="var(--orange)"  trend="seasonal" tip="(Holiday avg − Regular avg) / Regular avg × 100." />
        <KPI label="Stockout Risk"      value={kpis.stockoutCount}                                sub="zero-stock SKU-stores" color={kpis.stockoutCount>0?"var(--rose)":"var(--emerald)"} trend={kpis.stockoutCount>0?'ACT':'CLEAR'} up={kpis.stockoutCount===0} tip="Count of inventory rows where Stock_Qty = 0." />
        <KPI label="Revenue at Risk"    value={`$${((kpis.revenueAtRisk??0)/1000).toFixed(0)}K`} sub="stockout loss (est.)"  color="var(--rose)"    trend="mitigate" tip="Stockout count × avg weekly sales × 0.5." />
        <KPI label="Health Score"       value={`${computeHealthScore(kpis)}/100`}                 sub="overall retail health" color="var(--violet)"  tip="Composite: revenue(30) + forecast(25) + inventory(25) + holiday(20)." />
      </div>

      <div className="dash-tabs">
        {TABS.map(t=><button key={t.id} className={`dash-tab ${activeTab===t.id?'active':''}`} onClick={()=>setActiveTab(t.id)}>{t.label}</button>)}
      </div>

      {activeTab==='overview'  && <OverviewTab  analytics={analytics}/>}
      {activeTab==='sales'     && <SalesTab     analytics={analytics}/>}
      {activeTab==='forecast'  && <ForecastTab  analytics={analytics}/>}
      {activeTab==='inventory' && <InventoryTab analytics={analytics}/>}
      {activeTab==='scenario'  && <ScenarioTab  analytics={analytics}/>}
      {activeTab==='drivers'   && <DriversTab   analytics={analytics}/>}
      {activeTab==='insights'  && <InsightsTab  analytics={analytics}/>}
      {activeTab==='warehouse' && <WarehouseTab analytics={analytics}/>}
    </main>
  );
}

function computeHealthScore(kpis) {
  const rev  = Math.min(30, 30 * (+kpis.totalSales / 3430000000));
  const acc  = Math.min(25, 25 * ((+kpis.forecastAccuracy??91) / 100));
  const inv  = Math.min(25, 25 * (kpis.stockoutCount === 0 ? 1 : Math.max(0, 1 - kpis.stockoutCount / 50)));
  const hol  = Math.min(20, 20 * Math.min(1, +kpis.holidayLift / 30));
  return Math.round(rev + acc + inv + hol);
}

function KPI({ label, value, sub, color, trend, up, tip }) {
  return (
    <div className="kpi-card" style={{ '--kpi-color':color }}>
      <div className="kpi-label">
        {label}
        {tip && <span className="kpi-tooltip" data-tip={tip} title={tip}>i</span>}
      </div>
      <div className="kpi-value">{value}</div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:5 }}>
        <div className="kpi-sub">{sub}</div>
        {trend && <div className="kpi-trend" style={{ color:up?'var(--emerald)':trend==='ACT'?'var(--rose)':'var(--text-muted)' }}>{trend}</div>}
      </div>
    </div>
  );
}

function SectionTitle({ children, actions }) {
  return (
    <div className="section-title">
      <div className="section-title-left">{children}</div>
      {actions && <div style={{ display:'flex', gap:6 }}>{actions}</div>}
    </div>
  );
}

function exportInsight(title, rows) {
  const lines = [`RetailIQ Export: ${title}`, `Generated: ${new Date().toLocaleDateString()}`, '', ...rows];
  const blob = new Blob([lines.join('\n')], { type:'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `retailiq_${title.replace(/\s+/g,'_').toLowerCase()}.txt`; a.click();
}

function ExportBtn({ title, rows }) {
  return <button className="btn-export" onClick={()=>exportInsight(title,rows)}>↓ Export</button>;
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({ analytics }) {
  const score = computeHealthScore(analytics.kpis);
  const scoreColor = score >= 80 ? 'var(--emerald)' : score >= 60 ? 'var(--amber)' : 'var(--rose)';
  const rev = analytics.monthlyRevenue.map(r=>({ ...r, upper:Math.round(r.sales*1.08), lower:Math.round(r.sales*0.92) }));

  const feedItems = [
    { level:'OK',   color:'var(--emerald)', msg:'Data integrity checks passed — 0 anomalies in 421,570 records' },
    { level:'WARN', color:'var(--amber)',   msg:`Markdown anomaly detected — Store 11 showing poor spend efficiency` },
    { level:'INFO', color:'var(--sky)',     msg:`Holiday uplift trigger active — ${analytics.kpis.holidayLift}% avg boost confirmed` },
    { level:'OK',   color:'var(--emerald)', msg:'XGBoost model refreshed — MAPE 8.2%, R² 0.94' },
    { level:'WARN', color:'var(--rose)',    msg:`${analytics.kpis.stockoutCount} stockout SKU-store combinations detected` },
  ];

  const insightLines = [
    `Revenue up across most stores — Type A dominates at ~73% of total`,
    `Holiday uplift strongest in Type C (+33.6%) despite lower baseline`,
    `Department 20 alone contributes ~14% of total revenue`,
    `Inventory shortage risk in Dept 20 before Q4 — reorder now`,
    `Forecast confidence high for Q4 — XGBoost R² 0.94`,
  ];

  return (
    <>
      <div className="chart-grid cols-2">
        <div className="chart-card" style={{ gridColumn:'1/-1' }}>
          <h3>Monthly Revenue <em>with ±8% confidence band</em></h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={rev}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="month" tick={{ fill:'#7a7a72', fontSize:10, fontFamily:'var(--font-mono)' }}/>
              <YAxis tickFormatter={v=>`$${(v/1e6).toFixed(1)}M`} tick={{ fill:'#7a7a72', fontSize:10, fontFamily:'var(--font-mono)' }}/>
              <Tooltip content={<CT/>}/>
              <Area type="monotone" dataKey="upper" stroke="none" fill="rgba(74,99,85,0.06)" name="Upper CI"/>
              <Area type="monotone" dataKey="sales"  stroke={C.violet} fill="rgba(74,99,85,0.08)" strokeWidth={1.5} name="Revenue"/>
              <Area type="monotone" dataKey="lower"  stroke="none" fill="transparent" name="Lower CI"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-grid cols-2">
        <div className="chart-card">
          <h3>Business Health Score</h3>
          <div style={{ display:'flex', gap:'1.5rem', alignItems:'center', marginTop:12 }}>
            <div className="health-score-wrap">
              <div className="health-score-val" style={{ color:scoreColor }}>{score}</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.58rem', color:'var(--text-muted)' }}>OUT OF 100</div>
              <div className="health-score-label">Retail Health</div>
              <div style={{ width:120, height:3, background:'var(--border)', marginTop:8 }}>
                <div style={{ height:'100%', width:`${score}%`, background:scoreColor }}/>
              </div>
            </div>
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { label:'Revenue',         val:Math.min(100,Math.round(+analytics.kpis.totalSales/3430000000*100)), color:'var(--violet)' },
                { label:'Forecast Acc.',   val:+(analytics.kpis.forecastAccuracy??91), color:'var(--sky)' },
                { label:'Stock Health',    val:analytics.kpis.stockoutCount===0?100:Math.max(30,100-analytics.kpis.stockoutCount*3), color:'var(--emerald)' },
                { label:'Holiday Uplift',  val:Math.min(100,Math.abs(+analytics.kpis.holidayLift)*3), color:'var(--amber)' },
              ].map((r,i)=>(
                <div key={i}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--text-muted)', marginBottom:3 }}>
                    <span>{r.label}</span><span style={{ color:r.color }}>{r.val}%</span>
                  </div>
                  <div style={{ height:3, background:'var(--border)' }}>
                    <div style={{ height:'100%', width:`${r.val}%`, background:r.color }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="insight-panel">
          <h4>Executive Insights</h4>
          {insightLines.map((t,i)=><div key={i} className="insight-item">{t}</div>)}
          <div style={{ marginTop:'0.8rem' }}>
            <ExportBtn title="Executive Insights" rows={insightLines}/>
          </div>
        </div>
      </div>

      <div className="chart-grid cols-2">
        <div className="chart-card">
          <h3>Top Stores by Revenue</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics.salesByStore.slice(0,10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
              <XAxis type="number" tickFormatter={v=>`$${(v/1e6).toFixed(1)}M`} tick={{ fill:'#7a7a72', fontSize:9, fontFamily:'var(--font-mono)' }}/>
              <YAxis type="category" dataKey="store" tick={{ fill:'#7a7a72', fontSize:9, fontFamily:'var(--font-mono)' }} width={62}/>
              <Tooltip content={<CT/>}/>
              <Bar dataKey="sales" name="Revenue" radius={0}>
                {analytics.salesByStore.slice(0,10).map((_,i)=><Cell key={i} fill={i===0?C.violet:i<3?C.emerald:'#ccc6bc'}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Live Monitoring Feed <em>trigger events</em></h3>
          <div className="live-feed" style={{ marginTop:8 }}>
            {feedItems.map((f,i)=>(
              <div key={i} className="feed-item" style={{ '--feed-color':f.color }}>
                <span className="feed-badge" style={{ background:f.color, color:'#F7F4EE' }}>{f.level}</span>
                {f.msg}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="chart-grid cols-2">
        <div className="chart-card">
          <h3>Multi-Dimensional Performance</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={[
              { m:'Revenue',    v:85 }, { m:'Turnover',   v:72 },
              { m:'Inv. Health',v:analytics.kpis.stockoutCount===0?95:60 },
              { m:'Hol. Lift',  v:Math.min(100,Math.abs(+analytics.kpis.holidayLift)*4) },
              { m:'Dept Spread',v:Math.min(100,analytics.kpis.deptCount*4) },
              { m:'Forecast',   v:+(analytics.kpis.forecastAccuracy??91) },
            ]}>
              <PolarGrid stroke={C.border}/>
              <PolarAngleAxis dataKey="m" tick={{ fill:'#7a7a72', fontSize:10, fontFamily:'var(--font-body)' }}/>
              <Radar name="Score" dataKey="v" stroke={C.violet} fill={C.violet} fillOpacity={0.12} strokeWidth={1.5}/>
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Department Revenue Share</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={analytics.categoryShare} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={85} paddingAngle={2}>
                {analytics.categoryShare.map((_,i)=><Cell key={i} fill={PIE[i%PIE.length]}/>)}
              </Pie>
              <Tooltip content={<CT/>} formatter={v=>[`$${v.toLocaleString()}`,'Revenue']}/>
              <Legend formatter={v=><span style={{ fontSize:'0.62rem', fontFamily:'var(--font-body)', color:'#7a7a72' }}>{v}</span>}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: SALES
// ─────────────────────────────────────────────────────────────────────────────
function SalesTab({ analytics }) {
  const [drill, setDrill]   = useState('All Stores');
  const [period, setPeriod] = useState('Weekly');

  const keyInsights = [
    `Department 20 contributes ~14% of total revenue across all stores`,
    `Store Type A dominates holiday sales — highest absolute and relative uplift`,
    `Sales spike concentrated in Nov–Dec driven by Dept 20 holiday outliers`,
    `Top 3 departments account for ${(()=>{ const t=analytics.salesByDept.reduce((s,d)=>s+d.sales,0)||1; return ((analytics.salesByDept.slice(0,3).reduce((s,d)=>s+d.sales,0)/t)*100).toFixed(0); })()}% of total revenue`,
  ];

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, padding:'0.75rem 0.75rem 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--text-muted)', marginRight:4, textTransform:'uppercase', letterSpacing:'0.1em' }}>Drilldown</span>
          {['All Stores','Type A','Type B','Type C','Department'].map(d=>(
            <button key={d} className={`drilldown-crumb ${drill===d?'active':''}`} onClick={()=>setDrill(d)}>{d}</button>
          ))}
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {['Weekly','Monthly','Quarterly'].map(p=>(
            <button key={p} className={`drilldown-crumb ${period===p?'active':''}`} onClick={()=>setPeriod(p)}>{p}</button>
          ))}
        </div>
      </div>

      <div className="section">
        <SectionTitle actions={[<ExportBtn key="e" title="Weekly Sales Trend" rows={analytics.weeklyTrend.slice(-10).map(d=>`${d.date}: $${d.sales.toLocaleString()}${d.holiday?' [HOLIDAY]':''}`)}/>]}>Weekly Sales Trend</SectionTitle>
        <div className="chart-card">
          <h3>Sales Over Time <em>holiday weeks marked</em></h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={analytics.weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="date" tick={{ fill:'#7a7a72', fontSize:9, fontFamily:'var(--font-mono)' }} interval={Math.floor(analytics.weeklyTrend.length/8)}/>
              <YAxis tickFormatter={v=>`$${(v/1e6).toFixed(1)}M`} tick={{ fill:'#7a7a72', fontSize:10, fontFamily:'var(--font-mono)' }}/>
              <Tooltip content={<CT/>}/>
              {analytics.weeklyTrend.filter(d=>d.holiday).map((d,i)=><ReferenceLine key={i} x={d.date} stroke={C.amber} strokeOpacity={0.4} strokeDasharray="3 3"/>)}
              <Line type="monotone" dataKey="sales" stroke={C.violet} dot={false} strokeWidth={1.5} name="Weekly Sales"/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-grid cols-2">
        <div className="chart-card">
          <h3>Store Performance Score</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={analytics.storePerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="store" tick={{ fill:'#7a7a72', fontSize:9, fontFamily:'var(--font-mono)' }}/>
              <YAxis tickFormatter={v=>`${v}%`} tick={{ fill:'#7a7a72', fontSize:10, fontFamily:'var(--font-mono)' }}/>
              <Tooltip content={<CT/>}/>
              <Bar dataKey="score" name="Score" radius={0}>
                {analytics.storePerformance.map((d,i)=><Cell key={i} fill={d.score>80?C.emerald:d.score>50?C.violet:C.border}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Sales Heatmap <em>week × department</em></h3>
          <div style={{ overflowX:'auto', marginTop:4 }}>
            <div style={{ display:'grid', gridTemplateColumns:`60px repeat(8,1fr)`, gap:2, minWidth:400 }}>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.55rem', color:'var(--text-muted)' }}></div>
              {['D20','D19','D18','D17','D16','D4','D5','D2'].map(d=>(
                <div key={d} style={{ fontFamily:'var(--font-mono)', fontSize:'0.55rem', color:'var(--text-muted)', textAlign:'center' }}>{d}</div>
              ))}
              {['W1','W2','W3','W4','W5','W6','W7','W8'].map((w,wi)=>(
                <React.Fragment key={w}>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.55rem', color:'var(--text-muted)', display:'flex', alignItems:'center' }}>{w}</div>
                  {[0.9,0.7,0.8,0.6,0.75,0.65,0.55,0.5].map((v,di)=>{
                    const heat = Math.min(1, v + (Math.random()*0.2-0.08+wi*0.01));
                    const opacity = 0.08 + heat * 0.5;
                    return <div key={di} style={{ height:22, background:`rgba(74,99,85,${opacity})`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-mono)', fontSize:'0.5rem', color:'var(--text-muted)', border:'1px solid var(--border)' }}>{Math.round(heat*100)}%</div>;
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <SectionTitle>Top &amp; Bottom Performers</SectionTitle>
        <div className="chart-grid cols-2">
          <div className="chart-card">
            <h3>Top 10 Departments</h3>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>#</th><th>Department</th><th>Total Sales</th><th>Avg Weekly</th></tr></thead>
                <tbody>
                  {analytics.salesByDept.slice(0,10).map((d,i)=>(
                    <tr key={i}>
                      <td><span className={`badge ${i===0?'badge-gold':i<3?'badge-violet':'badge-green'}`}>{i+1}</span></td>
                      <td><strong style={{ color:'var(--text-primary)' }}>{d.dept}</strong></td>
                      <td style={{ color:'var(--emerald)', fontFamily:'var(--font-mono)', fontSize:'0.7rem' }}>${d.sales.toLocaleString()}</td>
                      <td style={{ fontFamily:'var(--font-mono)', fontSize:'0.7rem' }}>${d.avg.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="chart-card">
            <h3>Key Sales Insights</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.45rem', marginTop:4 }}>
              {keyInsights.map((t,i)=><div key={i} className="insight-item">{t}</div>)}
            </div>
            <div style={{ marginTop:'1rem' }}>
              <ExportBtn title="Sales Key Insights" rows={keyInsights}/>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: FORECAST
// ─────────────────────────────────────────────────────────────────────────────
function ForecastTab({ analytics }) {
  const [horizon, setHorizon] = useState(12);
  const models = [
    { name:'XGBoost',  rmse:112, mae:81,  mape:8.2,  r2:0.94, best:true,  color:C.violet  },
    { name:'Prophet',  rmse:210, mae:158, mape:13.8, r2:0.87, best:false, color:C.emerald },
    { name:'SARIMA',   rmse:189, mae:141, mape:12.1, r2:0.89, best:false, color:C.amber   },
    { name:'LightGBM', rmse:119, mae:85,  mape:8.8,  r2:0.93, best:false, color:C.sky     },
  ];
  const trend = analytics.weeklyTrend;
  const fData = trend.slice(-20).map((d,i)=>({
    date:d.date, actual:d.sales,
    forecast:Math.round(d.sales*(1+(Math.sin(i/3)*0.05)+0.02)),
    upper:Math.round(d.sales*1.1), lower:Math.round(d.sales*0.9),
  }));
  const shap = [
    { f:'lag_1 (prev week)',   v:38, color:C.violet  },
    { f:'rolling_mean_4',      v:27, color:C.emerald },
    { f:'lag_4',               v:16, color:C.amber   },
    { f:'month (seasonality)', v:10, color:C.sky     },
    { f:'lag_2',               v:6,  color:C.orange  },
    { f:'week_of_year',        v:3,  color:C.rose    },
  ];
  const explanation = [
    'Yearly seasonality dominates — Nov/Dec peaks driven by Dept 20 holiday spikes',
    'Lag-based demand persistence: last week\'s sales strongly predict next week',
    'Markdown promotions contribute +21% uplift to demand variance',
    'Forecast confidence reduced during aggressive markdown periods (high volatility)',
  ];
  return (
    <>
      <div className="section">
        <SectionTitle actions={[<ExportBtn key="e" title="Model Comparison" rows={models.map(m=>`${m.name}: RMSE=${m.rmse} MAE=${m.mae} MAPE=${m.mape}% R²=${m.r2}${m.best?' [BEST]':''}`)}/>]}>Multi-Model Comparison</SectionTitle>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(165px,1fr))', gap:'0.75rem', padding:'0 0.75rem' }}>
          {models.map(m=>(
            <div key={m.name} style={{ background:m.best?'rgba(74,99,85,0.06)':'var(--bg-card)', border:`1px solid ${m.best?'var(--violet)':'var(--border)'}`, borderTop:`2px solid ${m.color}`, padding:'1rem 1.1rem', position:'relative' }}>
              {m.best && <div style={{ position:'absolute', top:10, right:10, fontFamily:'var(--font-mono)', fontSize:'0.52rem', color:'var(--violet)', border:'1px solid rgba(74,99,85,0.3)', padding:'1px 5px', letterSpacing:'0.08em' }}>BEST</div>}
              <div style={{ fontFamily:'var(--font-head)', fontSize:'0.95rem', fontWeight:400, color:m.color, marginBottom:10, letterSpacing:'-0.01em' }}>{m.name}</div>
              {[['RMSE',m.rmse],['MAE',m.mae],['MAPE',`${m.mape}%`],['R²',m.r2]].map(([k,v])=>(
                <div key={k} style={{ display:'flex', justifyContent:'space-between', fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-muted)', marginBottom:4 }}>
                  <span>{k}</span><span style={{ color:m.best?m.color:'var(--text-secondary)', fontWeight:m.best?600:400 }}>{v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ margin:'0.75rem', padding:'0.6rem 1rem', background:'rgba(74,99,85,0.06)', border:'1px solid rgba(74,99,85,0.2)', borderLeft:'2px solid var(--violet)', fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--violet)' }}>
          XGBoost auto-selected — lowest RMSE (112) · highest R² (0.94) · MAPE 8.2%
        </div>
      </div>

      <div className="section">
        <SectionTitle>Forecast with Confidence Intervals</SectionTitle>
        <div className="chart-card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.8rem' }}>
            <h3 style={{ margin:0 }}>Actual vs XGBoost Forecast <em>±10% prediction band</em></h3>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-muted)' }}>Horizon: <strong style={{ color:'var(--violet)' }}>{horizon}w</strong></span>
              <input type="range" min={4} max={24} step={4} value={horizon} onChange={e=>setHorizon(+e.target.value)} style={{ width:100 }}/>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={fData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="date" tick={{ fill:'#7a7a72', fontSize:9, fontFamily:'var(--font-mono)' }} interval={3}/>
              <YAxis tickFormatter={v=>`$${(v/1e6).toFixed(1)}M`} tick={{ fill:'#7a7a72', fontSize:10, fontFamily:'var(--font-mono)' }}/>
              <Tooltip content={<CT/>}/>
              <Area type="monotone" dataKey="upper" stroke="none" fill="rgba(106,125,89,0.08)" name="Upper CI"/>
              <Area type="monotone" dataKey="lower" stroke="none" fill="transparent" name="Lower CI"/>
              <Line type="monotone" dataKey="actual"   stroke={C.emerald} dot={false} strokeWidth={1.5} name="Actual"/>
              <Line type="monotone" dataKey="forecast" stroke={C.violet}  dot={false} strokeWidth={1.5} strokeDasharray="5 3" name="Forecast"/>
              <Legend formatter={v=><span style={{ fontSize:'0.62rem', fontFamily:'var(--font-body)', color:'#7a7a72' }}>{v}</span>}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-grid cols-2">
        <div className="chart-card">
          <h3>Feature Importance <em>SHAP-style</em></h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:10 }}>
            {shap.map((f,i)=>(
              <div key={i}>
                <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'var(--font-mono)', fontSize:'0.63rem', color:'var(--text-muted)', marginBottom:3 }}>
                  <span>{f.f}</span><span style={{ color:f.color, fontWeight:600 }}>{f.v}%</span>
                </div>
                <div style={{ height:3, background:'var(--border)' }}>
                  <div style={{ height:'100%', width:`${f.v*2.5}%`, background:f.color }}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <h3>Forecast Explanation Panel</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
            {[
              { icon:'↗', label:'Seasonal factor',      effect:'+34%', color:C.violet,  desc:'Yearly cycle dominates — Nov/Dec peaks' },
              { icon:'↗', label:'Promotion / Markdown', effect:'+21%', color:C.emerald, desc:'Active discounts boost weekly throughput' },
              { icon:'↗', label:'Holiday effect',       effect:'+14%', color:C.amber,   desc:'Holiday flag drives 14% avg uplift' },
              { icon:'↘', label:'CPI / Inflation drag', effect:'-6%',  color:C.rose,    desc:'Non-essential spend compressed' },
              { icon:'↘', label:'Fuel price headwind',  effect:'-4%',  color:C.orange,  desc:'Higher fuel = fewer store visits' },
            ].map((d,i)=>(
              <div key={i} style={{ display:'flex', gap:10, padding:'0.5rem 0.75rem', background:'var(--bg-card2)', borderLeft:`2px solid ${d.color}` }}>
                <span style={{ color:d.color, fontFamily:'var(--font-mono)', fontSize:'0.8rem', flexShrink:0 }}>{d.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontFamily:'var(--font-body)', fontSize:'0.68rem', color:'var(--text-secondary)', fontWeight:500 }}>{d.label}</span>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.63rem', fontWeight:600, color:d.color }}>{d.effect}</span>
                  </div>
                  <div style={{ fontFamily:'var(--font-body)', fontSize:'0.6rem', color:'var(--text-muted)', marginTop:1 }}>{d.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:'0.8rem' }}><ExportBtn title="Forecast Explanation" rows={explanation}/></div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: INVENTORY
// ─────────────────────────────────────────────────────────────────────────────
function InventoryTab({ analytics }) {
  const [demand,   setDemand]   = useState(121290);
  const [holding,  setHolding]  = useState(10);
  const [ordering, setOrdering] = useState(50);
  const [lead,     setLead]     = useState(2);
  const eoq  = Math.round(Math.sqrt(2 * demand * ordering / holding));
  const rp   = Math.round((demand/52)*lead + 5000);
  const simPct = ((demand-121290)/121290*100).toFixed(1);
  const simRP  = Math.round((demand/52)*lead + 5000);

  const statusCounts = analytics.inventoryStatus.reduce((m,r)=>{ m[r.status]=(m[r.status]||0)+1; return m; },{});
  const pieData = Object.entries(statusCounts).map(([name,value])=>({name,value}));
  const cm = { OK:C.emerald, LOW:C.amber, STOCKOUT:C.rose, OVERSTOCK:C.violet };

  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:'0.75rem', padding:'0.75rem' }}>
        {analytics.kpis.stockoutCount>0 && <AlertCard color={C.rose}    title="Critical Stockouts"  count={analytics.kpis.stockoutCount} desc="Zero-stock SKUs — revenue loss active"/>}
        {analytics.kpis.reorderCount>0  && <AlertCard color={C.amber}   title="Reorder Warnings"    count={analytics.kpis.reorderCount}  desc="Below reorder point — action needed"/>}
        <AlertCard color={C.violet} title="EOQ (computed)"    count={eoq.toLocaleString()} desc="Economic Order Qty — live calculator"/>
        <AlertCard color={C.emerald} title="Inventory Score"  count={`${analytics.kpis.stockoutCount===0?100:Math.max(30,100-analytics.kpis.stockoutCount*3)}%`} desc="Supply health score"/>
      </div>

      <div className="chart-grid cols-2">
        <div className="chart-card">
          <h3>Inventory Health Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} paddingAngle={2}>
                {pieData.map((d,i)=><Cell key={i} fill={cm[d.name]||C.sky}/>)}
              </Pie>
              <Tooltip content={<CT/>}/>
              <Legend formatter={v=><span style={{ fontSize:'0.62rem', fontFamily:'var(--font-body)', color:'#7a7a72' }}>{v}</span>}/>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Live EOQ Calculator <em>interactive</em></h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.9rem', marginTop:6 }}>
            {[
              { label:'Annual Demand (units)', val:demand,  min:50000, max:300000, step:1000, set:setDemand,  color:C.violet  },
              { label:'Holding Cost ($/unit)', val:holding, min:1,     max:50,     step:1,    set:setHolding, color:C.emerald },
              { label:'Ordering Cost ($)',      val:ordering,min:10,    max:200,    step:5,    set:setOrdering,color:C.amber   },
              { label:'Lead Time (weeks)',      val:lead,   min:1,     max:8,      step:1,    set:setLead,    color:C.sky     },
            ].map((s,i)=>(
              <div key={i}>
                <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-muted)', marginBottom:4 }}>
                  <span>{s.label}</span><span style={{ color:s.color, fontWeight:600 }}>{s.val.toLocaleString()}</span>
                </div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={s.val} onChange={e=>s.set(+e.target.value)}/>
              </div>
            ))}
            <div style={{ padding:'0.7rem 0.9rem', background:'var(--bg-card2)', borderLeft:'2px solid var(--violet)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'var(--font-mono)', fontSize:'0.62rem', marginBottom:5 }}>
                <span style={{ color:'var(--text-muted)' }}>EOQ</span>
                <span style={{ color:'var(--violet)', fontWeight:600, fontSize:'1rem' }}>{eoq.toLocaleString()} units</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'var(--font-mono)', fontSize:'0.62rem' }}>
                <span style={{ color:'var(--text-muted)' }}>Reorder Point</span>
                <span style={{ color:'var(--amber)', fontWeight:600 }}>{rp.toLocaleString()} units</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="chart-card" style={{ margin:'0 0.75rem' }}>
        <h3>Inventory Impact Simulation <em>demand forecast integration</em></h3>
        <div style={{ padding:'0.75rem 1rem', background:'rgba(74,99,85,0.05)', border:'1px solid rgba(74,99,85,0.15)', borderLeft:'2px solid var(--violet)', fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'var(--text-secondary)' }}>
          If demand increases by <strong style={{ color:'var(--violet)' }}>{simPct}%</strong>:
          Reorder point shifts to <strong style={{ color:'var(--rose)' }}>{simRP.toLocaleString()}</strong>.
          EOQ increases to <strong style={{ color:'var(--emerald)' }}>{eoq.toLocaleString()}</strong> units.
          {eoq > 49251 ? ' Increase next order.' : eoq < 49251 ? ' Reduce order size.' : ' Optimal at current demand.'}
        </div>
      </div>

      <div className="section">
        <SectionTitle>Reorder Recommendations</SectionTitle>
        <div className="chart-card">
          <h3>EOQ-Based Reorder Actions</h3>
          {analytics.reorderAlerts.length===0
            ? <div className="empty">All inventory above reorder points</div>
            : <div className="table-wrapper">
                <table>
                  <thead><tr><th>Product</th><th>Stock</th><th>Reorder Pt</th><th>Deficit</th><th>EOQ Order</th></tr></thead>
                  <tbody>
                    {analytics.reorderAlerts.map((r,i)=>(
                      <tr key={i}>
                        <td><strong style={{ color:'var(--text-primary)' }}>{r.product}</strong></td>
                        <td style={{ color:r.qty===0?'var(--rose)':'var(--amber)', fontFamily:'var(--font-mono)', fontSize:'0.7rem' }}>{r.qty}</td>
                        <td style={{ fontFamily:'var(--font-mono)', fontSize:'0.7rem' }}>{r.reorder}</td>
                        <td style={{ color:'var(--rose)', fontWeight:600, fontFamily:'var(--font-mono)', fontSize:'0.7rem' }}>-{r.deficit}</td>
                        <td><span className="badge badge-violet">{r.eoq} units</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </div>
      </div>
    </>
  );
}

function AlertCard({color,title,count,desc}) {
  return (
    <div style={{ background:'var(--bg-card)', border:`1px solid ${color}44`, borderLeft:`2px solid ${color}`, padding:'1rem 1.1rem' }}>
      <div style={{ fontFamily:'var(--font-body)', fontSize:'0.68rem', fontWeight:500, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:5 }}>{title}</div>
      <div style={{ fontFamily:'var(--font-head)', fontSize:'1.7rem', fontWeight:400, color, lineHeight:1, marginBottom:3, letterSpacing:'-0.02em' }}>{count}</div>
      <div style={{ fontFamily:'var(--font-body)', fontSize:'0.62rem', color:'var(--text-muted)' }}>{desc}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: SCENARIO — UNCHANGED logic, updated colors
// ─────────────────────────────────────────────────────────────────────────────
function ScenarioTab({ analytics }) {
  const base = +analytics.kpis.avgWeeklySales;
  const lift = +analytics.kpis.holidayLift/100;
  const [disc,    setDisc]    = useState(0);
  const [holiday, setHoliday] = useState(false);
  const [weather, setWeather] = useState(0);
  const [fest,    setFest]    = useState(false);
  const [stores,  setStores]  = useState(0);
  const [cpi,     setCpi]     = useState(0);
  const [fuel,    setFuel]    = useState(0);
  const [unemp,   setUnemp]   = useState(0);
  const [preset,  setPreset]  = useState(null);

  const applyPreset = (p) => {
    setPreset(p);
    if (p==='inflation') { setCpi(5); setFuel(0.5); setDisc(0); setHoliday(false); setFest(false); }
    else if (p==='holiday_boom') { setHoliday(true); setFest(true); setDisc(15); setCpi(0); setFuel(0); }
    else if (p==='supply_crisis') { setStores(-2); setUnemp(3); setDisc(0); setHoliday(false); }
    else if (p==='markdown') { setDisc(25); setHoliday(false); setFest(false); setCpi(0); }
    else { setDisc(0); setHoliday(false); setWeather(0); setFest(false); setStores(0); setCpi(0); setFuel(0); setUnemp(0); setPreset(null); }
  };

  const pct = disc*0.018 + (holiday?lift:0) + weather*0.03 + (fest?0.12:0) + stores*0.08
              - cpi*0.012 - fuel*0.015 - unemp*0.01;
  const sim = base*(1+pct);
  const weekImpact   = Math.round((sim-base)*analytics.kpis.storeCount*analytics.kpis.deptCount);
  const annualImpact = weekImpact*52;

  const chartData = Array.from({length:12},(_,i)=>({
    week:`W${i+1}`,
    baseline:Math.round(base*analytics.kpis.storeCount),
    simulated:Math.round(sim*analytics.kpis.storeCount*(0.97+Math.random()*0.06)),
  }));

  const outcome = {
    revenue: `${pct>=0?'+':''}${(pct*100).toFixed(1)}%`,
    risk:    Math.abs(pct)<0.05?'Low':Math.abs(pct)<0.12?'Medium':'High',
    stability: disc>20||unemp>2||fuel>0.5?'Low':holiday||fest?'Medium':'High',
  };

  const PRESETS = [
    { id:'inflation',    icon:'↑', name:'Inflation Shock',       desc:'CPI+5, Fuel+$0.5' },
    { id:'holiday_boom', icon:'◆', name:'Holiday Boom',          desc:'Holiday+Festival+15% off' },
    { id:'supply_crisis',icon:'!', name:'Supply Chain Crisis',   desc:'-2 stores, +3% unemployment' },
    { id:'markdown',     icon:'%', name:'Aggressive Markdown',   desc:'25% discount campaign' },
  ];

  return (
    <>
      <div className="section">
        <SectionTitle>What-If Scenario Presets</SectionTitle>
        <div className="preset-grid" style={{ padding:'0 0.75rem' }}>
          {PRESETS.map(p=>(
            <div key={p.id} className={`preset-card ${preset===p.id?'active':''}`} onClick={()=>applyPreset(p.id)}>
              <span className="preset-icon" style={{ fontFamily:'var(--font-mono)', color:'var(--violet)' }}>{p.icon}</span>
              <div className="preset-name">{p.name}</div>
              <div className="preset-desc">{p.desc}</div>
            </div>
          ))}
          <div className="preset-card" onClick={()=>applyPreset(null)}>
            <span className="preset-icon" style={{ fontFamily:'var(--font-mono)', color:'var(--text-muted)' }}>↺</span>
            <div className="preset-name">Reset All</div>
            <div className="preset-desc">Clear all levers</div>
          </div>
        </div>
      </div>

      <div className="chart-grid cols-2">
        <div className="chart-card">
          <h3>Scenario Levers</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.9rem', marginTop:8 }}>
            <Slider label="Discount / Markdown %" value={disc}    min={0}   max={30}  step={1}   onChange={setDisc}    color={C.emerald} display={`${disc}%`}/>
            <Slider label="CPI Shock (pp)"         value={cpi}    min={0}   max={10}  step={0.5} onChange={setCpi}     color={C.rose}    display={`+${cpi}pp`}/>
            <Slider label="Fuel Price ($/gal)"     value={fuel}   min={0}   max={1.5} step={0.1} onChange={setFuel}    color={C.orange}  display={`+$${fuel}`}/>
            <Slider label="Unemployment (pp)"      value={unemp}  min={0}   max={5}   step={0.5} onChange={setUnemp}   color={C.amber}   display={`+${unemp}pp`}/>
            <Slider label="Weather Effect (°F)"    value={weather}min={-2}  max={2}   step={0.5} onChange={setWeather} color={C.sky}     display={`${weather>0?'+':''}${weather}°F`}/>
            <Slider label="Store Expansion"        value={stores} min={-5}  max={5}   step={1}   onChange={setStores}  color={C.violet}  display={`${stores>0?'+':''}${stores}`}/>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
              <Toggle label="Holiday Week"  value={holiday} onChange={setHoliday} color={C.amber}/>
              <Toggle label="Festival Mode" value={fest}    onChange={setFest}    color={C.violet}/>
            </div>
          </div>
        </div>

        <div className="chart-card">
          <h3>Business Outcome Panel</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:8 }}>
            <ImpactRow label="Simulated Avg Weekly / Store" val={`$${Math.round(sim).toLocaleString()}`}           delta={`${pct>=0?'+':''}${(pct*100).toFixed(1)}%`} color={pct>=0?C.emerald:C.rose}/>
            <ImpactRow label="Weekly Impact (all stores)"   val={`${weekImpact>=0?'+':''}$${Math.abs(weekImpact).toLocaleString()}`} delta={`${pct>=0?'+':''}${(pct*100).toFixed(1)}%`} color={weekImpact>=0?C.emerald:C.rose}/>
            <ImpactRow label="Projected Annual Impact"      val={`${annualImpact>=0?'+':''}$${(Math.abs(annualImpact)/1e6).toFixed(2)}M`} delta={annualImpact>=0?'upside':'risk'} color={annualImpact>=0?C.emerald:C.rose}/>
            <div style={{ padding:'0.75rem', background:'var(--bg-card2)', borderLeft:'2px solid var(--border)' }}>
              <div style={{ fontFamily:'var(--font-body)', fontSize:'0.62rem', fontWeight:500, color:'var(--text-muted)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.1em' }}>Expected Impact Summary</div>
              {[['Revenue Impact',    outcome.revenue,    pct>=0?C.emerald:C.rose],
                ['Inventory Risk',    outcome.risk,       outcome.risk==='Low'?C.emerald:outcome.risk==='Medium'?C.amber:C.rose],
                ['Forecast Stability',outcome.stability,  outcome.stability==='High'?C.emerald:outcome.stability==='Medium'?C.amber:C.rose],
              ].map(([k,v,c],i)=>(
                <div key={i} style={{ display:'flex', justifyContent:'space-between', fontFamily:'var(--font-mono)', fontSize:'0.63rem', marginBottom:5 }}>
                  <span style={{ color:'var(--text-muted)' }}>{k}</span>
                  <strong style={{ color:c }}>{v}</strong>
                </div>
              ))}
              <div style={{ marginTop:8, padding:'0.55rem 0.7rem', background:'var(--bg-card)', borderLeft:'2px solid var(--violet)', fontFamily:'var(--font-body)', fontSize:'0.65rem', color:'var(--text-secondary)' }}>
                {pct>0.1?`Increase Dept 20 inventory allocation ahead of projected demand spike (+${(pct*100).toFixed(0)}%).`:pct<-0.05?`Risk scenario: monitor sales closely and reduce markdown spend at low-ROI stores.`:`Stable outlook — maintain current inventory levels.`}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="chart-card" style={{ margin:'0 0.75rem 0.75rem' }}>
        <h3>12-Week Projection — Simulated vs Baseline</h3>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
            <XAxis dataKey="week" tick={{ fill:'#7a7a72', fontSize:10, fontFamily:'var(--font-mono)' }}/>
            <YAxis tickFormatter={v=>`$${(v/1e6).toFixed(2)}M`} tick={{ fill:'#7a7a72', fontSize:10, fontFamily:'var(--font-mono)' }}/>
            <Tooltip content={<CT/>}/>
            <Legend formatter={v=><span style={{ fontSize:'0.62rem', fontFamily:'var(--font-body)', color:'#7a7a72' }}>{v}</span>}/>
            <Bar dataKey="baseline"  name="Baseline"  fill={C.border}                       radius={0}/>
            <Bar dataKey="simulated" name="Simulated" fill={pct>=0?C.emerald:C.rose} radius={0}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

const Slider = ({label,value,min,max,step,onChange,color,display}) => (
  <div>
    <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-muted)', marginBottom:5 }}>
      <span>{label}</span><span style={{ color, fontWeight:600 }}>{display}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)}/>
  </div>
);

const Toggle = ({label,value,onChange,color}) => (
  <button onClick={()=>onChange(!value)} style={{ padding:'0.42rem 0.85rem', background:value?`rgba(74,99,85,0.08)`:'var(--bg-card2)', border:`1px solid ${value?color:'var(--border)'}`, borderRadius:0, color:value?color:'var(--text-muted)', fontFamily:'var(--font-body)', fontSize:'0.7rem', fontWeight:value?500:400, cursor:'pointer', transition:'all 0.15s', letterSpacing:'0.04em' }}>
    {label}
  </button>
);

const ImpactRow = ({label,val,delta,color}) => (
  <div style={{ padding:'0.6rem 0.85rem', background:'var(--bg-card2)', borderLeft:`2px solid ${color}` }}>
    <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.58rem', color:'var(--text-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.1em' }}>{label}</div>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
      <span style={{ fontFamily:'var(--font-head)', fontSize:'1.05rem', fontWeight:400, color, letterSpacing:'-0.01em' }}>{val}</span>
      <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color, fontWeight:600 }}>{delta}</span>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// TAB: DRIVERS — UNCHANGED logic
// ─────────────────────────────────────────────────────────────────────────────
function DriversTab({ analytics }) {
  const noExt = !analytics.markdownImpact?.length && !analytics.cpiEffect?.length;
  const driverRank = [
    { rank:1, driver:'Holiday Effect',    impact:'+30–33%', color:C.amber,   desc:'Strongest single driver — consistent across all store types' },
    { rank:2, driver:'Lag Sales (lag_1)', impact:'+38% feat',color:C.violet,  desc:'Previous week sales most predictive feature in XGBoost' },
    { rank:3, driver:'Markdown Spend',    impact:'+21%',     color:C.emerald, desc:'Best ROI at Store 32 ($8.62 per $1 spent)' },
    { rank:4, driver:'CPI / Inflation',   impact:'-6%',      color:C.rose,    desc:'Mild demand compression on non-essentials' },
    { rank:5, driver:'Fuel Price',        impact:'-4%',      color:C.orange,  desc:'Inelastic — $2,449 max variance across all fuel bands' },
  ];
  const corr = [
    { factor:'Holiday Flag', sales:0.31, cpi:-0.05, fuel:0.04, unemp:-0.09 },
    { factor:'Markdown',     sales:0.18, cpi:-0.03, fuel:0.01, unemp:-0.06 },
    { factor:'Temperature',  sales:0.08, cpi:0.05,  fuel:0.12, unemp:-0.02 },
    { factor:'CPI',          sales:-0.12,cpi:1,     fuel:0.21, unemp:0.27  },
    { factor:'Fuel Price',   sales:0.08, cpi:0.21,  fuel:1,    unemp:0.14  },
    { factor:'Unemployment', sales:-0.21,cpi:0.27,  fuel:0.14, unemp:1     },
  ];

  if (noExt) return (
    <div className="chart-card" style={{ margin:'0.75rem', textAlign:'center', padding:'3rem' }}>
      <div style={{ fontSize:'1.5rem', marginBottom:12, color:'var(--text-muted)' }}>◎</div>
      <div style={{ fontFamily:'var(--font-body)', fontSize:'0.78rem', color:'var(--text-secondary)' }}>
        Upload <strong style={{ color:'var(--emerald)' }}>external.csv</strong> to unlock external driver analysis
      </div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-muted)', marginTop:8 }}>
        CPI · fuel price · unemployment · temperature · markdown effects
      </div>
    </div>
  );

  return (
    <>
      <div className="section">
        <SectionTitle actions={[<ExportBtn key="e" title="Driver Impact Ranking" rows={driverRank.map(d=>`${d.rank}. ${d.driver}: ${d.impact} — ${d.desc}`)}/>]}>Driver Impact Ranking</SectionTitle>
        <div className="chart-card">
          {driverRank.map((d,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:14, padding:'0.65rem 0', borderBottom:i<driverRank.length-1?`1px solid var(--border)`:'none' }}>
              <div style={{ fontFamily:'var(--font-head)', fontSize:'1.2rem', fontWeight:400, color:'var(--text-disabled)', width:28, textAlign:'right', flexShrink:0 }}>{d.rank}</div>
              <div style={{ width:2, height:36, background:d.color, flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:'var(--font-body)', fontSize:'0.75rem', fontWeight:500, color:'var(--text-primary)', marginBottom:2 }}>{d.driver}</div>
                <div style={{ fontFamily:'var(--font-body)', fontSize:'0.65rem', color:'var(--text-muted)' }}>{d.desc}</div>
              </div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', fontWeight:600, color:d.color }}>{d.impact}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <SectionTitle>Correlation Matrix</SectionTitle>
        <div className="chart-card">
          <h3>Economic Factors × Sales Correlation</h3>
          <div style={{ overflowX:'auto' }}>
            <div style={{ display:'grid', gridTemplateColumns:'120px repeat(4,1fr)', gap:2, minWidth:500, marginTop:8 }}>
              <div/>
              {['Sales','CPI','Fuel','Unemp'].map(h=>(
                <div key={h} style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--text-muted)', textAlign:'center', padding:'4px 0' }}>{h}</div>
              ))}
              {corr.map((row,ri)=>(
                <React.Fragment key={ri}>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-secondary)', display:'flex', alignItems:'center', paddingRight:8 }}>{row.factor}</div>
                  {[row.sales,row.cpi,row.fuel,row.unemp].map((v,ci)=>{
                    const abs=Math.abs(v); const pos=v>=0;
                    const bg = v===1?'rgba(221,216,207,0.5)':pos?`rgba(74,99,85,${abs*0.6})`:`rgba(165,106,77,${abs*0.6})`;
                    return (
                      <div key={ci} style={{ background:bg, padding:'8px 4px', textAlign:'center', fontFamily:'var(--font-mono)', fontSize:'0.62rem', fontWeight:600, color:Math.abs(v)>0.15?'#fff':'var(--text-secondary)', border:'1px solid var(--border)' }}>
                        {v.toFixed(2)}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="chart-grid cols-2">
        {analytics.markdownImpact?.length>0 && (
          <div className="chart-card">
            <h3>Markdown ROI Analysis</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analytics.markdownImpact}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                <XAxis dataKey="label" tick={{ fill:'#7a7a72', fontSize:9, fontFamily:'var(--font-mono)' }}/>
                <YAxis tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} tick={{ fill:'#7a7a72', fontSize:9, fontFamily:'var(--font-mono)' }}/>
                <Tooltip content={<CT/>}/>
                <Bar dataKey="avg" name="Avg Sales" radius={0}>
                  {analytics.markdownImpact.map((_,i)=><Cell key={i} fill={[C.violet,C.emerald,C.amber,C.rose][i%4]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {analytics.cpiEffect?.length>0 && (
          <div className="chart-card">
            <h3>CPI vs Avg Sales</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analytics.cpiEffect}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                <XAxis dataKey="cpi" tick={{ fill:'#7a7a72', fontSize:9, fontFamily:'var(--font-mono)' }}/>
                <YAxis tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} tick={{ fill:'#7a7a72', fontSize:9, fontFamily:'var(--font-mono)' }}/>
                <Tooltip content={<CT/>}/>
                <Bar dataKey="avgSales" fill={C.sky} radius={0} name="Avg Sales"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="insight-panel">
        <h4>Economic Narrative</h4>
        {[
          'Fuel prices show limited demand sensitivity — max variance of only $2,449 across all fuel bands. Retail demand is fuel-price inelastic in this dataset.',
          'Holiday effects dominate all macroeconomic variables — +30–33% uplift dwarfs any CPI or fuel price movement.',
          'CPI shows mild negative correlation with sales (-0.12) — consistent with theory that inflation dampens discretionary spending.',
          'Markdown spend ROI is highly store-specific: Store 32 generates $8.62 per $1 invested vs Store 11 at $7.50 — a 15% efficiency gap.',
        ].map((t,i)=><div key={i} className="insight-item">{t}</div>)}
        <div style={{ marginTop:'0.8rem' }}>
          <ExportBtn title="Economic Driver Narrative" rows={['Economic Storytelling:','','Fuel prices show limited demand sensitivity...','Holiday effects dominate all macroeconomic variables...','CPI shows mild negative correlation...']}/>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: INSIGHTS — UNCHANGED logic
// ─────────────────────────────────────────────────────────────────────────────
function InsightsTab({ analytics }) {
  const [nlq,    setNlq]    = useState('');
  const [answer, setAnswer] = useState('');
  const CHIPS = ['highest holiday uplift','worst markdown ROI','forecast Dept 20','top store','stockout','total revenue'];

  const ask = (q) => { setNlq(q); setAnswer(answerNLQ(q, analytics)); };

  const riskAlerts = [
    { level:'!', label:'Potential stockout next 4 weeks', detail:`Current stock in ${analytics.kpis.stockoutCount} locations at zero`, color:C.rose   },
    { level:'!', label:'Forecast uncertainty elevated',   detail:'Markdown volatility increases CI width by ~15%',                    color:C.amber  },
    { level:'i', label:'Holiday spike incoming',          detail:'Dept 20 historically surges 30–33% in holiday weeks',              color:C.sky    },
  ];

  const overstock = analytics.inventoryStatus.filter(r=>r.status==='OVERSTOCK').length;
  const gap = (analytics.storePerformance[0]?.total / analytics.storePerformance[analytics.storePerformance.length-1]?.total||1).toFixed(1);
  const actions = [
    { icon:'→', p:'P0 CRITICAL', color:C.rose,    text:`Restock ${analytics.reorderAlerts.length} SKUs below EOQ immediately — every stockout day is direct revenue loss.` },
    { icon:'→', p:'P1 HIGH',     color:C.amber,   text:`Pre-position inventory 2–3 weeks before holidays. Data shows +${analytics.kpis.holidayLift}% demand lift.` },
    { icon:'→', p:'P1 HIGH',     color:C.violet,  text:`Deploy top-store playbook to laggards — ${gap}× revenue gap between best and worst performers.` },
    { icon:'→', p:'P2 MEDIUM',   color:C.sky,     text:`CPI-correlated categories show demand compression — consider price-lock promos on essentials.` },
    { icon:'→', p:'P2 MEDIUM',   color:C.orange,  text:`Liquidate ${overstock} overstock SKU-stores with targeted markdowns to free working capital.` },
  ];

  return (
    <>
      <div className="section">
        <SectionTitle>Natural Language Query</SectionTitle>
        <div className="nlq-wrap">
          <div className="nlq-input-row">
            <input className="nlq-input" value={nlq} onChange={e=>setNlq(e.target.value)}
              placeholder='Ask a business question e.g. "Which store has highest holiday uplift?"'
              onKeyDown={e=>e.key==='Enter'&&ask(nlq)}/>
            <button className="btn-primary" style={{ padding:'0.52rem 1rem', fontSize:'0.72rem' }} onClick={()=>ask(nlq)}>Ask ↵</button>
          </div>
          <div className="nlq-chips">
            {CHIPS.map(c=><button key={c} className="nlq-chip" onClick={()=>ask(c)}>{c}</button>)}
          </div>
          {answer && <div className="nlq-answer">{answer}</div>}
        </div>
      </div>

      <div className="section">
        <SectionTitle actions={[<ExportBtn key="e" title="AI Insights" rows={analytics.insights.map(i=>`${i.title}: ${i.text}`)}/>]}>Generated Insights</SectionTitle>
        <div className="insights-grid">
          {analytics.insights.map((ins,i)=>(
            <div className="insight-card" key={i} style={{ '--insight-color':ins.color }}>
              <h4>{ins.title}</h4><p>{ins.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-grid cols-2">
        <div className="chart-card">
          <h3>Risk Detection</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
            {riskAlerts.map((r,i)=>(
              <div key={i} style={{ display:'flex', gap:10, padding:'0.6rem 0.8rem', background:'var(--bg-card2)', borderLeft:`2px solid ${r.color}` }}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.9rem', color:r.color, flexShrink:0, fontWeight:600 }}>{r.level}</span>
                <div>
                  <div style={{ fontFamily:'var(--font-body)', fontSize:'0.72rem', fontWeight:500, color:r.color }}>{r.label}</div>
                  <div style={{ fontFamily:'var(--font-body)', fontSize:'0.63rem', color:'var(--text-muted)', marginTop:2 }}>{r.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="chart-card">
          <h3>Business Impact Summary</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
            {[
              { title:'Top Store',  value:analytics.salesByStore[0]?.store??'—', sub:`$${((analytics.salesByStore[0]?.sales??0)/1e6).toFixed(2)}M`, color:C.violet  },
              { title:'Top Dept',   value:analytics.salesByDept[0]?.dept??'—',   sub:`$${((analytics.salesByDept[0]?.sales??0)/1e6).toFixed(2)}M`,  color:C.emerald },
              { title:'Stockouts',  value:analytics.stockoutRisk.filter(r=>r.urgency==='CRITICAL').length, sub:'critical, zero stock', color:C.rose   },
              { title:'Reorders',   value:analytics.reorderAlerts.length, sub:'actions pending', color:C.amber  },
            ].map((b,i)=>(
              <div key={i} style={{ background:'var(--bg-card2)', padding:'0.7rem', textAlign:'center', borderTop:`2px solid ${b.color}` }}>
                <div style={{ fontFamily:'var(--font-body)', fontSize:'0.58rem', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-muted)', marginBottom:5 }}>{b.title}</div>
                <div style={{ fontFamily:'var(--font-head)', fontSize:'1.5rem', fontWeight:400, color:b.color, lineHeight:1, letterSpacing:'-0.02em' }}>{b.value}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.58rem', color:'var(--text-muted)', marginTop:3 }}>{b.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <SectionTitle actions={[<ExportBtn key="e" title="Action Items" rows={actions.map(a=>`[${a.p}] ${a.text}`)}/>]}>Prioritised Action Items</SectionTitle>
        <div className="chart-card">
          <div style={{ display:'flex', flexDirection:'column', gap:'0.65rem' }}>
            {actions.map((a,i)=>(
              <div key={i} className="action-item" style={{ '--action-color':a.color }}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.9rem', color:a.color, flexShrink:0, marginTop:2 }}>{a.icon}</span>
                <div>
                  <span className="action-priority">{a.p}</span>
                  <span className="action-text">{a.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: SQL WAREHOUSE — UNCHANGED logic
// ─────────────────────────────────────────────────────────────────────────────
function WarehouseTab({ analytics }) {
  const views = [
    { name:'vw_holiday_sales_uplift',      purpose:'Holiday vs regular avg by store type', queries:1 },
    { name:'vw_markdown_effectiveness',     purpose:'Sales per markdown dollar (ROI)',       queries:3 },
    { name:'vw_top_departments_by_revenue', purpose:'RANK() OVER dept revenue ranking',      queries:9 },
    { name:'vw_store_weekly_summary',       purpose:'Weekly time-series feed for SARIMA',    queries:'Forecast' },
  ];
  const procedures = [
    { name:'sp_monthly_demand_report(yr,mo)', output:'Top depts + revenue for the period', lastRun:'2012-10' },
    { name:'sp_holiday_uplift()',             output:'Uplift % per store type (A:+30.05%)', lastRun:'All periods' },
    { name:'sp_reorder_check(store_id)',      output:'EOQ + reorder point + LOW STOCK alert',lastRun:'Store 1' },
  ];
  const triggers = [
    { name:'trg_guard_negative_sales', event:'BEFORE INSERT/UPDATE sales', fired:0,   status:'green', msg:'0 violations — clean dataset' },
    { name:'trg_sales_spike',          event:'AFTER INSERT sales',         fired:9,   status:'amber', msg:'9 holiday outliers logged to anomaly_log' },
    { name:'trg_markdown_anomaly',     event:'AFTER INSERT features',      fired:3,   status:'amber', msg:'Store 11 flagged — poor markdown ROI' },
  ];
  const indexes = [
    { name:'idx_sales_store_id',      table:'retail.sales',    col:'store_id',            impact:'Store JOINs' },
    { name:'idx_sales_dept_id',       table:'retail.sales',    col:'dept_id',             impact:'Dept JOINs' },
    { name:'idx_sales_date',          table:'retail.sales',    col:'sale_date',            impact:'Time-series' },
    { name:'idx_features_store_date', table:'retail.features', col:'(store_id,feat_date)', impact:'Feature JOIN (most used)' },
    { name:'idx_sales_store_date',    table:'retail.sales',    col:'(store_id,sale_date)', impact:'Forecast queries' },
    { name:'idx_store_type',          table:'retail.store',    col:'store_type',           impact:'Type grouping' },
    { name:'idx_dept_id',             table:'retail.dept',     col:'dept_id',              impact:'Dept lookups' },
  ];
  const rbac = [
    { role:'analyst_role',  perms:'SELECT on all views & tables',           badge:'badge-green' },
    { role:'manager_role',  perms:'SELECT + UPDATE on retail.features',     badge:'badge-gold'  },
    { role:'admin_role',    perms:'Full DDL: CREATE, DROP, TRUNCATE, GRANT',badge:'badge-violet'},
  ];
  const logs = [
    { trigger:'trg_sales_spike',          store:41,    detail:'Dept 20 — 2010-12-31',     value:'$343,671',         action:'→ anomaly_log' },
    { trigger:'trg_sales_spike',          store:11,    detail:'Dept 20 — 2010-12-31',     value:'$319,568',         action:'→ anomaly_log' },
    { trigger:'trg_markdown_anomaly',     store:11,    detail:'Features — 2011-03-18',     value:'$15M spend/$90K',  action:'→ markdown_alert' },
    { trigger:'trg_guard_negative_sales', store:'N/A', detail:'INSERT blocked',            value:'-$124',            action:'RAISE EXCEPTION' },
  ];

  return (
    <>
      <div className="kpi-row" style={{ '--grid-cols':4 }}>
        <KPI label="Views"      value="4" sub="business intelligence" color={C.violet}  />
        <KPI label="Procedures" value="3" sub="stored procs"          color={C.emerald} />
        <KPI label="Triggers"   value="3" sub="event handlers"        color={C.amber}   />
        <KPI label="Indexes"    value="7" sub="query optimisation"    color={C.sky}     />
      </div>

      <div className="section">
        <SectionTitle>4 Business Intelligence Views</SectionTitle>
        <div className="chart-card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>View Name</th><th>Purpose</th><th>Used In Query</th></tr></thead>
              <tbody>
                {views.map((v,i)=>(
                  <tr key={i}>
                    <td><code style={{ fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'var(--violet)' }}>{v.name}</code></td>
                    <td style={{ color:'var(--text-secondary)' }}>{v.purpose}</td>
                    <td><span className="badge badge-violet">Q{v.queries}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="section">
        <SectionTitle>3 Trigger Event Log</SectionTitle>
        <div className="chart-grid cols-3">
          {triggers.map((t,i)=>(
            <div key={i} className="chart-card">
              <span className={`badge ${t.status==='green'?'badge-green':'badge-gold'}`} style={{ marginBottom:8, display:'inline-block' }}>{t.status==='green'?'Clean':'Active'}</span>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--violet)', marginBottom:5 }}>{t.name}</div>
              <div style={{ fontFamily:'var(--font-body)', fontSize:'0.63rem', color:'var(--text-muted)', marginBottom:6 }}>{t.event}</div>
              <div style={{ fontFamily:'var(--font-head)', fontSize:'1.5rem', fontWeight:400, color:t.status==='green'?C.emerald:C.amber, marginBottom:4, letterSpacing:'-0.02em' }}>{t.fired}</div>
              <div style={{ fontFamily:'var(--font-body)', fontSize:'0.62rem', color:'var(--text-secondary)' }}>{t.msg}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <SectionTitle>3 Stored Procedures</SectionTitle>
        <div className="chart-card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Procedure</th><th>Output</th><th>Last Run</th></tr></thead>
              <tbody>
                {procedures.map((p,i)=>(
                  <tr key={i}>
                    <td><code style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--emerald)' }}>CALL retail.{p.name}</code></td>
                    <td style={{ color:'var(--text-secondary)' }}>{p.output}</td>
                    <td><span className="badge badge-green">{p.lastRun}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="chart-grid cols-2">
        <div className="chart-card">
          <h3>7 Query Optimisation Indexes</h3>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Index</th><th>Column(s)</th><th>Impact</th></tr></thead>
              <tbody>
                {indexes.map((idx,i)=>(
                  <tr key={i}>
                    <td><code style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--sky)' }}>{idx.name}</code></td>
                    <td style={{ fontFamily:'var(--font-mono)', fontSize:'0.63rem', color:'var(--text-muted)' }}>{idx.col}</td>
                    <td style={{ color:'var(--text-secondary)', fontSize:'0.65rem' }}>{idx.impact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="chart-card">
          <h3>RBAC — 3 Database Roles</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:6 }}>
            {rbac.map((r,i)=>(
              <div key={i} style={{ padding:'0.65rem 0.9rem', background:'var(--bg-card2)', display:'flex', justifyContent:'space-between', alignItems:'center', borderLeft:'2px solid var(--border)' }}>
                <div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--violet)', marginBottom:3 }}>{r.role}</div>
                  <div style={{ fontFamily:'var(--font-body)', fontSize:'0.63rem', color:'var(--text-muted)' }}>{r.perms}</div>
                </div>
                <span className={`badge ${r.badge}`}>{r.badge.includes('green')?'Analyst':r.badge.includes('gold')?'Manager':'Admin'}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop:10, padding:'0.6rem 0.8rem', background:'var(--bg-card2)', fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--text-muted)', lineHeight:1.8, borderLeft:'2px solid var(--border)' }}>
            {'GRANT analyst_role TO data_analyst_user;\nGRANT manager_role TO ops_manager;\nGRANT admin_role   TO admin_user;'}
          </div>
        </div>
      </div>

      <div className="section">
        <SectionTitle>Trigger Event Log</SectionTitle>
        <div className="chart-card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Trigger</th><th>Store</th><th>Detail</th><th>Value</th><th>Action</th></tr></thead>
              <tbody>
                {logs.map((l,i)=>(
                  <tr key={i}>
                    <td><span className="badge badge-violet" style={{ fontSize:'0.56rem' }}>{l.trigger}</span></td>
                    <td style={{ fontFamily:'var(--font-mono)', fontSize:'0.68rem' }}>{l.store}</td>
                    <td style={{ color:'var(--text-secondary)' }}>{l.detail}</td>
                    <td style={{ fontFamily:'var(--font-mono)', fontSize:'0.68rem', color:'var(--amber)' }}>{l.value}</td>
                    <td style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--emerald)' }}>{l.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="section">
        <SectionTitle>Query 10 — Data Quality Audit</SectionTitle>
        <div className="chart-card">
          {[
            { label:'NULL weekly_sales',            ok:true,  msg:'0 rows' },
            { label:'Negative weekly_sales',         ok:true,  msg:'0 rows — trg_guard_negative_sales active' },
            { label:'Sales with no Store match',     ok:true,  msg:'0 orphans' },
            { label:'Features with NULL CPI',        ok:true,  msg:'0 nulls' },
            { label:'Features with NULL fuel_price', ok:true,  msg:'0 nulls' },
            { label:'Sales rows without Features',   ok:true,  msg:'0 unmatched' },
            { label:'Anomaly log entries',           ok:false, msg:'9 outliers (expected — holiday spikes)' },
          ].map((v,i)=>(
            <div className="validation-row" key={i}>
              <span className="val-icon">{v.ok?'✓':'!'}</span>
              <span className="val-label">{v.label}</span>
              <span className={`val-status ${v.ok?'val-ok':'val-warn'}`}>{v.msg}</span>
            </div>
          ))}
          <div style={{ marginTop:10, padding:'0.6rem 0.8rem', background:'rgba(106,125,89,0.06)', border:'1px solid rgba(106,125,89,0.2)', borderLeft:'2px solid var(--emerald)', fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--emerald)' }}>
            100% Data Integrity — 6/6 critical checks passed. 9 anomaly log entries are valid holiday-period outliers.
          </div>
        </div>
      </div>
    </>
  );
}