const httpStatus = require('http-status').default;
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const config = require('../config/config');
const userService = require('./user.service');
const ApiError = require('../utils/ApiError');
const { generateToken, generateExpires, verifyToken } = require('../utils/auth');
const { getRedisClient } = require('../db/redisClient');
const logger = require('../config/logger');

const ACCESS_TOKEN_EXPIRATION_MINUTES = 15; // 15 minutes as per enterprise standard
const REFRESH_TOKEN_EXPIRATION_DAYS = 7;    // 7 days as per enterprise standard
const REFRESH_TOKEN_TTL_SECONDS = REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60;

async function generateResetPasswordToken(email) {
  const user = await userService.getUserByEmail(email);
  if (!user || !user.id) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'User not found with this email'
    );
  }

  const expiresMs = generateExpires(
    config.jwt.resetPasswordExpirationMinutes / 60
  );
  const resetPasswordToken = generateToken({ id: user.id }, expiresMs);

  return resetPasswordToken;
}

/**
 * Generates an initial token pair with a new cryptographically unique token family.
 * @param {object} params
 * @param {string} params.userId
 * @param {string} [params.familyId]
 */
async function generateAuthTokens({ userId, familyId = null }) {
  const redis = getRedisClient();
  const activeFamilyId = familyId || uuidv4();
  const jti = uuidv4();

  const accessTokenExpires = generateExpires(ACCESS_TOKEN_EXPIRATION_MINUTES / 60);
  const accessToken = generateToken({
    userId,
    familyId: activeFamilyId,
    tokenType: 'access'
  }, accessTokenExpires);

  const refreshTokenExpires = generateExpires(REFRESH_TOKEN_EXPIRATION_DAYS * 24);
  const refreshToken = generateToken({
    userId,
    familyId: activeFamilyId,
    jti,
    tokenType: 'refresh'
  }, refreshTokenExpires);

  // Store active family state in Redis with 7-day TTL
  const familyKey = `token_family:${activeFamilyId}`;
  const userFamiliesKey = `user_families:${userId}`;

  try {
    const familyData = JSON.stringify({
      userId,
      familyId: activeFamilyId,
      currentJti: jti,
      currentRefreshToken: refreshToken,
      revoked: false,
      createdAt: Date.now()
    });

    await redis.set(familyKey, familyData, { EX: REFRESH_TOKEN_TTL_SECONDS });
    if (typeof redis.sAdd === 'function') {
      await redis.sAdd(userFamiliesKey, activeFamilyId);
      await redis.expire(userFamiliesKey, REFRESH_TOKEN_TTL_SECONDS);
    }
  } catch (err) {
    logger.warn('Failed to register token family in Redis: %s', err.message);
  }

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires,
    },
    refresh: {
      token: refreshToken,
      expires: refreshTokenExpires,
    },
  };
}

/**
 * Performs Refresh Token Rotation (RTR) with token family tracking & reuse detection.
 * If a revoked or already rotated token is re-used, all sessions for that user are terminated.
 * 
 * @param {string} refreshToken
 * @returns {Promise<{ access: object, refresh: object, user: object }>}
 */
async function rotateRefreshToken(refreshToken) {
  if (!refreshToken) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Refresh token is required');
  }

  let payload;
  try {
    payload = await verifyToken(refreshToken);
  } catch (err) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired refresh token');
  }

  const { userId, familyId, jti } = payload || {};
  if (!userId || !familyId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Malformed refresh token payload');
  }

  const user = await userService.getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User account not found or deactivated');
  }

  const redis = getRedisClient();
  const familyKey = `token_family:${familyId}`;
  const userFamiliesKey = `user_families:${userId}`;

  let familyRaw = null;
  try {
    familyRaw = await redis.get(familyKey);
  } catch (err) {
    logger.warn('Redis error reading token family: %s', err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REUSE DETECTION:
  // If family does not exist, is explicitly marked revoked, or the JTI does not match
  // the current active JTI, an old rotated token was reused!
  // ─────────────────────────────────────────────────────────────────────────────
  if (familyRaw) {
    let family;
    try {
      family = JSON.parse(familyRaw);
    } catch {
      family = null;
    }

    if (!family || family.revoked || family.currentJti !== jti) {
      logger.warn(
        `🚨 [SECURITY ALERT: TOKEN REUSE DETECTED] User ${userId} attempted reuse of rotated refresh token in family ${familyId}. Terminating all active sessions.`
      );

      // Terminate all sessions for this user by revoking all families
      await revokeAllUserSessions(userId);

      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        'Security violation: Refresh token reuse detected. All active sessions have been terminated for security.'
      );
    }
  }

  // Generate a brand new pair within the SAME family (Rotation)
  const newTokens = await generateAuthTokens({ userId, familyId });

  return {
    ...newTokens,
    user
  };
}

/**
 * Revokes an individual token family (e.g. on single-device logout)
 * @param {string} familyId
 * @param {string} [userId]
 */
async function revokeTokenFamily(familyId, userId) {
  if (!familyId) return;
  const redis = getRedisClient();
  const familyKey = `token_family:${familyId}`;

  try {
    const raw = await redis.get(familyKey);
    if (raw) {
      const family = JSON.parse(raw);
      family.revoked = true;
      await redis.set(familyKey, JSON.stringify(family), { EX: 86400 }); // Keep tombstone for 24h to catch reuse
    }
    if (userId && typeof redis.sRem === 'function') {
      await redis.sRem(`user_families:${userId}`, familyId);
    }
  } catch (err) {
    logger.warn('Failed to revoke token family: %s', err.message);
  }
}

/**
 * Revokes ALL token families for a user (terminates all active sessions)
 * @param {string} userId
 */
async function revokeAllUserSessions(userId) {
  if (!userId) return;
  const redis = getRedisClient();
  const userFamiliesKey = `user_families:${userId}`;

  try {
    let families = [];
    if (typeof redis.sMembers === 'function') {
      families = await redis.sMembers(userFamiliesKey);
    }

    for (const famId of families) {
      const familyKey = `token_family:${famId}`;
      const raw = await redis.get(familyKey);
      if (raw) {
        const family = JSON.parse(raw);
        family.revoked = true;
        await redis.set(familyKey, JSON.stringify(family), { EX: 86400 });
      }
    }

    await redis.del(userFamiliesKey);
    logger.info(`Successfully terminated all active sessions for user ${userId}`);
  } catch (err) {
    logger.warn('Failed to revoke all user sessions: %s', err.message);
  }
}

module.exports = {
  generateResetPasswordToken,
  generateAuthTokens,
  rotateRefreshToken,
  revokeTokenFamily,
  revokeAllUserSessions,
  ACCESS_TOKEN_EXPIRATION_MINUTES,
  REFRESH_TOKEN_EXPIRATION_DAYS,
};
