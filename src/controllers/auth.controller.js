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

  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    domain: cookieDomain,
    maxAge: 0,
    expires: new Date(0),
  };

  res.clearCookie('refreshToken', cookieOptions);
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('token', cookieOptions);
  res.clearCookie('elite_auth_token', cookieOptions);
  res.clearCookie('elite_refresh_token', cookieOptions);
}

const register = catchAsync(async (req, res) => {
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
