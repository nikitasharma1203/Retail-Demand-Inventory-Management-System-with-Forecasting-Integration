// demoData.js — Generates realistic synthetic retail data
export function generateDemoData() {
  const stores = Array.from({ length: 10 }, (_, i) => ({
    Store: i + 1,
    Type: ['A', 'B', 'C'][i % 3],
    Size: 50000 + Math.random() * 150000 | 0,
  }));

  const products = Array.from({ length: 20 }, (_, i) => ({
    Dept: i + 1,
    Product_Name: ['Electronics', 'Clothing', 'Food & Bev', 'Home Goods', 'Sporting', 'Toys', 'Books', 'Health', 'Auto', 'Garden', 'Tools', 'Jewelry', 'Cosmetics', 'Baby', 'Pets', 'Office', 'Music', 'Art', 'Travel', 'Seasonal'][i],
    Category: ['Electronics', 'Apparel', 'Grocery', 'Home', 'Sports', 'Kids', 'Books', 'Health', 'Auto', 'Outdoor'][i % 10],
    Price: 15 + Math.random() * 200 | 0,
  }));

  const holidays = ['2012-02-10', '2012-09-07', '2012-11-23', '2012-12-28',
    '2013-02-08', '2013-09-06', '2013-11-29', '2013-12-27'];

  const sales = [];
  const external = [];
  const dates = [];

  let d = new Date('2012-02-03');
  while (d <= new Date('2013-10-31')) {
    dates.push(d.toISOString().split('T')[0]);
    d = new Date(d.getTime() + 7 * 86400000);
  }

  let cpi = 211;
  let fuel = 3.2;
  let temp = 42;

  dates.forEach(date => {
    cpi += (Math.random() - 0.48) * 0.5;
    fuel += (Math.random() - 0.5) * 0.05;
    fuel = Math.max(2.5, Math.min(4.5, fuel));
    temp = 35 + 25 * Math.sin((dates.indexOf(date) / dates.length) * 2 * Math.PI) + (Math.random() - 0.5) * 10;
    const isHoliday = holidays.includes(date);

    stores.forEach(store => {
      external.push({
        Store: store.Store,
        Date: date,
        Temperature: temp.toFixed(2),
        Fuel_Price: fuel.toFixed(3),
        MarkDown1: Math.random() > 0.6 ? (Math.random() * 20).toFixed(2) : 0,
        MarkDown2: Math.random() > 0.7 ? (Math.random() * 10).toFixed(2) : 0,
        MarkDown3: Math.random() > 0.8 ? (Math.random() * 5).toFixed(2) : 0,
        CPI: cpi.toFixed(6),
        Unemployment: (7 + Math.random() * 2).toFixed(3),
        IsHoliday: isHoliday ? 'TRUE' : 'FALSE',
      });

      products.forEach(prod => {
        const base = store.Size * 0.05 + prod.Price * 80 + Math.random() * 5000;
        const holidayMult = isHoliday ? 1.15 + Math.random() * 0.2 : 1;
        const seasonal = 1 + 0.1 * Math.sin(dates.indexOf(date) / 8);
        const weekSales = base * holidayMult * seasonal * (0.85 + Math.random() * 0.3);
        sales.push({
          Store: store.Store,
          Dept: prod.Dept,
          Date: date,
          Weekly_Sales: weekSales.toFixed(2),
          IsHoliday: isHoliday ? 'TRUE' : 'FALSE',
        });
      });
    });
  });

  const inventory = stores.flatMap(store =>
    products.map(prod => {
      const qty = Math.random() > 0.05 ? (Math.random() * 200 | 0) : 0;
      return {
        Store: store.Store,
        Product_ID: prod.Dept,
        Product_Name: prod.Product_Name,
        Stock_Qty: qty,
        Reorder_Level: 20,
        Reorder_Point: 15,
      };
    })
  );

  return { sales, stores, products, inventory, external };
}
