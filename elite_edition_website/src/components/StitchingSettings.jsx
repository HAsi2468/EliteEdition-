import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Settings, Plus, Trash2, Tag, RefreshCw, Scissors, ChevronDown, ChevronUp, Layers, Package, Truck, FileText } from 'lucide-react';
import CatalogManagerModal from './CatalogManagerModal';

export default function StitchingSettings() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isVendorManagerOpen, setIsVendorManagerOpen] = useState(false);

  // Expanded card sections state
  const [expandedSections, setExpandedSections] = useState({
    garment: true,
    finishing: true,
    party: true
  });

  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Form input states
  const [newCategory, setNewCategory] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newFinishingOption, setNewFinishingOption] = useState('');
  const [newParty, setNewParty] = useState('');
  const [newBillTo, setNewBillTo] = useState('');
  const [newShipTo, setNewShipTo] = useState('');
  const [newDeliveryBy, setNewDeliveryBy] = useState('');

  useEffect(() => {
    fetchConfig();
    const interval = setInterval(fetchConfig, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await api.getStitchingConfig();
      setConfig(data);
    } catch (err) {
      console.error('Failed to fetch Stitching config from stitching_configs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (field, value, setter) => {
    if (!value.trim()) return;
    try {
      setActionLoading(true);
      const updated = await api.updateStitchingConfig({ action: 'add', field, value: value.trim() });
      setConfig(updated);
      setter(''); // clear input
    } catch (err) {
      console.error(`Failed to add ${field}:`, err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemove = async (field, value) => {
    if (!window.confirm(`Are you sure you want to remove "${value}" from ${field}?`)) return;
    try {
      setActionLoading(true);
      const updated = await api.updateStitchingConfig({ action: 'remove', field, value });
      setConfig(updated);
    } catch (err) {
      console.error(`Failed to remove ${field}:`, err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !config) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-primary)' }}>
        <RefreshCw className="spin-loader" size={24} style={{ marginBottom: '0.5rem', color: 'var(--primary)' }} />
        <div>Loading Elite Stitching Settings (stitching_configs table)...</div>
      </div>
    );
  }

  const renderSection = (title, field, value, setter, list = [], icon = <Tag size={16} color="var(--primary)" />) => (
    <div style={{ flex: '1 1 calc(50% - 1rem)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '1.25rem' }}>
      <h4 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
        {icon} {title}
      </h4>
      
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input 
          style={styles.input} 
          value={value} 
          onChange={e => setter(e.target.value)} 
          placeholder={`Add new ${title.toLowerCase()}...`}
          onKeyDown={e => e.key === 'Enter' && handleAdd(field, value, setter)}
        />
        <button 
          className="btn-primary" 
          onClick={() => handleAdd(field, value, setter)}
          disabled={actionLoading || !value.trim()}
          style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}
        >
          <Plus size={16} /> Add
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto' }}>
        {!list || list.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.5rem' }}>No options added yet. Type above and click Add!</div>
        ) : (
          list.map(item => (
            <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.25)', padding: '0.55rem 0.85rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600 }}>{item}</span>
              <button 
                onClick={() => handleRemove(field, item)}
                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center' }}
                disabled={actionLoading}
                title="Remove item"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderSectionHeader = (title, key, iconColor = '#7c3aed') => {
    const isExpanded = expandedSections[key];
    return (
      <div 
        onClick={() => toggleSection(key)}
        style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 1.5rem',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: isExpanded ? '1px solid var(--border-light)' : 'none',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'all 0.2s',
          borderTopLeftRadius: 'var(--radius-lg)',
          borderTopRightRadius: 'var(--radius-lg)',
          borderBottomLeftRadius: isExpanded ? 0 : 'var(--radius-lg)',
          borderBottomRightRadius: isExpanded ? 0 : 'var(--radius-lg)',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
      >
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Settings size={18} color={iconColor} /> {title}
        </h3>
        <div>
          {isExpanded ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Banner */}
      <div className="glass-panel" style={{ padding: '1.5rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #7c3aed, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Scissors size={22} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>Elite Stitching Settings (`stitching_configs` Table)</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Configure dynamic dropdown options for Garment Categories, Brand Labels, Finishing Types, Parties & Delivery Methods stored in a dedicated database table.
              </p>
            </div>
          </div>
          <button onClick={fetchConfig} className="btn-icon" title="Refresh Settings">
            <RefreshCw size={16} className={actionLoading ? 'spin-loader' : ''} />
          </button>
        </div>
      </div>

      {/* Section 1: Garment & Product Master Settings */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {renderSectionHeader('👗 Garment & Design Master Dropdowns', 'garment', '#a78bfa')}
        {expandedSections.garment && (
          <div style={{ padding: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
            {renderSection(
              'Stitching Categories',
              'categories',
              newCategory,
              setNewCategory,
              config?.categories,
              <Layers size={16} color="#a78bfa" />
            )}
            {renderSection(
              'Brand / Package Labels',
              'labels',
              newLabel,
              setNewLabel,
              config?.labels,
              <Tag size={16} color="#38bdf8" />
            )}
          </div>
        )}
      </div>

      {/* Section 2: Stitching Finishing & Packaging Dropdowns */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {renderSectionHeader('✨ Finishing & Packaging Dropdowns', 'finishing', '#34d399')}
        {expandedSections.finishing && (
          <div style={{ padding: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
            {renderSection(
              'Finishing Types & Packaging Options',
              'finishingOptions',
              newFinishingOption,
              setNewFinishingOption,
              config?.finishingOptions,
              <Package size={16} color="#34d399" />
            )}
          </div>
        )}
      </div>

      {/* Section 3: Stitching Party, Billing & Delivery Dropdowns */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {renderSectionHeader('🏢 Party, Delivery & Challan Dropdowns', 'party', '#fbbf24')}
        {expandedSections.party && (
          <div style={{ padding: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
            {renderSection(
              'Parties & Client Names',
              'parties',
              newParty,
              setNewParty,
              config?.parties,
              <Tag size={16} color="#fbbf24" />
            )}
            {renderSection(
              'Delivery By Options',
              'deliveryOptions',
              newDeliveryBy,
              setNewDeliveryBy,
              config?.deliveryOptions,
              <Truck size={16} color="#f43f5e" />
            )}
            {renderSection(
              'Bill To Options',
              'billToOptions',
              newBillTo,
              setNewBillTo,
              config?.billToOptions,
              <FileText size={16} color="#a855f7" />
            )}
            {renderSection(
              'Ship To Options',
              'shipToOptions',
              newShipTo,
              setNewShipTo,
              config?.shipToOptions,
              <Package size={16} color="#38bdf8" />
            )}
          </div>
        )}
      </div>

      {/* Vendors Quick Access */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)' }}>
        <div>
          <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 700 }}>Vendor & Contractor Directory</h4>
          <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>Manage vendor contacts, stitching job contractors, and party billing accounts.</p>
        </div>
        <button className="btn-secondary" onClick={() => setIsVendorManagerOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Settings size={15} /> Manage Vendors
        </button>
      </div>

      {isVendorManagerOpen && <CatalogManagerModal initialTab="vendors" context="stitching" onClose={() => setIsVendorManagerOpen(false)} />}
    </div>
  );
}

const styles = {
  input: {
    flex: 1,
    padding: '0.55rem 0.85rem',
    fontSize: '0.88rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-light)',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    outline: 'none'
  }
};
