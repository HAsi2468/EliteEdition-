import React, { useState, useMemo, memo } from 'react';
import { Package, TrendingUp, IndianRupee, AlertTriangle, Layers, ShoppingBag, MapPin, Activity, PieChart, BarChart3 } from 'lucide-react';

function DashboardStats({ items, sales }) {
  const stats = useMemo(() => {
  // --- INVENTORY CALCULATIONS ---
  const totalUnique = items.length;
  const totalStock = items.reduce((sum, item) => sum + (item.currentlyAvailableStock || 0), 0);
  const totalQty = items.reduce((sum, item) => sum + (item.qty || 0), 0);
  
  const totalPurchaseValue = items.reduce(
    (sum, item) => sum + ((item.purchasePrice || 0) * (item.currentlyAvailableStock || 0)), 
    0
  );
  const totalSalesValue = items.reduce(
    (sum, item) => sum + ((item.salePrice || 0) * (item.currentlyAvailableStock || 0)), 
    0
  );
  
  const potentialProfit = totalSalesValue - totalPurchaseValue;
  const averageMargin = totalSalesValue > 0 
    ? Math.round((potentialProfit / totalSalesValue) * 100) 
    : 0;

  // --- SALES CALCULATIONS ---
  const totalOrders = sales.length;
  const totalRevenue = sales.reduce((sum, order) => sum + (parseFloat(order.totalPrice) || 0), 0);
  const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;
  
  const deliveredOrders = sales.filter(o => (o.saleOrderStatus || '').toUpperCase() === 'DELIVERED').length;
  const cancelledOrders = sales.filter(o => (o.saleOrderStatus || '').toUpperCase() === 'CANCELLED').length;
  const returnedOrders = sales.filter(o => (o.saleOrderStatus || '').toUpperCase() === 'RETURNED').length;

  // City-wise order volume aggregation (Top 5)
  const cityGroups = {};
  sales.forEach(order => {
    const city = order.shippingAddressCity || 'Unknown';
    cityGroups[city] = (cityGroups[city] || 0) + (parseInt(order.itemSKUCodeCount) || 1);
  });
  const topCities = Object.entries(cityGroups)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Top Stock Items (Top 5)
  const topStockItems = [...items]
    .sort((a, b) => (b.currentlyAvailableStock || 0) - (a.currentlyAvailableStock || 0))
    .slice(0, 5);

  // --- SVG GRAPH 1: SALES TREND OVER TIME ---
  const salesByDate = {};
  sales.forEach(order => {
    if (!order.orderDate) return;
    const dateObj = new Date(order.orderDate);
    const dateStr = dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    salesByDate[dateStr] = (salesByDate[dateStr] || 0) + (parseFloat(order.totalPrice) || 0);
  });

  const rawTrendData = Object.entries(salesByDate).map(([date, val]) => ({ date, val }));
  const trendData = rawTrendData
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-8);

  const svgWidth = 500;
  const svgHeight = 220;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;
  
  const graphWidth = svgWidth - paddingLeft - paddingRight;
  const graphHeight = svgHeight - paddingTop - paddingBottom;
  
  const maxRevenue = trendData.length > 0 ? Math.max(...trendData.map(d => d.val)) * 1.15 : 1000;
  
  let linePath = '';
  let areaPath = '';
  const points = [];

  if (trendData.length > 0) {
    const isSinglePoint = trendData.length === 1;
    trendData.forEach((d, idx) => {
      const x = isSinglePoint 
        ? paddingLeft + (graphWidth / 2) 
        : paddingLeft + (idx * (graphWidth / (trendData.length - 1)));
      const y = svgHeight - paddingBottom - ((d.val / maxRevenue) * graphHeight);
      points.push({ x, y, val: d.val, date: d.date });
      
      if (idx === 0) {
        linePath = `M ${x} ${y}`;
        areaPath = `M ${x} ${svgHeight - paddingBottom} L ${x} ${y}`;
      } else {
        linePath += ` L ${x} ${y}`;
        areaPath += ` L ${x} ${y}`;
      }
      
      if (idx === trendData.length - 1) {
        areaPath += ` L ${x} ${svgHeight - paddingBottom} Z`;
      }
    });
  }

  // --- SVG GRAPH 2: INVENTORY CATEGORY DONUT CHART ---
  const categoryGroups = {};
  items.forEach(item => {
    const cat = item.itemName ? item.itemName.split(' ')[0] : 'Other';
    categoryGroups[cat] = (categoryGroups[cat] || 0) + (item.currentlyAvailableStock || 0);
  });
  
  const categoryData = Object.entries(categoryGroups)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
    
  const totalCatItems = Object.values(categoryGroups).reduce((sum, val) => sum + val, 0);
  
  const donutRadius = 50;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let cumulativeOffset = 0;
  const categoryColors = ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const donutSlices = categoryData.map(([name, val], idx) => {
    const percentage = totalCatItems > 0 ? (val / totalCatItems) : 0;
    const strokeLength = percentage * donutCircumference;
    const strokeOffset = donutCircumference - strokeLength + cumulativeOffset;
    cumulativeOffset -= strokeLength;
    return {
      name, val,
      percentage: Math.round(percentage * 100),
      strokeLength, strokeOffset,
      color: categoryColors[idx] || '#6b7280'
    };
  });

  // --- SVG GRAPH 3: TOP 5 SKUS BY SALES REVENUE ---
  const skuSales = {};
  sales.forEach(order => {
    const sku = order.itemSKUCode || 'Unknown';
    skuSales[sku] = (skuSales[sku] || 0) + (parseFloat(order.totalPrice) || 0);
  });
  
  const topSKUs = Object.entries(skuSales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([sku, revenue]) => ({ sku, revenue }));
    
  const topSkusMaxRevenue = topSKUs.length > 0 ? Math.max(...topSKUs.map(s => s.revenue)) * 1.15 : 1000;

  // --- SVG GRAPH 4: MARGIN ANALYSIS (TOP 5 STOCK ITEMS) ---
  const topStockItemsData = [...items]
    .sort((a, b) => (b.currentlyAvailableStock || 0) - (a.currentlyAvailableStock || 0))
    .slice(0, 5)
    .map(item => ({
      name: item.itemName ? (item.itemName.length > 15 ? item.itemName.slice(0, 12) + '...' : item.itemName) : 'Unknown',
      sku: item.skuCode || '',
      purchasePrice: item.purchasePrice || 0,
      salePrice: item.salePrice || 0,
      stock: item.currentlyAvailableStock || 0
    }));

  const maxPrice = topStockItemsData.length > 0 
    ? Math.max(...topStockItemsData.map(d => Math.max(d.purchasePrice, d.salePrice))) * 1.15 
    : 1000;

  return {
    totalUnique, totalStock, totalQty, totalPurchaseValue, totalSalesValue, potentialProfit, averageMargin,
    totalOrders, totalRevenue, avgOrderValue, deliveredOrders, cancelledOrders, returnedOrders,
    topCities, topStockItems,
    trendData, svgWidth, svgHeight, paddingLeft, paddingRight, paddingTop, paddingBottom,
    graphWidth, graphHeight, maxRevenue, linePath, areaPath, points,
    donutRadius, donutCircumference, categoryColors, donutSlices, totalCatItems,
    topSKUs, topSkusMaxRevenue, topStockItemsData, maxPrice,
  };
  }, [items, sales]);

  const {
    totalUnique, totalStock, totalQty, totalPurchaseValue, totalSalesValue, potentialProfit, averageMargin,
    totalOrders, totalRevenue, avgOrderValue, deliveredOrders, cancelledOrders, returnedOrders,
    topCities, topStockItems,
    trendData, svgWidth, svgHeight, paddingLeft, paddingRight, paddingTop, paddingBottom,
    graphWidth, graphHeight, maxRevenue, linePath, areaPath, points,
    donutRadius, donutCircumference, categoryColors, donutSlices, totalCatItems,
    topSKUs, topSkusMaxRevenue, topStockItemsData, maxPrice,
  } = stats;

  // threshold is interactive state — kept outside useMemo
  const [threshold, setThreshold] = useState(10);
  const lowStockItems = items.filter(item => (item.currentlyAvailableStock || 0) <= threshold);

  return (
    <div style={styles.container}>
      
      {/* SECTION 1: SALES PERFORMANCE SUMMARY */}
      <div>
        <div style={styles.sectionHeader}>
          <ShoppingBag size={18} color="var(--primary)" />
          <h2 style={styles.sectionTitle}>Sales Performance</h2>
        </div>
        <div style={styles.statsGrid}>
          <div className="glass-panel" style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>Sales Revenue</span>
              <div style={{ ...styles.iconContainer, background: 'rgba(16, 185, 129, 0.1)' }}>
                <IndianRupee size={20} color="#10b981" />
              </div>
            </div>
            <div style={{ ...styles.cardValue, color: '#10b981' }}>
              Rs. {totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div style={styles.cardDesc}>Total revenue from loaded orders</div>
          </div>

          <div className="glass-panel" style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>Total Orders</span>
              <div style={{ ...styles.iconContainer, background: 'rgba(6, 182, 212, 0.1)' }}>
                <ShoppingBag size={20} color="#06b6d4" />
              </div>
            </div>
            <div style={styles.cardValue}>{totalOrders}</div>
            <div style={styles.cardDesc}>Orders synced from system</div>
          </div>

          <div className="glass-panel" style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>Avg Order Value</span>
              <div style={{ ...styles.iconContainer, background: 'rgba(245, 158, 11, 0.1)' }}>
                <TrendingUp size={20} color="#f59e0b" />
              </div>
            </div>
            <div style={styles.cardValue}>
              Rs. {avgOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div style={styles.cardDesc}>Average revenue ticket size</div>
          </div>

          <div className="glass-panel" style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>Order Statuses</span>
              <div style={{ ...styles.iconContainer, background: 'rgba(255, 255, 255, 0.05)' }}>
                <Activity size={20} color="#fff" />
              </div>
            </div>
            <div style={styles.cardValue}>
              {deliveredOrders} <span style={styles.qtyTotal}>Delivered</span>
            </div>
            <div style={styles.cardDesc}>
              Returns: {returnedOrders} | Cancelled: {cancelledOrders}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: CHARTS & VISUALIZATIONS */}
      <div className="charts-grid-class" style={styles.chartsGrid}>
        
        {/* Trend Area Chart (Line Graph) */}
        <div className="glass-panel" style={styles.chartPanel}>
          <div style={styles.chartHeader}>
            <TrendingUp size={16} color="var(--primary)" />
            <h3 style={styles.panelTitle}>Sales Revenue Trend</h3>
          </div>
          
          <div style={styles.graphContainer}>
            {trendData.length === 0 ? (
              <p style={styles.emptyText}>Not enough order history to plot trend</p>
            ) : (
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={styles.svgElement}>
                <defs>
                  {/* Glowing Area Gradient */}
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                  </linearGradient>
                  {/* Glowing Line Stroke Shadow */}
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="var(--primary)" floodOpacity="0.3" />
                  </filter>
                </defs>

                {/* Horizontal Gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const y = svgHeight - paddingBottom - (ratio * graphHeight);
                  const labelVal = ratio * maxRevenue;
                  return (
                    <g key={idx}>
                      <line 
                        x1={paddingLeft} 
                        y1={y} 
                        x2={svgWidth - paddingRight} 
                        y2={y} 
                        stroke="rgba(255, 255, 255, 0.05)" 
                        strokeWidth="1" 
                      />
                      <text 
                        x={paddingLeft - 8} 
                        y={y + 4} 
                        fill="var(--text-muted)" 
                        fontSize="8" 
                        textAnchor="end"
                      >
                        {labelVal >= 1000 ? `${(labelVal / 1000).toFixed(0)}k` : labelVal.toFixed(0)}
                      </text>
                    </g>
                  );
                })}

                {/* Shaded Area Fill */}
                <path d={areaPath} fill="url(#areaGrad)" />

                {/* Graph Line */}
                <path 
                  d={linePath} 
                  fill="none" 
                  stroke="var(--primary)" 
                  strokeWidth="3.5" 
                  strokeLinecap="round"
                  filter="url(#glow)"
                />

                {/* Data Points */}
                {points.map((p, idx) => (
                  <g key={idx} className="chart-dot-group">
                    <circle 
                      cx={p.x} 
                      cy={p.y} 
                      r="6" 
                      fill="var(--bg-main)" 
                      stroke="var(--primary)" 
                      strokeWidth="2.5" 
                    />
                    <circle 
                      cx={p.x} 
                      cy={p.y} 
                      r="12" 
                      fill="var(--primary)" 
                      fillOpacity="0.0" 
                      className="chart-hover-circle"
                    />
                    <text 
                      x={p.x} 
                      y={p.y - 12} 
                      fill="#fff" 
                      fontSize="9" 
                      fontWeight="bold"
                      textAnchor="middle"
                      className="chart-dot-label"
                    >
                      Rs.{Math.round(p.val)}
                    </text>
                  </g>
                ))}

                {/* X Axis Date Labels */}
                {points.map((p, idx) => (
                  <text 
                    key={idx} 
                    x={p.x} 
                    y={svgHeight - 10} 
                    fill="var(--text-muted)" 
                    fontSize="9" 
                    textAnchor="middle"
                  >
                    {p.date}
                  </text>
                ))}
              </svg>
            )}
          </div>
        </div>

        {/* Donut Chart: Category Breakdown */}
        <div className="glass-panel" style={styles.chartPanel}>
          <div style={styles.chartHeader}>
            <PieChart size={16} color="var(--primary)" />
            <h3 style={styles.panelTitle}>Category Breakdown</h3>
          </div>
          
          <div style={styles.donutContainer}>
            {donutSlices.length === 0 ? (
              <p style={styles.emptyText}>No inventory categories to display</p>
            ) : (
              <>
                <svg viewBox="0 0 160 160" style={styles.donutSvg}>
                  {donutSlices.map((slice, idx) => (
                    <circle
                      key={idx}
                      cx="80"
                      cy="80"
                      r={donutRadius}
                      fill="transparent"
                      stroke={slice.color}
                      strokeWidth="14"
                      strokeDasharray={donutCircumference}
                      strokeDashoffset={slice.strokeOffset}
                      strokeLinecap="round"
                      transform="rotate(-90 80 80)"
                      style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                    />
                  ))}
                  {/* Center Text */}
                  <text x="80" y="75" textAnchor="middle" fill="var(--text-muted)" fontSize="8" fontWeight="600" letterSpacing="0.05em">TOTAL</text>
                  <text x="80" y="93" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold">{totalStock}</text>
                </svg>
                
                {/* Donut Legend */}
                <div style={styles.donutLegend}>
                  {donutSlices.map((slice, idx) => (
                    <div key={idx} style={styles.legendItem}>
                      <div style={{ ...styles.legendColor, background: slice.color }}></div>
                      <span style={styles.legendName}>{slice.name}</span>
                      <span style={styles.legendPct}>{slice.percentage}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Top 5 SKUs by Sales Revenue */}
        <div className="glass-panel" style={styles.chartPanel}>
          <div style={styles.chartHeader}>
            <BarChart3 size={16} color="var(--primary)" />
            <h3 style={styles.panelTitle}>Top 5 SKUs by Revenue</h3>
          </div>
          <div style={styles.graphContainer}>
            {topSKUs.length === 0 ? (
              <p style={styles.emptyText}>No sales data available for SKU revenue chart</p>
            ) : (
              <svg viewBox="0 0 500 220" style={styles.svgElement}>
                <defs>
                  <linearGradient id="skuBarGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
                {topSKUs.map((item, idx) => {
                  const paddingLeft = 120;
                  const paddingRight = 80;
                  const paddingTop = 22;
                  const barHeight = 18;
                  const spacing = 36;
                  const y = paddingTop + (idx * spacing);
                  const maxBarWidth = 500 - paddingLeft - paddingRight;
                  const barWidth = topSkusMaxRevenue > 0 ? (item.revenue / topSkusMaxRevenue) * maxBarWidth : 0;
                  return (
                    <g key={idx} className="bar-group">
                      {/* SKU Label */}
                      <text 
                        x={paddingLeft - 10} 
                        y={y + 12} 
                        fill="var(--text-muted)" 
                        fontSize="9" 
                        fontWeight="600" 
                        textAnchor="end"
                      >
                        {item.sku}
                      </text>
                      {/* Track */}
                      <rect 
                        x={paddingLeft} 
                        y={y} 
                        width={maxBarWidth} 
                        height={barHeight} 
                        fill="rgba(255, 255, 255, 0.02)" 
                        rx="3" 
                      />
                      {/* Filled Bar */}
                      <rect 
                        x={paddingLeft} 
                        y={y} 
                        width={barWidth} 
                        height={barHeight} 
                        fill="url(#skuBarGrad)" 
                        rx="3" 
                      />
                      {/* Value label */}
                      <text 
                        x={paddingLeft + barWidth + 8} 
                        y={y + 12} 
                        fill="#fff" 
                        fontSize="9" 
                        fontWeight="bold"
                      >
                        Rs.{Math.round(item.revenue).toLocaleString('en-IN')}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        {/* Grouped Bar Chart: Margin Analysis */}
        <div className="glass-panel" style={styles.chartPanel}>
          <div style={styles.chartHeader}>
            <Layers size={16} color="var(--primary)" />
            <h3 style={styles.panelTitle}>Margin Analysis (Top 5 Stock Items)</h3>
          </div>
          <div style={styles.graphContainer}>
            {topStockItemsData.length === 0 ? (
              <p style={styles.emptyText}>No items available for margin comparison</p>
            ) : (
              <svg viewBox="0 0 500 220" style={styles.svgElement}>
                <defs>
                  <linearGradient id="purchaseBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" />
                    <stop offset="100%" stopColor="#be123c" />
                  </linearGradient>
                  <linearGradient id="saleBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#047857" />
                  </linearGradient>
                </defs>

                {/* Y Axis Gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const paddingLeft = 50;
                  const paddingRight = 20;
                  const paddingTop = 25;
                  const paddingBottom = 40;
                  const graphHeight = 220 - paddingTop - paddingBottom;
                  const y = 220 - paddingBottom - (ratio * graphHeight);
                  const labelVal = ratio * maxPrice;
                  return (
                    <g key={idx}>
                      <line 
                        x1={paddingLeft} 
                        y1={y} 
                        x2={500 - paddingRight} 
                        y2={y} 
                        stroke="rgba(255, 255, 255, 0.04)" 
                        strokeWidth="1" 
                      />
                      <text 
                        x={paddingLeft - 8} 
                        y={y + 3} 
                        fill="var(--text-muted)" 
                        fontSize="8" 
                        textAnchor="end"
                      >
                        Rs.{labelVal >= 1000 ? `${(labelVal / 1000).toFixed(0)}k` : labelVal.toFixed(0)}
                      </text>
                    </g>
                  );
                })}

                {topStockItemsData.map((d, idx) => {
                  const paddingLeft = 50;
                  const paddingRight = 20;
                  const paddingTop = 25;
                  const paddingBottom = 40;
                  const graphWidth = 500 - paddingLeft - paddingRight;
                  const graphHeight = 220 - paddingTop - paddingBottom;
                  const groupWidth = graphWidth / topStockItemsData.length;
                  const xCenter = paddingLeft + (idx * groupWidth) + (groupWidth / 2);
                  const hP = maxPrice > 0 ? (d.purchasePrice / maxPrice) * graphHeight : 0;
                  const hS = maxPrice > 0 ? (d.salePrice / maxPrice) * graphHeight : 0;
                  const yP = 220 - paddingBottom - hP;
                  const yS = 220 - paddingBottom - hS;

                  return (
                    <g className="grouped-bar-group" key={idx}>
                      {/* Purchase Bar (Red/Cost) */}
                      <rect 
                        x={xCenter - 14} 
                        y={yP} 
                        width="11" 
                        height={hP} 
                        fill="url(#purchaseBarGrad)" 
                        rx="2" 
                      />
                      {/* Sale Bar (Green/Price) */}
                      <rect 
                        x={xCenter + 3} 
                        y={yS} 
                        width="11" 
                        height={hS} 
                        fill="url(#saleBarGrad)" 
                        rx="2" 
                      />
                      {/* Hover Tooltips */}
                      <text 
                        x={xCenter - 8} 
                        y={yP - 6} 
                        fill="#fca5a5" 
                        fontSize="8" 
                        fontWeight="bold" 
                        textAnchor="middle"
                        className="grouped-bar-tooltip"
                      >
                        Rs.{Math.round(d.purchasePrice)}
                      </text>
                      <text 
                        x={xCenter + 8} 
                        y={yS - 6} 
                        fill="#a7f3d0" 
                        fontSize="8" 
                        fontWeight="bold" 
                        textAnchor="middle"
                        className="grouped-bar-tooltip"
                      >
                        Rs.{Math.round(d.salePrice)}
                      </text>

                      {/* Labels */}
                      <text 
                        x={xCenter} 
                        y={220 - paddingBottom + 16} 
                        fill="#e5e7eb" 
                        fontSize="8" 
                        fontWeight="500" 
                        textAnchor="middle"
                      >
                        {d.name}
                      </text>
                      <text 
                        x={xCenter} 
                        y={220 - paddingBottom + 26} 
                        fill="var(--text-muted)" 
                        fontSize="7" 
                        textAnchor="middle"
                      >
                        ({d.sku})
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>

      </div>

      {/* SECTION 3: BOTTOM GRID (CITIES & STOCK LIMITS) */}
      <div style={styles.mainGrid}>
        
        {/* Top Cities */}
        <div className="glass-panel" style={styles.chartPanel}>
          <div style={styles.chartHeader}>
            <MapPin size={16} color="var(--primary)" />
            <h3 style={styles.panelTitle}>Top Cities by Sales Volume</h3>
          </div>
          <div style={styles.chartContainer}>
            {topCities.length === 0 ? (
              <p style={styles.emptyText}>No sales data available for city charts</p>
            ) : (
              topCities.map(([city, count], idx) => {
                const maxOrders = topCities[0]?.[1] || 1;
                const percentage = Math.max(10, (count / maxOrders) * 100);
                return (
                  <div key={idx} style={styles.chartBarRow}>
                    <div style={styles.chartLabel}>
                      <span style={styles.itemNameText}>{city}</span>
                      <span style={styles.barValue}>{count} items</span>
                    </div>
                    <div style={styles.barWrapper}>
                      <div 
                        style={{ 
                          ...styles.barFill, 
                          width: `${percentage}%`,
                          background: `linear-gradient(90deg, #10b981 0%, #059669 100%)` 
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="glass-panel" style={styles.alertPanel}>
          <div style={styles.alertPanelHeader}>
            <div style={styles.chartHeader}>
              <AlertTriangle size={16} color="#fbbf24" />
              <h3 style={styles.panelTitle}>Low Stock Alerts</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.6rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>Threshold:</span>
                <input
                  type="number"
                  min="0"
                  value={threshold}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setThreshold(isNaN(v) ? 0 : v);
                  }}
                  style={{
                    width: '52px',
                    padding: '0.15rem 0.35rem',
                    fontSize: '0.75rem',
                    textAlign: 'center',
                    fontWeight: 700
                  }}
                />
              </div>
            </div>
            {lowStockItems.length > 0 && (
              <span className="badge badge-danger">
                {lowStockItems.length} Warnings
              </span>
            )}
          </div>
          
          <div style={styles.alertList}>
            {lowStockItems.length === 0 ? (
              <div style={styles.emptyAlert}>
                <span style={{ fontSize: '2rem' }}>✅</span>
                <p style={{ marginTop: '0.5rem', color: '#10b981', fontWeight: '500' }}>All stock levels healthy</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No items under {threshold} units available.</p>
              </div>
            ) : (
              lowStockItems.map((item, idx) => (
                <div key={item._id || idx} style={styles.alertRow}>
                  <div style={styles.alertLeft}>
                    <div style={styles.alertIcon}>
                      <AlertTriangle size={14} color="#f59e0b" />
                    </div>
                    <div>
                      <div style={styles.alertItemName}>{item.itemName}</div>
                      <div style={styles.alertMeta}>Party: {item.party} | Size: {item.size}</div>
                    </div>
                  </div>
                  <div style={styles.alertRight}>
                    <span 
                      style={
                        item.currentlyAvailableStock === 0 
                          ? styles.alertStockZero 
                          : styles.alertStockLow
                      }
                    >
                      {item.currentlyAvailableStock} Left
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default memo(DashboardStats);

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    width: '100%',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.8rem',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#e5e7eb',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1.2rem',
  },
  card: {
    padding: '1.25rem 1.5rem',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.6rem',
  },
  cardTitle: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '8px',
  },
  cardValue: {
    fontSize: '1.6rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.2rem',
  },
  qtyTotal: {
    fontSize: '0.9rem',
    fontWeight: '500',
    color: 'var(--text-muted)',
  },
  cardDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '1.5rem',
    alignItems: 'start',
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
    gap: '1.5rem',
  },
  chartPanel: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    height: '300px',
  },
  chartHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  alertPanel: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    height: '300px',
  },
  alertPanelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  panelTitle: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  chartContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
    flex: 1,
    overflowY: 'auto',
    marginTop: '0.5rem',
  },
  graphContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '0.5rem',
  },
  svgElement: {
    width: '100%',
    height: '100%',
  },
  donutContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    flex: 1,
    gap: '1.2rem',
    marginTop: '0.5rem',
  },
  donutSvg: {
    width: '135px',
    height: '135px',
    flexShrink: 0,
  },
  donutLegend: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
    flex: 1,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.78rem',
  },
  legendColor: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    marginRight: '8px',
    flexShrink: 0,
  },
  legendName: {
    color: '#d1d5db',
    fontWeight: '500',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100px',
  },
  legendPct: {
    color: 'var(--text-muted)',
    fontWeight: '600',
    marginLeft: '8px',
  },
  chartBarRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  chartLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8rem',
  },
  itemNameText: {
    color: '#e5e7eb',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '160px',
  },
  itemSizeText: {
    color: 'var(--text-muted)',
    marginLeft: '4px',
  },
  barWrapper: {
    display: 'flex',
    alignItems: 'center',
  },
  barFill: {
    height: '6px',
    borderRadius: '3px',
    transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  barValue: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--primary)',
  },
  alertList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    overflowY: 'auto',
    flex: 1,
    paddingRight: '4px',
  },
  alertRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 0.75rem',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-sm)',
  },
  alertLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  alertIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: '5px',
    background: 'rgba(245, 158, 11, 0.1)',
  },
  alertItemName: {
    fontSize: '0.8rem',
    fontWeight: '500',
    color: '#e5e7eb',
  },
  alertMeta: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
  },
  alertRight: {
    display: 'flex',
    alignItems: 'center',
  },
  alertStockLow: {
    fontSize: '0.7rem',
    fontWeight: '600',
    color: '#fbbf24',
    background: 'rgba(245, 158, 11, 0.1)',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
  },
  alertStockZero: {
    fontSize: '0.7rem',
    fontWeight: '600',
    color: '#f87171',
    background: 'rgba(239, 68, 68, 0.1)',
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
  },
  emptyAlert: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    textAlign: 'center',
    padding: '1.5rem 1rem',
  },
  emptyText: {
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
  },
};

// Inject responsive grid stylesheet
const styleEl = document.createElement('style');
styleEl.innerHTML = `
  /* Interactive dot hovering effects in Line Graph */
  .chart-dot-group {
    cursor: pointer;
  }
  .chart-dot-label {
    opacity: 0;
    transition: opacity 0.2s ease-out;
  }
  .chart-dot-group:hover .chart-dot-label {
    opacity: 1;
  }
  .chart-dot-group:hover circle:first-of-type {
    r: 8px;
    fill: var(--primary);
  }
  
  /* Hover tooltips in Margin Analysis grouped bar chart */
  .grouped-bar-tooltip {
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
  }
  .grouped-bar-group:hover .grouped-bar-tooltip {
    opacity: 1;
  }
  .grouped-bar-group {
    cursor: pointer;
  }
  .grouped-bar-group:hover rect {
    filter: brightness(1.2);
  }
  
  /* Hover effects in Top SKUs horizontal bar chart */
  .bar-group {
    cursor: pointer;
  }
  .bar-group:hover rect:last-of-type {
    filter: brightness(1.2);
  }

  @media (max-width: 1024px) {
    .charts-grid-class {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 900px) {
    div[style*="display: grid; gridTemplateColumns: 1.2fr 1fr"] {
      grid-template-columns: 1fr !important;
    }
    .donutContainer {
      flex-direction: column !important;
      gap: 1.5rem !important;
    }
  }
`;
document.head.appendChild(styleEl);
