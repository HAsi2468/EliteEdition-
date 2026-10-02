/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - ASYNCHRONOUS EXPORT & REPORT WORKER QUEUE
 * Offloads CPU-intensive PDF/Excel rendering away from HTTP event loop,
 * returning 202 Accepted with jobId and real-time progress updates.
 * ============================================================================
 */

const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const { getRedisClient } = require('../db/redisClient');
const logger = require('../config/logger');

const JobStatus = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

class AsyncJobQueueService {
  constructor() {
    this.inMemoryJobs = new Map();
  }

  /**
   * Enqueues an asynchronous task to be processed out-of-band
   * @param {string} type - e.g. 'EXCEL_INVENTORY_EXPORT', 'PDF_CHALLAN_BATCH'
   * @param {object} payload - Input parameters for the worker
   * @param {Function} processor - Function executing the heavy workload: async (job, updateProgress) => downloadUrl
   * @returns {Promise<{ jobId: string, status: string }>}
   */
  async enqueue(type, payload, processor) {
    const jobId = uuidv4();
    const redis = getRedisClient();

    const jobData = {
      jobId,
      type,
      payload,
      status: JobStatus.QUEUED,
      progress: 0,
      downloadUrl: null,
      error: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.inMemoryJobs.set(jobId, jobData);
    try {
      await redis.set(`async_job:${jobId}`, JSON.stringify(jobData), { EX: 86400 });
    } catch (err) {
      logger.warn('Failed to save job to Redis: %s', err.message);
    }

    // Spawn out-of-band processing asynchronously without awaiting in HTTP loop
    setImmediate(async () => {
      await this._processJob(jobId, processor);
    });

    return {
      jobId,
      status: JobStatus.QUEUED,
      message: 'Job enqueued successfully for background processing',
    };
  }

  async _processJob(jobId, processor) {
    const job = await this.getJob(jobId);
    if (!job) return;

    await this._updateJob(jobId, { status: JobStatus.PROCESSING, progress: 10 });
    this._broadcastJobEvent(jobId, 'processing', { progress: 10 });

    const updateProgress = async (pct) => {
      await this._updateJob(jobId, { progress: Math.min(99, pct) });
      this._broadcastJobEvent(jobId, 'progress', { progress: pct });
    };

    try {
      const result = await processor(job, updateProgress);
      const downloadUrl = typeof result === 'string' ? result : result?.downloadUrl || `/v1/jobs/${jobId}/download`;

      await this._updateJob(jobId, {
        status: JobStatus.COMPLETED,
        progress: 100,
        downloadUrl,
        completedAt: Date.now(),
      });

      this._broadcastJobEvent(jobId, 'completed', { progress: 100, downloadUrl });
      logger.info(`[AsyncJobQueue] Job ${jobId} (${job.type}) completed successfully.`);
    } catch (error) {
      logger.error(`[AsyncJobQueue] Job ${jobId} failed: ${error.message}`, { stack: error.stack });
      await this._updateJob(jobId, {
        status: JobStatus.FAILED,
        error: error.message,
        failedAt: Date.now(),
      });
      this._broadcastJobEvent(jobId, 'failed', { error: error.message });
    }
  }

  async getJob(jobId) {
    const redis = getRedisClient();
    try {
      const raw = await redis.get(`async_job:${jobId}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return this.inMemoryJobs.get(jobId) || null;
  }

  async _updateJob(jobId, updates) {
    const current = (await this.getJob(jobId)) || {};
    const updated = {
      ...current,
      ...updates,
      updatedAt: Date.now(),
    };

    this.inMemoryJobs.set(jobId, updated);
    const redis = getRedisClient();
    try {
      await redis.set(`async_job:${jobId}`, JSON.stringify(updated), { EX: 86400 });
    } catch {}
    return updated;
  }

  _broadcastJobEvent(jobId, status, meta = {}) {
    if (typeof global.io !== 'undefined' && global.io) {
      try {
        global.io.emit(`job:${jobId}`, { jobId, status, ...meta, timestamp: Date.now() });
      } catch (e) {
        logger.warn('Socket broadcast error for job %s: %s', jobId, e.message);
      }
    }
  }
}

const asyncJobQueue = new AsyncJobQueueService();
module.exports = {
  asyncJobQueue,
  JobStatus,
};
