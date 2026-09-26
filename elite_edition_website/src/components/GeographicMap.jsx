import React, { useState } from 'react';
import { 
  Globe, 
  MapPin, 
  TrendingUp, 
  Users, 
  DollarSign, 
  ArrowUpRight, 
  Layers, 
  Building2,
  ChevronRight,
  Filter,
  Download
} from 'lucide-react';

const REGIONAL_DATA = [
  {
    id: 'surat',
    region: 'Surat & South Gujarat',
    state: 'Gujarat',
    jobCards: 1420,
    revenue: 4850000,
    clients: 185,
    growth: '+24.5%',
    share: 38,
    color: '#0284c7',
    coords: { x: 38, y: 52 },
    topClients: ['Shreeji Silk Mills', 'Vardhman Exports', 'Radhika Fashion Hub']
  },
  {
    id: 'ahmedabad',
    region: 'Ahmedabad & North Gujarat',
    state: 'Gujarat',
    jobCards: 890,
    revenue: 3120000,
    clients: 94,
    growth: '+18.2%',
    share: 24,
    color: '#38bdf8',
    coords: { x: 35, y: 46 },
    topClients: ['Arvind Mills Direct', 'Kalyan Fabtex', 'Apex Garments']
  },
  {
    id: 'mumbai',
    region: 'Mumbai Metropolitan & Pune',
    state: 'Maharashtra',
    jobCards: 650,
    revenue: 2480000,
    clients: 78,
    growth: '+15.7%',
    share: 19,
    color: '#818cf8',
    coords: { x: 41, y: 64 },
    topClients: ['Bollywood Prints', 'Westside Vendor #12', 'Zara India Hub']
  },
  {
    id: 'delhi',
    region: 'Delhi-NCR & Haryana',
    state: 'Delhi NCR',
    jobCards: 420,
    revenue: 1650000,
    clients: 52,
    growth: '+12.1%',
    share: 13,
    color: '#34d399',
    coords: { x: 46, y: 28 },
    topClients: ['Myntra Direct Logistics', 'FabIndia Supplier 4', 'Delhi Retailers Co.']
  },
  {
    id: 'tirupur',
    region: 'Tirupur & Coimbatore',
    state: 'Tamil Nadu',
    jobCards: 310,
    revenue: 1240000,
    clients: 36,
    growth: '+29.4%',
    share: 10,
    color: '#fbbf24',
    coords: { x: 50, y: 84 },
    topClients: ['South Cotton Syndicate', 'Kovai Knits', 'Premier Knitwear']
  },
  {
    id: 'jaipur',
    region: 'Jaipur & Rajasthan',
    state: 'Rajasthan',
    jobCards: 280,
    revenue: 980000,
    clients: 31,
    growth: '+8.9%',
    share: 8,
    color: '#f43f5e',
    coords: { x: 39, y: 36 },
    topClients: ['Sanganeri Block Prints', 'Royal Jaipur Fabrics', 'Pinkcity Exports']
  },
  {
    id: 'bangalore',
    region: 'Bangalore & Karnataka',
    state: 'Karnataka',
    jobCards: 240,
    revenue: 890000,
    clients: 28,
    growth: '+21.0%',
    share: 7,
    color: '#a855f7',
    coords: { x: 47, y: 78 },
    topClients: ['Urban Styles Tech', 'Silk Board Merchandising', 'Southern Brands']
  },
  {
    id: 'international',
    region: 'International Exports (UAE, US, UK)',
    state: 'Global',
    jobCards: 180,
    revenue: 1850000,
    clients: 16,
    growth: '+32.8%',
    share: 14,
    color: '#ec4899',
    coords: { x: 80, y: 35 },
    topClients: ['Dubai Fashion Importers', 'London Ethnic Apparel', 'NJ Retail Goods']
  }
];

