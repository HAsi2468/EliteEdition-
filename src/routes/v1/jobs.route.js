/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - ASYNCHRONOUS JOBS & EXPORTS ROUTE
 * Handles background job polling, status queries, and asset downloads.
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const httpStatus = require('http-status').default;
const path = require('path');
const fs = require('fs');
const { asyncJobQueue } = require('../../services/asyncJobQueue.service');

// Map of in-memory or disk file paths for completed export jobs
const completedArtifacts = new Map();

/**
 * Register an artifact file path for an export job
 */
function registerJobArtifact(jobId, filePath) {
  completedArtifacts.set(jobId, filePath);
}

/**
 * GET /v1/jobs/:jobId
 * Returns current processing status, progress percentage, and download metadata
 */
router.get('/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const job = await asyncJobQueue.getJob(jobId);

  if (!job) {
    return res.status(httpStatus.NOT_FOUND).json({
      success: false,
      code: 'JOB_NOT_FOUND',
      message: `No asynchronous job found with ID ${jobId}`
    });
  }

  res.json({
    success: true,
    jobId: job.jobId,
    type: job.type,
    status: job.status,
    progress: job.progress,
    downloadUrl: job.downloadUrl,
    error: job.error,
    createdAt: job.createdAt,
    completedAt: job.completedAt
  });
});

/**
 * GET /v1/jobs/:jobId/download
 * Delivers or streams the completed export asset
 */
router.get('/:jobId/download', async (req, res) => {
  const { jobId } = req.params;
  const job = await asyncJobQueue.getJob(jobId);

  if (!job) {
    return res.status(httpStatus.NOT_FOUND).json({
      success: false,
      code: 'JOB_NOT_FOUND',
      message: 'Export job not found'
    });
  }

  if (job.status !== 'completed') {
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      code: 'JOB_NOT_COMPLETED',
      message: `Job is currently in state '${job.status}' (Progress: ${job.progress}%)`
    });
  }

  const filePath = completedArtifacts.get(jobId);
  if (filePath && fs.existsSync(filePath)) {
    return res.download(filePath);
  }

  // If downloadUrl is a direct Cloudflare R2 / S3 URL, redirect
  if (job.downloadUrl && job.downloadUrl.startsWith('http')) {
    return res.redirect(job.downloadUrl);
  }

  return res.status(httpStatus.NOT_FOUND).json({
    success: false,
    code: 'ARTIFACT_NOT_FOUND',
    message: 'The generated artifact is no longer available on the server.'
  });
});

/**
 * POST /v1/jobs/export
 * Enqueues a heavy export job and returns HTTP 202 Accepted immediately
 */
router.post('/export', async (req, res) => {
  const { type = 'DATA_EXPORT', params = {} } = req.body;

  const enqueued = await asyncJobQueue.enqueue(type, params, async (job, updateProgress) => {
    // Simulated multi-stage generation routine
    await updateProgress(25);
    await new Promise((r) => setTimeout(r, 200));
    await updateProgress(75);
    await new Promise((r) => setTimeout(r, 200));
    await updateProgress(100);

    return `/v1/jobs/${job.jobId}/download`;
  });

  res.status(httpStatus.ACCEPTED).json({
    success: true,
    code: 'JOB_ACCEPTED',
    jobId: enqueued.jobId,
    status: enqueued.status,
    message: 'Task accepted for background execution. Monitor progress at /v1/jobs/' + enqueued.jobId
  });
});

module.exports = {
  router,
  registerJobArtifact
};
