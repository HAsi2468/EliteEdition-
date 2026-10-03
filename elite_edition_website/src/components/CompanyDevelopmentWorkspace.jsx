import React, { useState } from 'react';
import { Building, Receipt, Settings, Sparkles, Layers, ShieldCheck, Plus, ArrowRight } from 'lucide-react';
import EliteBillingDepartment from './EliteBillingDepartment';
import CompanySettingsPanel from './CompanySettingsPanel';

export default function CompanyDevelopmentWorkspace({ companyEntity = 'Elite Edition', activeTab = 'invoices', onTabChange }) {
  const [subTab, setSubTab] = useState(activeTab === 'settings' ? 'settings' : 'invoices');

  const isEdition = companyEntity === 'Elite Edition';
  const themeColor = isEdition ? '#8b5cf6' : '#10b981';
  const prefix = isEdition ? 'EE-2627-' : 'EF-2627-';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 70px)' }}>
      {/* Top Header Banner for Company */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem 1.75rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          borderLeft: `5px solid ${themeColor}`,
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(30, 41, 59, 0.4) 100%)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: `linear-gradient(135deg, ${themeColor} 0%, #4c1d95 100%)`,
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              boxShadow: `0 4px 14px ${themeColor}40`
            }}
          >
            <Building size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {companyEntity}
              </h2>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: `${themeColor}20`,
                  color: themeColor,
                  border: `1px solid ${themeColor}40`
                }}
              >
                OFFICIAL COMPANY
              </span>
            </div>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Isolated database scope • Invoice sequence: <strong>{prefix}0001</strong>
            </p>
          </div>
        </div>

        {/* Company Quick Sub-Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.25)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
          <button
            onClick={() => { setSubTab('invoices'); if (onTabChange) onTabChange(isEdition ? 'ee_invoices' : 'ef_invoices'); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: subTab === 'invoices' ? themeColor : 'transparent',
              color: subTab === 'invoices' ? '#ffffff' : 'var(--text-muted)',
              transition: 'all 0.2s ease'
            }}
          >
            <Receipt size={15} /> Invoice Screen
          </button>

          <button
            onClick={() => { setSubTab('settings'); if (onTabChange) onTabChange(isEdition ? 'ee_settings' : 'ef_settings'); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: subTab === 'settings' ? themeColor : 'transparent',
              color: subTab === 'settings' ? '#ffffff' : 'var(--text-muted)',
              transition: 'all 0.2s ease'
            }}
          >
            <Settings size={15} /> Company Settings
          </button>
        </div>
      </div>

      {/* Main Sub-Screen Content */}
      <div style={{ flex: 1 }}>
        {subTab === 'invoices' && (
          <EliteBillingDepartment companyEntity={companyEntity} />
        )}

        {subTab === 'settings' && (
          <CompanySettingsPanel companyEntity={companyEntity} />
        )}
      </div>
    </div>
  );
}
