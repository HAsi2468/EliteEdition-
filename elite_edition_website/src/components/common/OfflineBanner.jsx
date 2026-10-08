import React from 'react';
import ConnectionStatusHUD from './ConnectionStatusHUD';

/**
 * Backward compatibility wrapper for OfflineBanner.
 * Re-exports the unified, high-performance ConnectionStatusHUD.
 */
export function OfflineBanner() {
  return <ConnectionStatusHUD />;
}

export default OfflineBanner;
