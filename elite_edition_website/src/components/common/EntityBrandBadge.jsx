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
  const color = company.badgeColor || company.iconColor || '#2563eb';
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 37;
  const g = parseInt(hex.substring(2, 4), 16) || 99;
  const b = parseInt(hex.substring(4, 6), 16) || 235;

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
      <span style={{ fontWeight: 800, color }}>{company.code}</span>
      <span>•</span>
      <span>{customLabel || company.name}</span>
    </div>
  );
}

export default EntityBrandBadge;
