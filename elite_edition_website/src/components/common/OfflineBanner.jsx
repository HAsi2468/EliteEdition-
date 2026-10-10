import React from 'react';
import ConnectionStatusBanner from './ConnectionStatusBanner';

/**
 * Backward compatibility wrapper for OfflineBanner.
 * Exports the production-grade ConnectionStatusBanner.
 */
export function OfflineBanner() {
  return <ConnectionStatusBanner />;
}

export default OfflineBanner;
