const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const config = require('../config/config');
const logger = require('../config/logger');

let s3Client = null;

function getS3Client() {
  if (s3Client) return s3Client;

  const { region, accessKeyId, secretAccessKey } = config.aws || {};
  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  s3Client = new S3Client({
    region: region || 'ap-south-1',
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return s3Client;
}

function isS3Configured() {
  const { accessKeyId, secretAccessKey, bucketName } = config.aws || {};
  return !!(accessKeyId && secretAccessKey && bucketName);
}

/**
 * Upload buffer or stream to Amazon S3
 * @param {Object} params
 * @param {Buffer|ReadableStream} params.body - File buffer or stream
 * @param {string} params.fileName - Target file name
 * @param {string} params.mimeType - MIME content type
 * @param {string} [params.folder='mongodb-dumps'] - Folder inside S3 bucket
 * @returns {Promise<string>} S3 Object URI
 */
async function uploadToS3({ body, buffer, fileName, mimeType = 'application/octet-stream', folder = 'mongodb-dumps' }) {
  const client = getS3Client();
  const bucketName = config.aws?.bucketName;

  if (!client || !bucketName) {
    throw new Error('Amazon S3 is not configured in environment variables');
  }

  const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
  const cleanFileName = fileName.replace(/^\/+/g, '');
  const key = cleanFolder ? `${cleanFolder}/${cleanFileName}` : cleanFileName;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: body || buffer,
    ContentType: mimeType,
  });

  await client.send(command);
  const s3Uri = `s3://${bucketName}/${key}`;
  logger.info(`[S3 Storage] Successfully uploaded object to ${s3Uri}`);
  return s3Uri;
}

/**
 * List objects in an S3 prefix/folder
 */
async function listS3Objects({ folder = 'mongodb-dumps', maxKeys = 100 } = {}) {
  const client = getS3Client();
  const bucketName = config.aws?.bucketName;

  if (!client || !bucketName) {
    throw new Error('Amazon S3 is not configured');
  }

  const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
  const prefix = cleanFolder ? `${cleanFolder}/` : '';

  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });

  const response = await client.send(command);
  return (response.Contents || []).map((item) => ({
    key: item.Key,
    sizeBytes: item.Size,
    sizeMB: (item.Size / (1024 * 1024)).toFixed(2),
    lastModified: item.LastModified,
    storageClass: item.StorageClass || 'STANDARD',
  }));
}

module.exports = {
  getS3Client,
  isS3Configured,
  uploadToS3,
  listS3Objects,
};
