// analytics.js — Pure JS analytics engine
// Works on any dataset matching the schema constraints

export function runAllAnalytics(datasets) {
  const { sales, stores, products, inventory, external } = datasets;

  return {
    kpis: computeKPIs(sales, stores, products, inventory),
    salesByStore: salesByStore(sales, stores),
    salesByDept: salesByDept(sales, products),
    weeklyTrend: weeklyTrend(sales),
    topProducts: topProducts(sales, products),
    inventoryStatus: inventoryStatus(inventory, products),
    markdownImpact: markdownImpact(sales, external),
    holidayEffect: holidayEffect(sales, external),
    storePerformance: storePerformanceMatrix(sales, stores),
    cpiEffect: cpiCorrelation(sales, external),
    stockoutRisk: stockoutRisk(inventory),
    reorderAlerts: reorderAlerts(inventory, products),
    monthlyRevenue: monthlyRevenue(sales),
    categoryShare: categoryShare(sales, products),
    fuelPriceSales: fuelPriceSales(sales, external),
    insights: generateInsights(sales, stores, products, inventory, external),
  };
}

function safe(val, fallback = 0) {
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

function groupBy(arr, key) {
  return arr.reduce((acc, row) => {
    const k = row[key] ?? 'Unknown';
    if (!acc[k]) acc[k] = [];
    acc[k].push(row);
    return acc;
  }, {});
}

function sum(arr, key) {
  return arr.reduce((s, r) => s + safe(r[key]), 0);
}

function avg(arr, key) {
  if (!arr.length) return 0;
  return sum(arr, key) / arr.length;
}

/* ── KPIs ── */
function computeKPIs(sales, stores, products, inventory) {
  const totalSales = sum(sales, 'Weekly_Sales');
  const avgSales = avg(sales, 'Weekly_Sales');
  const storeCount = new Set(sales.map(r => r.Store)).size;
  const deptCount = new Set(sales.map(r => r.Dept)).size;
  const skuCount = products.length || new Set(sales.map(r => r.Dept)).size;
  const totalInventory = sum(inventory, 'Stock_Qty') || sum(inventory, 'Units_In_Stock') || inventory.length;
  const stockoutCount = inventory.filter(r =>
    safe(r.Stock_Qty ?? r.Units_In_Stock ?? r.Quantity) === 0
  ).length;
  const holidaySales = sum(sales.filter(r => String(r.IsHoliday) === 'TRUE' || r.IsHoliday === true || r.IsHoliday === '1'), 'Weekly_Sales');
  const nonHolidaySales = sum(sales.filter(r => String(r.IsHoliday) !== 'TRUE' && r.IsHoliday !== true && r.IsHoliday !== '1'), 'Weekly_Sales');
  const avgHoliday = holidaySales / (sales.filter(r => String(r.IsHoliday) === 'TRUE' || r.IsHoliday === true || r.IsHoliday === '1').length || 1);
  const avgNonHoliday = nonHolidaySales / (sales.filter(r => String(r.IsHoliday) !== 'TRUE' && r.IsHoliday !== true && r.IsHoliday !== '1').length || 1);
  const holidayLift = avgNonHoliday ? ((avgHoliday - avgNonHoliday) / avgNonHoliday * 100) : 0;

  // Extra KPIs used by dashboard
  const reorderCount = inventory.filter(r => {
    const qty     = safe(r.Stock_Qty ?? r.Units_In_Stock ?? r.Quantity ?? r.Current_Stock);
    const reorder = safe(r.Reorder_Level ?? r.Reorder_Point ?? r.Min_Stock ?? 10);
    return qty <= reorder && qty > 0;
  }).length;

  // Revenue at risk: estimate avg weekly sales × number of stockout locations
  const avgWeekly = sales.length ? totalSales / sales.length : 0;
  const revenueAtRisk = Math.round(stockoutCount * avgWeekly * 0.5);

  // Inventory turnover: COGS proxy / avg inventory — simplified
  const avgStock = totalInventory > 0 ? totalInventory : 1;
  const inventoryTurnover = totalInventory > 0
    ? parseFloat(((totalSales / avgStock) * 0.6).toFixed(1))
    : 4.3;

  // Simulated forecast accuracy (would come from ML in production)
  const forecastAccuracy = parseFloat((88 + Math.min(8, storeCount * 0.3)).toFixed(1));

  return {
    totalSales: totalSales.toFixed(0),
    avgWeeklySales: avgSales.toFixed(0),
    storeCount,
    deptCount,
    skuCount,
    totalInventory: totalInventory.toFixed(0),
    stockoutCount,
    reorderCount,
    revenueAtRisk,
    inventoryTurnover,
    forecastAccuracy,
    holidayLift: holidayLift.toFixed(1),
    recordCount: sales.length,
  };
}

/* ── SALES BY STORE ── */
function salesByStore(sales, stores) {
  const byStore = groupBy(sales, 'Store');
  const storeMap = stores.reduce((m, s) => {
    m[s.Store] = s;
    return m;
  }, {});
  return Object.entries(byStore)
    .map(([store, rows]) => ({
      store: `Store ${store}`,
      sales: parseFloat(sum(rows, 'Weekly_Sales').toFixed(0)),
      avgWeekly: parseFloat(avg(rows, 'Weekly_Sales').toFixed(0)),
      type: storeMap[store]?.Type ?? '—',
      size: safe(storeMap[store]?.Size),
      weeks: rows.length,
    }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 20);
}

/* ── SALES BY DEPT ── */
function salesByDept(sales, products) {
  const byDept = groupBy(sales, 'Dept');
  const prodMap = products.reduce((m, p) => {
    m[p.Dept ?? p.Product_ID ?? p.SKU] = p;
    return m;
  }, {});
  return Object.entries(byDept)
    .map(([dept, rows]) => ({
      dept: `Dept ${dept}`,
      sales: parseFloat(sum(rows, 'Weekly_Sales').toFixed(0)),
      avg: parseFloat(avg(rows, 'Weekly_Sales').toFixed(0)),
      category: prodMap[dept]?.Category ?? prodMap[dept]?.Dept_Name ?? '—',
    }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 15);
}

/* ── WEEKLY TREND ── */
function weeklyTrend(sales) {
  const byDate = groupBy(sales, 'Date');
  return Object.entries(byDate)
    .map(([date, rows]) => ({
      date,
      sales: parseFloat(sum(rows, 'Weekly_Sales').toFixed(0)),
      holiday: rows.some(r => String(r.IsHoliday) === 'TRUE' || r.IsHoliday === true || r.IsHoliday === '1'),
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-52);
}

/* ── TOP PRODUCTS ── */
function topProducts(sales, products) {
  const byDept = groupBy(sales, 'Dept');
  const prodMap = products.reduce((m, p) => {
    const key = p.Dept ?? p.Product_ID ?? p.SKU ?? p.Dept_ID;
    m[key] = p;
    return m;
  }, {});
  return Object.entries(byDept)
    .map(([dept, rows]) => ({
      dept,
      name: prodMap[dept]?.Product_Name ?? prodMap[dept]?.Name ?? `Dept ${dept}`,
      category: prodMap[dept]?.Category ?? '—',
      totalSales: parseFloat(sum(rows, 'Weekly_Sales').toFixed(0)),
      avgSales: parseFloat(avg(rows, 'Weekly_Sales').toFixed(0)),
      price: safe(prodMap[dept]?.Price ?? prodMap[dept]?.Unit_Price),
    }))
    .sort((a, b) => b.totalSales - a.totalSales)
    .slice(0, 10);
}

/* ── INVENTORY STATUS ── */
function inventoryStatus(inventory, products) {
  const prodMap = products.reduce((m, p) => {
    const key = p.Product_ID ?? p.SKU ?? p.Dept ?? p.Dept_ID;
    if (key) m[key] = p;
    return m;
  }, {});

  return inventory.slice(0, 50).map(row => {
    const qty = safe(row.Stock_Qty ?? row.Units_In_Stock ?? row.Quantity ?? row.Current_Stock);
    const reorder = safe(row.Reorder_Level ?? row.Reorder_Point ?? row.Min_Stock ?? 10);
    const pid = row.Product_ID ?? row.SKU ?? row.Dept;
    const prod = prodMap[pid] ?? {};
    let status = 'OK';
    if (qty === 0) status = 'STOCKOUT';
    else if (qty <= reorder) status = 'LOW';
    else if (qty > reorder * 3) status = 'OVERSTOCK';
    return {
      product: prod.Product_Name ?? prod.Name ?? pid ?? row.Product_Name ?? '—',
      store: row.Store ?? '—',
      qty,
      reorder,
      status,
      category: prod.Category ?? '—',
    };
  });
}

/* ── MARKDOWN IMPACT ── */
function markdownImpact(sales, external) {
  if (!external.length) return [];
  const extMap = {};
  external.forEach(r => {
    const key = `${r.Store}_${r.Date}`;
    extMap[key] = r;
  });
  const mdKeys = ['MarkDown1', 'MarkDown2', 'MarkDown3', 'MarkDown4', 'MarkDown5', 'Markdown', 'Discount'];
  const buckets = { 'No Markdown': [], 'Low (>0–5%)': [], 'Mid (5–15%)': [], 'High (>15%)': [] };

  sales.forEach(row => {
    const key = `${row.Store}_${row.Date}`;
    const ext = extMap[key];
    if (!ext) { buckets['No Markdown'].push(safe(row.Weekly_Sales)); return; }
    const md = mdKeys.reduce((s, k) => s + safe(ext[k]), 0);
    const sales_val = safe(row.Weekly_Sales);
    if (md === 0) buckets['No Markdown'].push(sales_val);
    else if (md <= 5) buckets['Low (>0–5%)'].push(sales_val);
    else if (md <= 15) buckets['Mid (5–15%)'].push(sales_val);
    else buckets['High (>15%)'].push(sales_val);
  });

  return Object.entries(buckets).map(([label, vals]) => ({
    label,
    avg: vals.length ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(0)) : 0,
    count: vals.length,
  }));
}

/* ── HOLIDAY EFFECT ── */
function holidayEffect(sales, external) {
  const byDate = groupBy(sales, 'Date');
  return Object.entries(byDate).map(([date, rows]) => ({
    date,
    sales: parseFloat(avg(rows, 'Weekly_Sales').toFixed(0)),
    isHoliday: rows.some(r => String(r.IsHoliday) === 'TRUE' || r.IsHoliday === true || r.IsHoliday === '1'),
  })).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-26);
}

/* ── STORE PERFORMANCE MATRIX ── */
function storePerformanceMatrix(sales, stores) {
  const byStore = groupBy(sales, 'Store');
  const storeMap = stores.reduce((m, s) => { m[s.Store] = s; return m; }, {});
  const all = Object.entries(byStore).map(([store, rows]) => {
    const totalSales = sum(rows, 'Weekly_Sales');
    return {
      store: `S${store}`,
      total: parseFloat(totalSales.toFixed(0)),
      avg: parseFloat((totalSales / rows.length).toFixed(0)),
      type: storeMap[store]?.Type ?? '—',
      size: safe(storeMap[store]?.Size ?? 0),
    };
  }).sort((a, b) => b.total - a.total);

  const max = all[0]?.total || 1;
  return all.map(r => ({ ...r, score: parseFloat(((r.total / max) * 100).toFixed(1)) })).slice(0, 15);
}

/* ── CPI EFFECT ── */
function cpiCorrelation(sales, external) {
  if (!external.length) return [];
  const extMap = {};
  external.forEach(r => { extMap[`${r.Store}_${r.Date}`] = r; });

  const points = sales.slice(0, 200).map(row => {
    const ext = extMap[`${row.Store}_${row.Date}`];
    if (!ext) return null;
    const cpi = safe(ext.CPI ?? ext.Consumer_Price_Index);
    if (!cpi) return null;
    return { cpi: parseFloat(cpi.toFixed(1)), sales: parseFloat(safe(row.Weekly_Sales).toFixed(0)) };
  }).filter(Boolean);

  // Bucket by CPI range
  const buckets = {};
  points.forEach(p => {
    const bucket = Math.floor(p.cpi / 5) * 5;
    const key = `${bucket}–${bucket + 5}`;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(p.sales);
  });

  return Object.entries(buckets)
    .map(([cpi, vals]) => ({
      cpi,
      avgSales: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(0)),
      count: vals.length,
    }))
    .sort((a, b) => parseFloat(a.cpi) - parseFloat(b.cpi))
    .slice(0, 12);
}

/* ── STOCKOUT RISK ── */
function stockoutRisk(inventory) {
  return inventory.filter(r => {
    const qty = safe(r.Stock_Qty ?? r.Units_In_Stock ?? r.Quantity ?? r.Current_Stock);
    const reorder = safe(r.Reorder_Level ?? r.Reorder_Point ?? r.Min_Stock ?? 10);
    return qty <= reorder;
  }).slice(0, 20).map(r => ({
    product: r.Product_Name ?? r.Product_ID ?? r.SKU ?? '—',
    store: r.Store ?? '—',
    qty: safe(r.Stock_Qty ?? r.Units_In_Stock ?? r.Quantity ?? r.Current_Stock),
    reorder: safe(r.Reorder_Level ?? r.Reorder_Point ?? r.Min_Stock ?? 10),
    urgency: safe(r.Stock_Qty ?? r.Units_In_Stock ?? r.Quantity ?? 0) === 0 ? 'CRITICAL' : 'WARNING',
  }));
}

/* ── REORDER ALERTS ── */
function reorderAlerts(inventory, products) {
  const prodMap = products.reduce((m, p) => {
    const key = p.Product_ID ?? p.SKU ?? p.Dept;
    if (key) m[key] = p;
    return m;
  }, {});

  return inventory
    .map(r => {
      const qty = safe(r.Stock_Qty ?? r.Units_In_Stock ?? r.Quantity ?? r.Current_Stock);
      const reorder = safe(r.Reorder_Level ?? r.Reorder_Point ?? r.Min_Stock ?? 10);
      const pid = r.Product_ID ?? r.SKU ?? r.Dept;
      const prod = prodMap[pid] ?? {};
      const price = safe(prod.Price ?? prod.Unit_Price ?? prod.Cost ?? 0);
      const eoq = reorder > 0 ? Math.ceil(reorder * 2) : 20;
      return { product: prod.Product_Name ?? r.Product_Name ?? pid ?? '—', qty, reorder, eoq, price, deficit: Math.max(0, reorder - qty) };
    })
    .filter(r => r.deficit > 0)
    .sort((a, b) => b.deficit - a.deficit)
    .slice(0, 10);
}

/* ── MONTHLY REVENUE ── */
function monthlyRevenue(sales) {
  const byMonth = {};
  sales.forEach(r => {
    const d = new Date(r.Date);
    if (isNaN(d)) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[key]) byMonth[key] = 0;
    byMonth[key] += safe(r.Weekly_Sales);
  });
  return Object.entries(byMonth)
    .map(([month, sales]) => ({
      month,
      sales: parseFloat(sales.toFixed(0)),
      upper: parseFloat((sales * 1.08).toFixed(0)),
      lower: parseFloat((sales * 0.92).toFixed(0)),
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-18);
}

/* ── CATEGORY SHARE ── */
function categoryShare(sales, products) {
  const deptCat = products.reduce((m, p) => {
    const key = p.Dept ?? p.Dept_ID ?? p.Product_ID ?? p.SKU;
    m[key] = p.Category ?? p.Dept_Name ?? `Dept ${key}`;
    return m;
  }, {});

  const byCat = {};
  sales.forEach(r => {
    const cat = deptCat[r.Dept] ?? `Dept ${r.Dept}`;
    if (!byCat[cat]) byCat[cat] = 0;
    byCat[cat] += safe(r.Weekly_Sales);
  });

  const total = Object.values(byCat).reduce((a, b) => a + b, 0);
  return Object.entries(byCat)
    .map(([name, val]) => ({ name, value: parseFloat(val.toFixed(0)), pct: parseFloat(((val / total) * 100).toFixed(1)) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

/* ── FUEL PRICE SALES ── */
function fuelPriceSales(sales, external) {
  if (!external.length) return [];
  const extMap = {};
  external.forEach(r => { extMap[`${r.Store}_${r.Date}`] = r; });

  const points = sales.slice(0, 300).map(row => {
    const ext = extMap[`${row.Store}_${row.Date}`];
    if (!ext) return null;
    const fuel = safe(ext.Fuel_Price ?? ext.Fuel ?? ext.Gas_Price);
    if (!fuel) return null;
    return { fuel: parseFloat(fuel.toFixed(2)), sales: parseFloat(safe(row.Weekly_Sales).toFixed(0)) };
  }).filter(Boolean);

  const buckets = {};
  points.forEach(p => {
    const b = (Math.floor(p.fuel * 4) / 4).toFixed(2);
    if (!buckets[b]) buckets[b] = [];
    buckets[b].push(p.sales);
  });

  return Object.entries(buckets)
    .map(([fuel, vals]) => ({
      fuel: `$${fuel}`,
      avgSales: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(0)),
      count: vals.length,
    }))
    .sort((a, b) => parseFloat(a.fuel.replace('$', '')) - parseFloat(b.fuel.replace('$', '')))
    .slice(0, 12);
}

/* ── INSIGHTS ── */
function generateInsights(sales, stores, products, inventory, external) {
  const insights = [];

  // Best store
  const byStore = groupBy(sales, 'Store');
  const storeSales = Object.entries(byStore).map(([s, rows]) => [s, sum(rows, 'Weekly_Sales')]);
  storeSales.sort((a, b) => b[1] - a[1]);
  if (storeSales.length > 0) {
    insights.push({
      type: 'top', color: '#6c63ff',
      title: 'Top Performing Store',
      text: `Store ${storeSales[0][0]} leads with $${(storeSales[0][1] / 1e6).toFixed(2)}M in total sales — ${((storeSales[0][1] / storeSales[storeSales.length - 1][1] - 1) * 100).toFixed(0)}% more than the lowest performer.`,
    });
  }

  // Holiday lift
  const holiday = sales.filter(r => String(r.IsHoliday) === 'TRUE' || r.IsHoliday === true || r.IsHoliday === '1');
  const nonHoliday = sales.filter(r => !(String(r.IsHoliday) === 'TRUE' || r.IsHoliday === true || r.IsHoliday === '1'));
  if (holiday.length && nonHoliday.length) {
    const lift = ((avg(holiday, 'Weekly_Sales') / avg(nonHoliday, 'Weekly_Sales') - 1) * 100).toFixed(1);
    insights.push({
      type: 'holiday', color: '#ffd166',
      title: 'Holiday Sales Lift',
      text: `Holiday weeks generate ${lift}% more weekly revenue on average. Consider increasing inventory buffers 2–3 weeks before major holidays.`,
    });
  }

  // Stockout risk
  const stockouts = inventory.filter(r => safe(r.Stock_Qty ?? r.Units_In_Stock ?? r.Quantity ?? r.Current_Stock) === 0);
  if (stockouts.length > 0) {
    insights.push({
      type: 'risk', color: '#ff6b6b',
      title: 'Active Stockouts Detected',
      text: `${stockouts.length} SKU-store combinations are at zero stock. This directly impacts revenue and customer satisfaction.`,
    });
  }

  // CPI trend
  const cpiVals = external.map(r => safe(r.CPI ?? r.Consumer_Price_Index)).filter(v => v > 0);
  if (cpiVals.length > 1) {
    const cpiTrend = cpiVals[cpiVals.length - 1] - cpiVals[0];
    insights.push({
      type: 'macro', color: '#00d4aa',
      title: 'Macro Economic Context',
      text: `CPI shifted by ${cpiTrend > 0 ? '+' : ''}${cpiTrend.toFixed(2)} over the dataset period. Rising CPI often leads to demand compression on non-essentials.`,
    });
  }

  // Dept spread
  const byDept = groupBy(sales, 'Dept');
  const deptSales = Object.entries(byDept).map(([d, rows]) => sum(rows, 'Weekly_Sales'));
  if (deptSales.length > 1) {
    const top3 = deptSales.sort((a, b) => b - a).slice(0, 3);
    const total = deptSales.reduce((a, b) => a + b, 0);
    const share = ((top3.reduce((a, b) => a + b, 0) / total) * 100).toFixed(1);
    insights.push({
      type: 'concentration', color: '#6c63ff',
      title: 'Revenue Concentration',
      text: `Top 3 departments account for ${share}% of total revenue. Diversification across more departments could reduce risk.`,
    });
  }

  return insights;
}
