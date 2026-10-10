import React from 'react';
import ConnectionBanner from '../ConnectionBanner';

/**
 * Backward compatibility wrapper for OfflineBanner.
 * Renders the non-intrusive ConnectionBanner.
 */
export function OfflineBanner() {
  return <ConnectionBanner />;
}

export default OfflineBanner;
