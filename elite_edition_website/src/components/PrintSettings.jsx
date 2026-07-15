import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Settings, Plus, Trash2, Tag, ArrowRightCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import CatalogManagerModal from './CatalogManagerModal';

export default function PrintSettings() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedDepts, setExpandedDepts] = useState({
    design: true,
    digital: true,
    fusing: true,
    party: true,
    rawMaterials: true
  });

  const toggleDept = (dept) => {
    setExpandedDepts(prev => ({ ...prev, [dept]: !prev[dept] }));
  };

  // Input states
  const [newCategory, setNewCategory] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newParty, setNewParty] = useState('');
  const [newWidth, setNewWidth] = useState('');
  const [newFabric, setNewFabric] = useState('');
  const [newDesigner, setNewDesigner] = useState('');
  const [newMachine, setNewMachine] = useState('');
  const [newMachineProfiles, setNewMachineProfiles] = useState({});
  const [newBillTo, setNewBillTo] = useState('');
  const [newShipTo, setNewShipTo] = useState('');
  const [newTemperature, setNewTemperature] = useState('');
  const [newSpeed, setNewSpeed] = useState('');
  const [newPaperType, setNewPaperType] = useState('');
  const [newRawMaterial, setNewRawMaterial] = useState('');
  const [newInkColors, setNewInkColors] = useState('');
  const [isVendorManagerOpen, setIsVendorManagerOpen] = useState(false);
  const [newInkCanSizes, setNewInkCanSizes] = useState('');
  const [startingJobNo, setStartingJobNo] = useState('1');

  useEffect(() => {
    fetchConfig();
    const interval = setInterval(fetchConfig, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await api.getPrintConfig();
      setConfig(data);
      if (data && data.startingJobNo !== undefined) {
        setStartingJobNo(String(data.startingJobNo));
      }
    } catch (err) {
      console.error('Failed to fetch print config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStartingJobNo = async () => {
    if (!startingJobNo) return;
    const num = parseInt(startingJobNo, 10);
    if (isNaN(num) || num < 1) {
      alert('Please enter a valid starting Job Card number (1 or more).');
      return;
    }
    try {
      setActionLoading(true);
      const updated = await api.updatePrintConfig({ action: 'set', field: 'startingJobNo', value: num });
      setConfig(updated);
      alert('Starting Job Card Number updated successfully!');
    } catch (err) {
      console.error('Failed to update starting Job No:', err);
      alert('Failed to update starting Job Card Number.');
    } finally {
      setActionLoading(false);
    }
  };


  const handleAdd = async (field, value, setter) => {
    if (!value.trim()) return;
    try {
      setActionLoading(true);
      const updated = await api.updatePrintConfig({ action: 'add', field, value: value.trim() });
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
      const updated = await api.updatePrintConfig({ action: 'remove', field, value });
      setConfig(updated);
    } catch (err) {
      console.error(`Failed to remove ${field}:`, err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddMachineProfile = async (machineName) => {
    const val = newMachineProfiles[machineName];
    if (!val || !val.trim()) return;
    try {
      setActionLoading(true);
      const updated = await api.updatePrintConfig({ action: 'add', field: 'machine_profile', machineName, value: val.trim() });
      setConfig(updated);
      setNewMachineProfiles(prev => ({ ...prev, [machineName]: '' }));
    } catch (err) {
      console.error(`Failed to add profile to ${machineName}:`, err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMachineProfile = async (machineName, value) => {
    if (!window.confirm(`Are you sure you want to remove "${value}" from ${machineName}?`)) return;
    try {
      setActionLoading(true);
      const updated = await api.updatePrintConfig({ action: 'remove', field: 'machine_profile', machineName, value });
      setConfig(updated);
    } catch (err) {
      console.error(`Failed to remove profile from ${machineName}:`, err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !config) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-primary)' }}><RefreshCw className="spin-loader" /> Loading Settings...</div>;
  }

  const renderSection = (title, field, value, setter, list) => (
    <div style={{ flex: '1 1 calc(50% - 1rem)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '1.25rem' }}>
      <h4 style={{ color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Tag size={16} color="var(--primary)" /> {title}
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
        >
          <Plus size={16} /> Add
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
        {list?.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No items added yet.</div>
        ) : (
          list?.map(item => (
            <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
              <span style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>{item}</span>
              <button 
                onClick={() => handleRemove(field, item)}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}
                disabled={actionLoading}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderDepartmentHeader = (title, key, iconColor = 'var(--primary)') => {
    const isExpanded = expandedDepts[key];
    return (
      <div 
        onClick={() => toggleDept(key)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
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
      <div className="glass-panel" style={{ padding: '1.5rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Settings size={24} color="#a855f7" />
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>Dynamic Print Settings</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Manage the dropdown options available when creating new Job Cards.</p>
          </div>
        </div>
      </div>

      {/* Starting Job Number Setting */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', background: 'rgba(168,85,247,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h4 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>Starting Job Card Number</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>Configure the default starting number for new job cards. Auto-increment will start from this number or the highest existing number + 1.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="number"
            min="1"
            style={{ ...styles.input, width: '120px', textAlign: 'center', fontSize: '1rem', fontWeight: 'bold' }}
            value={startingJobNo}
            onChange={e => setStartingJobNo(e.target.value)}
          />
          <button
            className="btn-primary"
            onClick={handleSaveStartingJobNo}
            disabled={actionLoading || !startingJobNo || Number(startingJobNo) < 1}
          >
            Update
          </button>
        </div>
      </div>

      {/* Department: Design */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {renderDepartmentHeader('🎨 Design Settings', 'design', '#38bdf8')}
        {expandedDepts.design && (
          <div style={{ padding: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
            {renderSection('Categories', 'categories', newCategory, setNewCategory, config?.categories)}
            {renderSection('Fabrics', 'fabrics', newFabric, setNewFabric, config?.fabrics)}
            {renderSection('Passes (Quality)', 'passes', newPass, setNewPass, config?.passes)}
            {renderSection('Widths (Panna)', 'widths', newWidth, setNewWidth, config?.widths)}
            {renderSection('Designers', 'designers', newDesigner, setNewDesigner, config?.designers)}
            {renderSection('Paper Types', 'paperTypes', newPaperType, setNewPaperType, config?.paperTypes)}
            {renderSection('Raw Materials', 'rawMaterials', newRawMaterial, setNewRawMaterial, config?.rawMaterials)}
          </div>
        )}
      </div>

      {/* Department: Digital Machine */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {renderDepartmentHeader('💻 Digital Machine Settings', 'digital', '#a855f7')}
        {expandedDepts.digital && (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
              {renderSection('Machines', 'machines', newMachine, setNewMachine, config?.machines?.map(m => m.name))}
            </div>
            
            <div style={{ borderTop: '1px dashed var(--border-light)', paddingTop: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 700 }}>Machine Profiles</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                {config?.machines?.map(machine => (
                  <div key={machine.name} style={{ flex: '1 1 calc(50% - 1rem)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '1.25rem' }}>
                    <h5 style={{ color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                      <Tag size={14} color="#3b82f6" /> {machine.name} Profiles
                    </h5>
                    
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                      <input 
                        style={styles.input} 
                        value={newMachineProfiles[machine.name] || ''} 
                        onChange={e => setNewMachineProfiles(prev => ({ ...prev, [machine.name]: e.target.value }))} 
                        placeholder={`Add new profile for ${machine.name}...`}
                        onKeyDown={e => e.key === 'Enter' && handleAddMachineProfile(machine.name)}
                      />
                      <button 
                        className="btn-primary" 
                        onClick={() => handleAddMachineProfile(machine.name)}
                        disabled={actionLoading || !(newMachineProfiles[machine.name] || '').trim()}
                      >
                        <Plus size={16} /> Add
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                      {machine.profiles?.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No profiles added yet.</div>
                      ) : (
                        machine.profiles?.map(item => (
                          <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                            <span style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>{item}</span>
                            <button 
                              onClick={() => handleRemoveMachineProfile(machine.name, item)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}
                              disabled={actionLoading}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Department: Fusing Machine */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {renderDepartmentHeader('🔥 Fusing Machine Settings', 'fusing', '#f97316')}
        {expandedDepts.fusing && (
          <div style={{ padding: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
            {renderSection('Temperatures', 'temperatures', newTemperature, setNewTemperature, config?.temperatures)}
            {renderSection('Speeds', 'speeds', newSpeed, setNewSpeed, config?.speeds)}
          </div>
        )}
      </div>

      {/* Department: Raw Materials */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {renderDepartmentHeader('📦 Raw Material Settings', 'rawMaterials', '#10b981')}
        {expandedDepts.rawMaterials && (
          <div style={{ padding: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
            {renderSection('Ink Colors', 'inkColors', newInkColors, setNewInkColors, config?.inkColors)}
            {renderSection('Ink Can Sizes', 'inkCanSizes', newInkCanSizes, setNewInkCanSizes, config?.inkCanSizes)}
          </div>
        )}
            </div>

      {/* Vendors Section */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
        <button className="btn-secondary" onClick={() => setIsVendorManagerOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Settings size={16} /> Manage Vendors
        </button>
      </div>
      {/* Vendor Manager Modal */}
      {isVendorManagerOpen && <CatalogManagerModal initialTab="vendors" context="elite_print" onClose={() => setIsVendorManagerOpen(false)} />}

      {/* Department: Party Details */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {renderDepartmentHeader('🏢 Party Details', 'party', '#10b981')}
        {expandedDepts.party && (
          <div style={{ padding: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
            {renderSection('Parties (Clients)', 'parties', newParty, setNewParty, config?.parties)}
            {renderSection('Bill To', 'billToOptions', newBillTo, setNewBillTo, config?.billToOptions)}
            {renderSection('Ship To', 'shipToOptions', newShipTo, setNewShipTo, config?.shipToOptions)}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  input: {
    flex: 1,
    padding: '0.5rem 0.75rem',
    fontSize: '0.9rem',
    borderRadius: '4px',
    border: '1px solid var(--border-light)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'var(--text-primary)',
  }
};