export default function GeographicMap() {
  const [selectedRegion, setSelectedRegion] = useState(REGIONAL_DATA[0]);
  const [filterType, setFilterType] = useState('all');

  const totalRevenue = REGIONAL_DATA.reduce((acc, r) => acc + r.revenue, 0);
  const totalJobCards = REGIONAL_DATA.reduce((acc, r) => acc + r.jobCards, 0);
  const totalClients = REGIONAL_DATA.reduce((acc, r) => acc + r.clients, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-main)', color: 'var(--text-primary)', overflowY: 'auto', padding: '1.5rem', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid var(--border-light)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(14,165,233,0.3)'
          }}>
            <Globe size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>Geographic Revenue & Territory Map</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Geographical distribution of orders, job cards, client hubs, and revenue breakdown
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Live Production Territory Analysis</span>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem'
      }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 12, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Geo Revenue</span>
            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
              +21.4% <ArrowUpRight size={14} />
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            ₹{(totalRevenue / 100000).toFixed(2)} Lakhs
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Across 8 major manufacturing & retail zones
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 12, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Job Cards</span>
            <span style={{ color: '#0284c7', display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
              +16.8% <ArrowUpRight size={14} />
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {totalJobCards.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Currently in design, print, or stitching stages
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 12, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Client Accounts</span>
            <span style={{ color: '#8b5cf6', display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
              {totalClients} Brands
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {totalClients} Active
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Top region accounts for 38% total share
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 12, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Top Performing Hub</span>
            <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 800, background: 'rgba(2,132,199,0.15)', color: '#0284c7' }}>
              DOMINANT
            </span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            Surat & South Guj.
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            ₹48.5L revenue • 1,420 job cards
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Vector Map + Regional Detail Card */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
        gap: '1.5rem',
        alignItems: 'stretch'
      }}>
        {/* Interactive Map Visual */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: 14,
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Territory Revenue Distribution</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click pin to inspect zone</span>
          </div>

          {/* SVG Map Canvas */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: 380,
            background: 'var(--bg-input)',
            borderRadius: 12,
            border: '1px solid var(--border-light)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* Grid overlay */}
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.15 }}>
              <defs>
                <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                  <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="0.8" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Simulated Region Poly outlines */}
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {/* Decorative geography contour paths */}
              <path
                d="M 40,20 Q 55,22 52,35 T 56,50 T 52,70 T 48,88 T 46,92 Q 44,82 42,70 T 36,54 T 34,40 Z"
                fill="rgba(56, 189, 248, 0.08)"
                stroke="var(--border-light)"
                strokeWidth="0.8"
                strokeDasharray="2,2"
              />
              <path
                d="M 52,35 Q 65,34 72,42 T 62,54 T 56,50 Z"
                fill="rgba(129, 140, 248, 0.06)"
                stroke="var(--border-light)"
                strokeWidth="0.8"
              />
            </svg>

            {/* Interactive Region Pins */}
            {REGIONAL_DATA.map((reg) => {
              const isSelected = selectedRegion.id === reg.id;
              return (
                <div
                  key={reg.id}
                  onClick={() => setSelectedRegion(reg)}
                  style={{
                    position: 'absolute',
                    left: `${reg.coords.x}%`,
                    top: `${reg.coords.y}%`,
                    transform: 'translate(-50%, -50%)',
                    cursor: 'pointer',
                    zIndex: isSelected ? 10 : 2,
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  <div style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}>
                    {/* Pulsing ring */}
                    <div style={{
                      position: 'absolute',
                      width: isSelected ? 34 : 22,
                      height: isSelected ? 34 : 22,
                      borderRadius: '50%',
                      background: reg.color,
                      opacity: isSelected ? 0.35 : 0.2,
                      animation: 'pulse 2s infinite'
                    }} />

                    {/* Pin Head */}
                    <div style={{
                      width: isSelected ? 26 : 18,
                      height: isSelected ? 26 : 18,
                      borderRadius: '50%',
                      background: reg.color,
                      border: '2.5px solid #ffffff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '0.65rem',
                      fontWeight: 900
                    }}>
                      {isSelected ? '★' : ''}
                    </div>

                    {/* Label Tag */}
                    <div style={{
                      marginTop: 4,
                      background: 'var(--bg-modal)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 6,
                      padding: '2px 6px',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      color: isSelected ? reg.color : 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                    }}>
                      {reg.region.split('&')[0]} • ₹{(reg.revenue / 100000).toFixed(1)}L
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)' }}>Top Zones:</span>
            {REGIONAL_DATA.slice(0, 5).map(r => (
              <div
                key={r.id}
                onClick={() => setSelectedRegion(r)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  fontWeight: selectedRegion.id === r.id ? 800 : 500,
                  color: selectedRegion.id === r.id ? r.color : 'var(--text-muted)'
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }} />
                <span>{r.region.split(' ')[0]} ({r.share}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Region Detailed Panel */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: 14,
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: selectedRegion.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {selectedRegion.state} Hub
              </span>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, marginTop: 2 }}>{selectedRegion.region}</h3>
            </div>
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 800,
              padding: '3px 9px',
              borderRadius: 999,
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981'
            }}>
              {selectedRegion.growth}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ background: 'var(--bg-input)', padding: '0.85rem', borderRadius: 10, border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>Revenue Contribution</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: 2 }}>
                ₹{(selectedRegion.revenue / 100000).toFixed(2)}L
              </div>
              <div style={{ fontSize: '0.68rem', color: selectedRegion.color, fontWeight: 700 }}>
                {selectedRegion.share}% of ERP volume
              </div>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '0.85rem', borderRadius: 10, border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>Job Cards Produced</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: 2 }}>
                {selectedRegion.jobCards.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Avg ₹{Math.round(selectedRegion.revenue / selectedRegion.jobCards).toLocaleString()} / card
              </div>
            </div>
          </div>

          {/* Share bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: 4 }}>
              <span>National Production Share</span>
              <span>{selectedRegion.share}%</span>
            </div>
            <div style={{ width: '100%', height: 8, background: 'var(--bg-input)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${selectedRegion.share}%`, height: '100%', background: selectedRegion.color, borderRadius: 999 }} />
            </div>
          </div>

          {/* Top Key Accounts */}
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Major Key Accounts in this Zone
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {selectedRegion.topClients.map((client, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.55rem 0.75rem',
                  borderRadius: 8,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-light)',
                  fontSize: '0.82rem',
                  fontWeight: 700
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Building2 size={15} style={{ color: selectedRegion.color }} />
                    <span>{client}</span>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Regional Table */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Complete Territory Breakdown</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sorted by revenue volume</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.75rem 1.25rem' }}>Territory / Region</th>
                <th style={{ padding: '0.75rem 1rem' }}>State</th>
                <th style={{ padding: '0.75rem 1rem' }}>Active Job Cards</th>
                <th style={{ padding: '0.75rem 1rem' }}>Revenue (₹)</th>
                <th style={{ padding: '0.75rem 1rem' }}>Market Share</th>
                <th style={{ padding: '0.75rem 1rem' }}>Growth</th>
                <th style={{ padding: '0.75rem 1.25rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {REGIONAL_DATA.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedRegion(row)}
                  style={{
                    borderBottom: '1px solid var(--border-light)',
                    background: selectedRegion.id === row.id ? 'var(--nav-active-bg)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <td style={{ padding: '0.75rem 1.25rem', fontWeight: 700 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: row.color }} />
                      <span>{row.region}</span>
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{row.state}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{row.jobCards.toLocaleString()}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    ₹{(row.revenue).toLocaleString()}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: 60, height: 6, background: 'var(--bg-input)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${row.share * 2}%`, height: '100%', background: row.color }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{row.share}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#10b981' }}>{row.growth}</td>
                  <td style={{ padding: '0.75rem 1.25rem' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedRegion(row); }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border-light)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
