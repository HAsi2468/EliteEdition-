/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - DIRECT & CHUNKED MULTIPART UPLOADER
 * Bypasses the application server for large file uploads.
 * - Files <= 10MB: Single direct presigned upload.
 * - Files > 10MB: Slices via File.slice(5MB chunks), uploads parts concurrently
 *   with exponential retries and real-time progress calculation.
 * ============================================================================
 */

import { externalClient } from './httpClient';
import { api } from './api';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunk size (AWS S3 minimum is 5MB)
const MULTIPART_THRESHOLD = 10 * 1024 * 1024; // 10MB threshold

export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  currentPart?: number;
  totalParts?: number;
}

export interface ChunkedUploadOptions {
  folder?: string;
  onProgress?: (progress: UploadProgress) => void;
  maxChunkRetries?: number;
  concurrency?: number;
}

/**
 * Uploads a chunk with exponential backoff and jitter
 */
async function uploadPartWithRetry(
  partUploadUrl: string,
  chunk: Blob,
  partNumber: number,
  maxRetries = 3
): Promise<string> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      attempt++;
      // Must use externalClient to avoid sending first-party session/CSRF cookies to R2/S3
      const response = await externalClient.put(partUploadUrl, chunk, {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      // ETag is returned in response header (e.g. '"hash"')
      const etag = response.headers['etag'] || response.headers['ETag'];
      if (!etag) {
        throw new Error(`R2/S3 part upload did not return an ETag for part ${partNumber}`);
      }
      return etag;
    } catch (err: any) {
      if (attempt > maxRetries) {
        throw new Error(`Failed to upload chunk ${partNumber} after ${maxRetries} retries: ${err.message}`);
      }
      const delay = Math.pow(2, attempt) * 500 + Math.floor(Math.random() * 200);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(`Part ${partNumber} upload exhausted`);
}

/**
 * Main uploader handling both direct single presigned upload and chunked multipart upload
 */
export async function uploadLargeFile(
  file: File,
  options: ChunkedUploadOptions = {}
): Promise<{ fileUrl: string; key: string }> {
  const { folder = 'designs', onProgress, maxChunkRetries = 3, concurrency = 3 } = options;
  const totalBytes = file.size;

  // ─────────────────────────────────────────────────────────────────────────────
  // PATH A: Small / Standard File (<= 10MB) -> Direct Presigned URL
  // ─────────────────────────────────────────────────────────────────────────────
  if (totalBytes <= MULTIPART_THRESHOLD) {
    try {
      const presignedRes = await api.request('/upload/presign', {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          folder,
        }),
      });

      if (presignedRes?.uploadUrl) {
        await externalClient.put(presignedRes.uploadUrl, file, {
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
          onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
              onProgress({
                bytesUploaded: progressEvent.loaded,
                totalBytes: progressEvent.total,
                percentage: Math.round((progressEvent.loaded / progressEvent.total) * 100),
              });
            }
          },
        });

        if (onProgress) {
          onProgress({ bytesUploaded: totalBytes, totalBytes, percentage: 100 });
        }

        return { fileUrl: presignedRes.fileUrl, key: presignedRes.key };
      }
    } catch (directErr) {
      console.warn('[ChunkedUploader] Direct presign failed, falling back to multipart or standard:', directErr);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATH B: Large File (> 10MB) -> Client-Side Sliced S3/R2 Multipart Upload
  // ─────────────────────────────────────────────────────────────────────────────
  const initiateRes = await api.request('/upload/multipart/initiate', {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      folder,
    }),
  });

  const { uploadId, key } = initiateRes;
  const totalParts = Math.ceil(totalBytes / CHUNK_SIZE);
  const completedParts: Array<{ PartNumber: number; ETag: string }> = [];
  let uploadedBytes = 0;

  // Build task pool
  const partIndices = Array.from({ length: totalParts }, (_, i) => i + 1);

  async function worker() {
    while (partIndices.length > 0) {
      const partNumber = partIndices.shift()!;
      const start = (partNumber - 1) * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalBytes);
      const chunk = file.slice(start, end);

      // 1. Request part presigned URL from backend
      const partUrlRes = await api.request('/upload/multipart/part-url', {
        method: 'POST',
        body: JSON.stringify({ key, uploadId, partNumber }),
      });

      // 2. Upload sliced chunk directly to Cloudflare R2 / AWS S3
      const etag = await uploadPartWithRetry(
        partUrlRes.partUploadUrl,
        chunk,
        partNumber,
        maxChunkRetries
      );

      completedParts.push({ PartNumber: partNumber, ETag: etag });
      uploadedBytes += chunk.size;

      if (onProgress) {
        onProgress({
          bytesUploaded: uploadedBytes,
          totalBytes,
          percentage: Math.min(99, Math.round((uploadedBytes / totalBytes) * 100)),
          currentPart: completedParts.length,
          totalParts,
        });
      }
    }
  }

  // Run workers concurrently
  const workers = Array.from({ length: Math.min(concurrency, totalParts) }, () => worker());
  await Promise.all(workers);

  // ─────────────────────────────────────────────────────────────────────────────
  // Step 3: Complete Multipart Upload on Backend
  // ─────────────────────────────────────────────────────────────────────────────
  const completeRes = await api.request('/upload/multipart/complete', {
    method: 'POST',
    body: JSON.stringify({
      key,
      uploadId,
      parts: completedParts,
    }),
  });

  if (onProgress) {
    onProgress({
      bytesUploaded: totalBytes,
      totalBytes,
      percentage: 100,
      currentPart: totalParts,
      totalParts,
    });
  }

  return {
    fileUrl: completeRes.fileUrl,
    key: completeRes.key,
  };
}
