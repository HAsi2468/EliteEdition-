import React from 'react';
import { getCompanyById } from '../../config/companiesConfig';
import './EntitySwitcher.css';

/**
 * EntityBrandBadge
 * 
 * Ambient Visual Accent Badge rendering the active corporate entity.
 * Guarantees operator spatial awareness so documents and entries are never
 * misallocated between companies.
 */
export function EntityBrandBadge({ entityId, customLabel, style }) {
  const company = getCompanyById(entityId);
  const color = company.badgeColor || company.iconColor || '#0284c7';
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 2;
  const g = parseInt(hex.substring(2, 4), 16) || 132;
  const b = parseInt(hex.substring(4, 6), 16) || 199;

  const rawLabel = (customLabel || company.name || '').trim();
  // Prevent duplicate repetition like "EON • EON" or "EDP • EDP"
  const label = rawLabel.toUpperCase() === company.code.toUpperCase() ? company.name : rawLabel;

  return (
    <div 
      className="entity-brand-badge-pill"
      style={{
        '--entity-accent': color,
        '--entity-accent-rgb': `${r}, ${g}, ${b}`,
        ...style
      }}
      title={`Active Legal Entity: ${company.name} (${company.type})`}
    >
      <span className="entity-switcher-dot" />
      <span style={{ fontWeight: 800, color, letterSpacing: '0.04em' }}>{company.code}</span>
      <span style={{ opacity: 0.45 }}>•</span>
      <span style={{ fontWeight: 600 }}>{label}</span>
    </div>
  );
}

export default EntityBrandBadge;
