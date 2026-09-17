const { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../config/config');
const logger = require('../config/logger');

let r2Client = null;

function getR2Client() {
  if (r2Client) return r2Client;

  const { accountId, accessKeyId, secretAccessKey } = config.r2 || {};
  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return r2Client;
}

function isR2Configured() {
  const { accountId, accessKeyId, secretAccessKey, bucketName } = config.r2 || {};
  return !!(accountId && accessKeyId && secretAccessKey && bucketName);
}

/**
 * Upload buffer or stream to Cloudflare R2
 * @param {Object} params
 * @param {Buffer} params.buffer - File buffer
 * @param {string} params.fileName - Target file name
 * @param {string} params.mimeType - MIME content type (e.g. image/jpeg)
 * @param {string} [params.folder='designs'] - Subfolder inside bucket
 * @returns {Promise<string>} Public URL of uploaded object
 */
async function uploadToR2({ buffer, fileName, mimeType, folder = 'designs' }) {
  const client = getR2Client();
  if (!client || !config.r2.bucketName) {
    throw new Error('Cloudflare R2 is not fully configured in environment variables');
  }

  const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
  const cleanFileName = fileName.replace(/^\/+/g, '');
  const key = cleanFolder ? `${cleanFolder}/${cleanFileName}` : cleanFileName;

  const command = new PutObjectCommand({
    Bucket: config.r2.bucketName,
    Key: key,
    Body: buffer,
    ContentType: mimeType || 'application/octet-stream',
  });

  await client.send(command);

  let publicBase = (config.r2.publicUrl || '').trim().replace(/\/+$/, '');
  if (!publicBase) {
    publicBase = `https://${config.r2.bucketName}.${config.r2.accountId}.r2.cloudflarestorage.com`;
  }

  const finalUrl = `${publicBase}/${key}`;
  logger.info(`[Cloudflare R2] Successfully uploaded ${key} -> ${finalUrl}`);
  return finalUrl;
}

/**
 * Generate a pre-signed URL for direct client-side upload to R2
 * @param {Object} params
 * @param {string} params.fileName
 * @param {string} params.fileType
 * @param {string} [params.folder='uploads']
 * @param {number} [params.expiresIn=120] - seconds
 */
async function getPresignedR2UploadUrl({ fileName, fileType, folder = 'uploads', expiresIn = 120 }) {
  const client = getR2Client();
  if (!client || !config.r2.bucketName) {
    throw new Error('Cloudflare R2 is not configured');
  }

  const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
  const key = cleanFolder ? `${cleanFolder}/${fileName}` : fileName;

  const command = new PutObjectCommand({
    Bucket: config.r2.bucketName,
    Key: key,
    ContentType: fileType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });

  let publicBase = (config.r2.publicUrl || '').trim().replace(/\/+$/, '');
  if (!publicBase) {
    publicBase = `https://${config.r2.bucketName}.${config.r2.accountId}.r2.cloudflarestorage.com`;
  }

  return {
    uploadUrl,
    fileUrl: `${publicBase}/${key}`,
    key,
  };
}

/**
 * List objects in R2 bucket under a given prefix/folder
 * @param {Object} params
 * @param {string} [params.folder='backups']
 */
async function listR2Objects({ folder = 'backups' } = {}) {
  const client = getR2Client();
  if (!client || !config.r2.bucketName) {
    throw new Error('Cloudflare R2 is not configured');
  }

  const prefix = folder ? `${folder.replace(/^\/+|\/+$/g, '')}/` : '';
  const command = new ListObjectsV2Command({
    Bucket: config.r2.bucketName,
    Prefix: prefix,
  });

  const response = await client.send(command);
  let publicBase = (config.r2.publicUrl || '').trim().replace(/\/+$/, '');
  if (!publicBase) {
    publicBase = `https://${config.r2.bucketName}.${config.r2.accountId}.r2.cloudflarestorage.com`;
  }

  return (response.Contents || []).map((item) => ({
    key: item.Key,
    sizeBytes: item.Size,
    lastModified: item.LastModified,
    url: `${publicBase}/${item.Key}`,
  }));
}

/**
 * Delete a single object from Cloudflare R2 by key
 * @param {string} key
 */
async function deleteR2Object(key) {
  const client = getR2Client();
  if (!client || !config.r2.bucketName || !key) return;

  const command = new DeleteObjectCommand({
    Bucket: config.r2.bucketName,
    Key: key,
  });

  await client.send(command);
  logger.info(`[Cloudflare R2] Deleted object: ${key}`);
}

/**
 * Delete all objects under a specified R2 folder (e.g. "Complaints/Digital_Print")
 * @param {string} folder
 */
async function deleteR2Folder(folder) {
  const client = getR2Client();
  if (!client || !config.r2.bucketName || !folder) return 0;

  const items = await listR2Objects({ folder });
  for (const item of items) {
    await deleteR2Object(item.key).catch(err => logger.warn(`Failed to delete ${item.key}: ${err.message}`));
  }
  return items.length;
}

module.exports = {
  isR2Configured,
  uploadToR2,
  getPresignedR2UploadUrl,
  listR2Objects,
  deleteR2Object,
  deleteR2Folder,
};


