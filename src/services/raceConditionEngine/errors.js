/**
 * RFC 7807 Problem Details Error Classes for Race Condition Engine
 */

class ProblemDetailsError extends Error {
  constructor({ type, title, status, detail, code, invalidParams = null, metadata = {} }) {
    super(detail || title);
    this.name = this.constructor.name;
    this.type = type || `https://api.eliteedition.in/errors/${code || 'INTERNAL_ERROR'}`;
    this.title = title;
    this.status = status;
    this.detail = detail;
    this.code = code;
    this.invalidParams = invalidParams;
    this.metadata = metadata;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toRFC7807(instancePath = '') {
    const response = {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail,
      code: this.code,
      instance: instancePath || undefined,
      timestamp: this.timestamp
    };

    if (this.invalidParams) {
      response.invalidParams = this.invalidParams;
    }

    if (this.metadata && Object.keys(this.metadata).length > 0) {
      response.metadata = this.metadata;
    }

    return response;
  }
}

class VersionConflictError extends ProblemDetailsError {
  constructor({ jobCardId, serverVersion, clientVersion }) {
    super({
      type: 'https://api.eliteedition.in/errors/VERSION_CONFLICT',
      title: 'Optimistic Concurrency Version Conflict',
      status: 409,
      code: 'VERSION_CONFLICT',
      detail: `Job card ${jobCardId} version conflict: client submitted version ${clientVersion}, but authoritative database version is ${serverVersion}.`,
      metadata: { jobCardId, serverVersion, clientVersion }
    });
  }
}

class InvalidStatusTransitionError extends ProblemDetailsError {
  constructor({ jobCardId, currentStatus, targetStatus }) {
    super({
      type: 'https://api.eliteedition.in/errors/INVALID_TRANSITION',
      title: 'Invalid State Transition',
      status: 409,
      code: 'INVALID_TRANSITION',
      detail: `Cannot transition job card ${jobCardId} from '${currentStatus}' to '${targetStatus}'.`,
      metadata: { jobCardId, currentStatus, targetStatus }
    });
  }
}

class InsufficientMetersError extends ProblemDetailsError {
  constructor({ lotId, availableMeters, requestedMeters }) {
    super({
      type: 'https://api.eliteedition.in/errors/INSUFFICIENT_METERS',
      title: 'Insufficient Available Meters',
      status: 422,
      code: 'INSUFFICIENT_METERS',
      detail: `Lot ${lotId} has only ${availableMeters}m available, but ${requestedMeters}m was requested. Shortage: ${(requestedMeters - availableMeters).toFixed(2)}m.`,
      metadata: { lotId, availableMeters, requestedMeters, shortage: Number((requestedMeters - availableMeters).toFixed(2)) }
    });
  }
}

class ResourceBusyError extends ProblemDetailsError {
  constructor({ message, originalError }) {
    super({
      type: 'https://api.eliteedition.in/errors/RESOURCE_BUSY',
      title: 'Resource Lock Timeout',
      status: 409,
      code: 'RESOURCE_BUSY',
      detail: message || 'Could not acquire exclusive locks on Job Card and Lot within lock_wait_timeout (3s).',
      metadata: { pgCode: originalError?.code }
    });
  }
}

class DeadlockRetryExhaustedError extends ProblemDetailsError {
  constructor({ retries, originalError }) {
    super({
      type: 'https://api.eliteedition.in/errors/RETRY_DEADLOCK',
      title: 'Deadlock Detected - Max Retries Exhausted',
      status: 409,
      code: 'RETRY_DEADLOCK',
      detail: `Transaction encountered database deadlocks and failed after ${retries} automated retry attempts.`,
      metadata: { retries, pgCode: originalError?.code }
    });
  }
}

class RecordNotFoundError extends ProblemDetailsError {
  constructor(entityName, id) {
    super({
      type: 'https://api.eliteedition.in/errors/RECORD_NOT_FOUND',
      title: `${entityName} Not Found`,
      status: 404,
      code: 'RECORD_NOT_FOUND',
      detail: `${entityName} with ID '${id}' does not exist.`,
      metadata: { entityName, id }
    });
  }
}

module.exports = {
  ProblemDetailsError,
  VersionConflictError,
  InvalidStatusTransitionError,
  InsufficientMetersError,
  ResourceBusyError,
  DeadlockRetryExhaustedError,
  RecordNotFoundError
};
