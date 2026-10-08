import React, { useState, useRef, useEffect } from 'react';
import { 
  Building, 
  ChevronDown, 
  Check, 
  Store, 
  Printer, 
  Scissors, 
  Layers 
} from 'lucide-react';
import { COMPANIES, getCompanyById } from '../../config/companiesConfig';
import './EntitySwitcher.css';

/**
 * EntitySwitcher
 * 
 * Global Enterprise Corporate Entity Switcher Component.
 * Dynamically switches active business workspace and binds distinct brand visual accents.
 */
export function EntitySwitcher({ 
  activeEntityId, 
  onSelectEntity,
  allowedCompanies,
  compact = false 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const activeCompany = getCompanyById(activeEntityId);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut (Alt + E) to toggle entity switcher
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getEntityIcon = (iconName) => {
    switch (iconName) {
      case 'Store': return <Store size={15} />;
      case 'Printer': return <Printer size={15} />;
      case 'Scissors': return <Scissors size={15} />;
      case 'Layers': return <Layers size={15} />;
      default: return <Building size={15} />;
    }
  };

  const filteredCompanies = COMPANIES.filter(c => {
    if (!allowedCompanies || allowedCompanies.length === 0) return true;
    return allowedCompanies.includes(c.id) || allowedCompanies.includes(c.name);
  });

  return (
    <div className="entity-switcher-wrap" ref={containerRef}>
      <button
        type="button"
        className="entity-switcher-trigger"
        onClick={() => setIsOpen(prev => !prev)}
        title="Switch Legal Entity (Alt+E)"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className="entity-switcher-dot" />
        <span className="entity-switcher-code">{activeCompany.code}</span>
        {!compact && (
          <span className="entity-switcher-name">{activeCompany.name}</span>
        )}
        <ChevronDown size={14} color="#64748b" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </button>

      {isOpen && (
        <div className="entity-switcher-dropdown" role="menu">
          <div className="entity-dropdown-header">
            <div className="entity-dropdown-title">
              <span>Legal Entity Workspace</span>
              <span className="entity-dropdown-shortcut">Alt+E</span>
            </div>
          </div>

          {filteredCompanies.map(company => {
            const isActive = company.id === activeCompany.id;
            const hex = (company.badgeColor || '#2563eb').replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16) || 37;
            const g = parseInt(hex.substring(2, 4), 16) || 99;
            const b = parseInt(hex.substring(4, 6), 16) || 235;

            return (
              <button
                key={company.id}
                type="button"
                className={`entity-option-btn ${isActive ? 'active' : ''}`}
                style={{
                  '--active-entity-color': company.badgeColor,
                  '--active-entity-rgb': `${r}, ${g}, ${b}`
                }}
                onClick={() => {
                  onSelectEntity(company.id);
                  setIsOpen(false);
                }}
                role="menuitem"
              >
                <div className="entity-option-left">
                  <div 
                    className="entity-option-icon" 
                    style={{ background: company.gradient || company.badgeColor }}
                  >
                    {getEntityIcon(company.iconName)}
                  </div>
                  <div className="entity-option-info">
                    <span className="entity-option-name">{company.name}</span>
                    <span className="entity-option-type">{company.type}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span 
                    className="entity-option-badge"
                    style={{ 
                      background: `rgba(${r}, ${g}, ${b}, 0.12)`,
                      color: company.badgeColor 
                    }}
                  >
                    {company.code}
                  </span>
                  {isActive && <Check size={14} color={company.badgeColor} />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default EntitySwitcher;
