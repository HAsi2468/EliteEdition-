const httpStatus = require('http-status').default;
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const {
  authService,
  userService,
  emailService,
  tokenService,
} = require('../services');
const { verifyToken } = require('../utils/auth');

/**
 * Helper to set hardened auth cookies with HttpOnly, Secure, SameSite=Lax
 */
function setAuthCookies(res, tokens) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

  const accessTokenVal = tokens?.access?.token || tokens?.token || (typeof tokens === 'string' ? tokens : null);
  const refreshTokenVal = tokens?.refresh?.token || tokens?.refreshToken || null;

  // Refresh Token: Long-lived (7 days), strictly HttpOnly, SameSite=Lax
  if (refreshTokenVal) {
    const refreshOpts = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: (tokenService.REFRESH_TOKEN_EXPIRATION_DAYS || 7) * 24 * 60 * 60 * 1000,
      path: '/',
      domain: cookieDomain,
    };
    res.cookie('refreshToken', refreshTokenVal, refreshOpts);
    res.cookie('elite_refresh_token', refreshTokenVal, refreshOpts);
  }

  // Access Token Cookie: Strictly HttpOnly, SameSite=Lax
  if (accessTokenVal) {
    const accessOpts = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: (tokenService.ACCESS_TOKEN_EXPIRATION_MINUTES || 60) * 60 * 1000,
      path: '/',
      domain: cookieDomain,
    };
    res.cookie('accessToken', accessTokenVal, accessOpts);
    res.cookie('token', accessTokenVal, accessOpts);
    res.cookie('elite_auth_token', accessTokenVal, accessOpts);
  }
}

/**
 * Clears auth cookies upon logout, login failure, or session invalidation
 */
function clearAuthCookies(res) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

  const cookieNames = ['refreshToken', 'accessToken', 'token', 'elite_auth_token', 'elite_refresh_token'];
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  };

  cookieNames.forEach((name) => {
    res.clearCookie(name, cookieOptions);
    if (cookieDomain) {
      res.clearCookie(name, { ...cookieOptions, domain: cookieDomain });
    }
  });
}

const register = catchAsync(async (req, res) => {
  // Prevent privilege escalation on public registration (BUG-061)
  const isCallerAdmin = req.user && (req.user.isAdmin || req.user.isMainAdmin || req.user.role === 'admin' || req.user.role === 'super_admin');
  if (!isCallerAdmin) {
    req.body.role = 'user';
    req.body.isMainAdmin = false;
  }
  const user = await userService.createUser(req);
  const tokens = await tokenService.generateAuthTokens({
    userId: user.id,
    role: user.role
  });
  setAuthCookies(res, tokens);
  delete user.password;
  res.status(httpStatus.CREATED).send({ user, tokens });
});

const login = catchAsync(async (req, res) => {
  try {
    const user = await authService.loginUserWithEmailAndPassword(req);
    const tokens = await tokenService.generateAuthTokens({
      userId: user.id,
      role: user.role
    });
    setAuthCookies(res, tokens);
    res.send({ user, tokens });
  } catch (err) {
    clearAuthCookies(res);
    throw err;
  }
});

const refreshTokens = catchAsync(async (req, res) => {
  const refreshToken =
    req.body?.refreshToken ||
    req.cookies?.refreshToken ||
    req.cookies?.elite_refresh_token ||
    req.headers['x-refresh-token'];

  if (!refreshToken) {
    clearAuthCookies(res);
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Refresh token required');
  }

  // Execute Refresh Token Rotation with token family tracking & reuse detection
  const result = await tokenService.rotateRefreshToken(refreshToken);

  const tokens = {
    access: result.access,
    refresh: result.refresh,
  };

  setAuthCookies(res, tokens);
  res.send({ user: result.user, tokens });
});

const logout = catchAsync(async (req, res) => {
  const refreshToken =
    req.body?.refreshToken ||
    req.cookies?.refreshToken ||
    req.cookies?.elite_refresh_token ||
    req.headers['x-refresh-token'];

  if (refreshToken) {
    try {
      const payload = await verifyToken(refreshToken);
      if (payload && payload.familyId) {
        await tokenService.revokeTokenFamily(payload.familyId, payload.userId);
      }
    } catch {
      // Best-effort cleanup
    }
  }

  // Blacklist active access token in Redis so it cannot be used again
  let accessToken = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.split(' ')[1];
  } else if (req.cookies && (req.cookies.accessToken || req.cookies.token || req.cookies.elite_auth_token)) {
    accessToken = req.cookies.accessToken || req.cookies.token || req.cookies.elite_auth_token;
  }

  if (accessToken) {
    try {
      const redis = typeof tokenService.getRedisClient === 'function' ? tokenService.getRedisClient() : null;
      if (redis && typeof redis.set === 'function') {
        await redis.set(`revoked_token:${accessToken}`, '1', { EX: 7200 });
      }
    } catch (_) {}
  }

  if (req.user && req.user.id) {
    try {
      await tokenService.revokeAllUserSessions(req.user.id);
    } catch (_) {}
  }

  clearAuthCookies(res);
  res.status(httpStatus.OK).send({ success: true, message: 'Logged out successfully' });
});

const forgotPassword = catchAsync(async (req, res) => {
  const resetPasswordToken = await tokenService.generateResetPasswordToken(
    req.body.email
  );
  await emailService.sendResetPasswordEmail(
    req.body.email,
    resetPasswordToken
  );
  res.send({ success: true });
});

const resetPassword = catchAsync(async (req, res) => {
  const { id } = await verifyToken(req.query.token);
  req.body.id = id;
  await userService.updateUser(req);
  res.send({ success: true });
});

module.exports = {
  register,
  login,
  refreshTokens,
  logout,
  forgotPassword,
  resetPassword,
  setAuthCookies,
  clearAuthCookies,
};
