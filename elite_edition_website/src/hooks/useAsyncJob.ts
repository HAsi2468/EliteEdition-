/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - ASYNCHRONOUS EXPORT & REPORT TRACKING HOOK
 * Listens to background job progress via WebSocket or interval polling,
 * surfacing real-time percentages and final asset download links.
 * ============================================================================
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';

export interface AsyncJobState {
  jobId: string | null;
  status: 'idle' | 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  downloadUrl: string | null;
  error: string | null;
}

export function useAsyncJob() {
  const [jobState, setJobState] = useState<AsyncJobState>({
    jobId: null,
    status: 'idle',
    progress: 0,
    downloadUrl: null,
    error: null,
  });

  const pollIntervalRef = useRef<any>(null);
  const activeJobIdRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async (jobId: string) => {
    try {
      const response = await api.getJobStatus(jobId);
      if (!response) return;

      setJobState({
        jobId,
        status: response.status || 'processing',
        progress: response.progress || 0,
        downloadUrl: response.downloadUrl || null,
        error: response.error || null,
      });

      if (response.status === 'completed' || response.status === 'failed') {
        cleanup();
      }
    } catch (err: any) {
      console.warn('[useAsyncJob] Polling error:', err);
    }
  }, [cleanup]);

  const triggerExport = useCallback(
    async (type: string, params: Record<string, any> = {}) => {
      cleanup();
      setJobState({
        jobId: null,
        status: 'queued',
        progress: 5,
        downloadUrl: null,
        error: null,
      });

      try {
        const result = await api.triggerAsyncExport(type, params);
        const jobId = result.jobId;
        activeJobIdRef.current = jobId;

        setJobState((prev) => ({
          ...prev,
          jobId,
          status: 'queued',
          progress: 10,
        }));

        // Listen via WebSocket if available
        if (typeof window !== 'undefined') {
          const socketListener = (event: any) => {
            const data = event.detail;
            if (data?.jobId === jobId) {
              setJobState((prev) => ({
                ...prev,
                status: data.status,
                progress: data.progress || prev.progress,
                downloadUrl: data.downloadUrl || prev.downloadUrl,
                error: data.error || null,
              }));
              if (data.status === 'completed' || data.status === 'failed') {
                cleanup();
                window.removeEventListener(`job:${jobId}`, socketListener);
              }
            }
          };
          window.addEventListener(`job:${jobId}`, socketListener);
        }

        // Start fallback polling every 2 seconds
        pollIntervalRef.current = setInterval(() => {
          pollStatus(jobId);
        }, 2000);

        return jobId;
      } catch (err: any) {
        setJobState({
          jobId: null,
          status: 'failed',
          progress: 0,
          downloadUrl: null,
          error: err.message || 'Failed to start export job',
        });
        throw err;
      }
    },
    [cleanup, pollStatus]
  );

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    ...jobState,
    triggerExport,
    reset: () => {
      cleanup();
      setJobState({
        jobId: null,
        status: 'idle',
        progress: 0,
        downloadUrl: null,
        error: null,
      });
    },
  };
}
