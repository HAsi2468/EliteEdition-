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
 * Helper to set hardened auth cookies with HttpOnly, Secure, SameSite=Strict
 */
function setAuthCookies(res, tokens) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

  // Refresh Token: Long-lived (7 days), strictly HttpOnly, SameSite=Strict
  if (tokens?.refresh?.token) {
    res.cookie('refreshToken', tokens.refresh.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: tokenService.REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
      path: '/',
      domain: cookieDomain,
    });
  }

  // Access Token Cookie (optional convenience alongside Bearer auth header)
  if (tokens?.access?.token) {
    res.cookie('accessToken', tokens.access.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: tokenService.ACCESS_TOKEN_EXPIRATION_MINUTES * 60 * 1000,
      path: '/',
      domain: cookieDomain,
    });
  }
}

/**
 * Clears auth cookies upon logout or session invalidation
 */
function clearAuthCookies(res) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    domain: cookieDomain,
  });
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    domain: cookieDomain,
  });
}

const register = catchAsync(async (req, res) => {
  const user = await userService.createUser(req);
  const tokens = await tokenService.generateAuthTokens({
    userId: user.id,
  });
  setAuthCookies(res, tokens);
  delete user.password;
  res.status(httpStatus.CREATED).send({ user, tokens });
});

const login = catchAsync(async (req, res) => {
  const user = await authService.loginUserWithEmailAndPassword(req);
  const tokens = await tokenService.generateAuthTokens({
    userId: user.id,
  });
  setAuthCookies(res, tokens);
  res.send({ user, tokens });
});

const refreshTokens = catchAsync(async (req, res) => {
  const refreshToken =
    req.body?.refreshToken ||
    req.cookies?.refreshToken ||
    req.headers['x-refresh-token'];

  if (!refreshToken) {
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
  const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
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
