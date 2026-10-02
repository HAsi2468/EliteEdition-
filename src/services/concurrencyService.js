/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - OPTIMISTIC CONCURRENCY CONTROL (OCC) SERVICE
 * Guarantees zero lost updates and prevents simultaneous overwrite races
 * by executing atomic conditional engine-level updates.
 * ============================================================================
 */

const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status').default;

/**
 * Updates a document using strict Optimistic Concurrency Control (OCC).
 * Matches: { _id: id, version: clientVersion }
 * Updates: { ...updatePayload, $inc: { version: 1 } }
 *
 * If matched document count is 0:
 * - Checks if document actually exists to distinguish 404 from 409
 * - If it exists, throws HTTP 409 Conflict with the server's current version
 * 
 * @param {import('mongoose').Model} model - Mongoose Model
 * @param {string|import('mongoose').Types.ObjectId} id - Document ID
 * @param {number|string} clientVersion - Version passed by the client
 * @param {object} updateData - Data to update ($set)
 * @param {object} [options={}] - Additional mongoose update options
 * @returns {Promise<object>} The updated document
 */
async function updateWithOCC(model, id, clientVersion, updateData, options = {}) {
  const versionNum = parseInt(clientVersion, 10);

  if (isNaN(versionNum) || versionNum < 1) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'A valid numeric version is required for optimistic concurrency control.'
    );
  }

  // Strip version and __v from updateData to prevent client tampering
  const cleanUpdate = { ...updateData };
  delete cleanUpdate.version;
  delete cleanUpdate.__v;
  delete cleanUpdate._id;

  // Execute atomic conditional engine-level query
  const updatedDoc = await model.findOneAndUpdate(
    {
      _id: id,
      version: versionNum,
    },
    {
      $set: cleanUpdate,
      $inc: { version: 1 },
    },
    {
      new: true,
      runValidators: true,
      ...options,
    }
  );

  if (!updatedDoc) {
    // Check if the record exists at all
    const currentDoc = await model.findById(id).select('version updatedAt modified_date_time updatedBy updatedByName').lean();

    if (!currentDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Resource not found');
    }

    // Record exists but version didn't match -> 409 Conflict
    const error = new ApiError(
      httpStatus.CONFLICT,
      'Resource was modified by another operator. Please refresh and review the latest changes.'
    );
    error.code = 'STALE_RECORD_CONFLICT';
    error.currentVersion = currentDoc.version;
    error.updatedAt = currentDoc.updatedAt || currentDoc.modified_date_time;
    error.updatedByName = currentDoc.updatedByName || currentDoc.updatedBy || 'Another Operator';
    throw error;
  }

  return updatedDoc;
}

module.exports = {
  updateWithOCC,
};
