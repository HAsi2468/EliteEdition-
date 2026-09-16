const express = require('express');
require('./polyfills/crypto');
const helmet = require('helmet');
const xss = require('xss-clean');
const compression = require('compression');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const httpStatus = require('http-status').default;
const config = require('./config/config');
const morgan = require('./config/morgan');
const jwt = require('./config/jwt');
const { authLimiter } = require('./middlewares/rateLimiter');
const routes = require('./routes/v1');
require('./schedule/fetchFromAPISScheduler');
require('./schedule/myntraScheduler').startMyntraScheduler();
const { errorConverter, errorHandler } = require('./middlewares/error');
const ApiError = require('./utils/ApiError');
const userModel = require('./db/models/user.model');

const app = express();

if (config.env !== 'test') {
	app.use(morgan.successHandler);
	app.use(morgan.errorHandler);
}

// set security HTTP headers
// app.use(helmet());

// parse json request body
app.use(express.json({ limit: '50mb' }));

// parse urlencoded request body
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// sanitize request data
// app.use(xss()); // disabled due to incompatibility with Node/Express version

// gzip compression
app.use(compression());

// enable cors
app.use(cors());
// CORS preflight handled by app.use(cors())

const jwtUtils = require('./utils/auth');

// Automatic User Context Middleware
app.use(async (req, res, next) => {
  try {
    let userId = req.headers['x-user-id'] || req.query?.userId || req.body?.userId;
    let userName = req.headers['x-user-name'] || req.body?.userName;
    let authHeader = req.headers['authorization'];

    if (!userId && authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = await jwtUtils.verifyToken(token);
        if (decoded && (decoded.userId || decoded.id || decoded.sub)) {
          userId = decoded.userId || decoded.id || decoded.sub;
        }
      } catch (e) {}
    }

    if (userId) {
      const u = await userModel.findById(userId).lean();
      if (u) {
        req.user = u;
      } else {
        req.user = {
          _id: userId,
          name: userName || 'HASI',
          username: userName || 'HASI'
        };
      }
    } else if (userName) {
      req.user = {
        name: userName,
        username: userName
      };
    } else {
      req.user = {
        name: 'HASI',
        username: 'HASI'
      };
    }
  } catch (err) {
    console.warn('[authMiddleware] Error resolving user:', err.message);
  }
  next();
});



// limit repeated failed requests to auth endpoints
if (config.env === 'production') {
	app.use('/v1/auth', authLimiter);
}
// Serve static uploads for Chat Image Mocks
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve design images under both /v1/designs and /designs with automatic fallback generator
const imagesDir = path.join(__dirname, '../../elite_edition_images');
app.use(['/v1/designs', '/designs'], express.static(imagesDir));
app.use(['/v1/designs/:filename', '/designs/:filename'], (req, res) => {
  const filename = req.params.filename || '';
  const cleanName = filename.replace(/\.(jpg|jpeg|png|webp|gif|svg)$/i, '').trim();
  const displayName = cleanName ? cleanName.toUpperCase() : 'DESIGN';

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1b4b" />
      <stop offset="50%" stop-color="#312e81" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#3b82f6" />
    </linearGradient>
  </defs>
  <rect width="600" height="400" fill="url(#bgGrad)" />
  <circle cx="300" cy="150" r="55" fill="rgba(99,102,241,0.2)" stroke="rgba(129,140,248,0.6)" stroke-width="2" />
  <path d="M 275 165 L 290 140 L 305 155 L 315 145 L 330 165 Z" fill="#818cf8" opacity="0.9" />
  <circle cx="315" cy="135" r="6" fill="#fbbf24" />
  <rect x="140" y="235" width="320" height="50" rx="10" fill="url(#badgeGrad)" />
  <text x="300" y="268" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">${displayName}</text>
  <text x="300" y="325" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500" fill="#a5b4fc" text-anchor="middle">Elite Digital Prints — Master Design</text>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svg);
});

// Serve frontend static build assets
const websiteDistPath = path.join(__dirname, '../elite_edition_website_dist');
app.use(express.static(websiteDistPath));

// v1 api routes
app.use('/v1', routes);

// send back a 404 error for any unknown api request
app.use('/v1', (req, res, next) => {
	next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// Serve frontend website with no-cache headers to ensure users always receive the latest version
app.get('*', (req, res, next) => {
	if (req.path.startsWith('/v1') || req.path.startsWith('/uploads') || req.path.startsWith('/designs')) {
		return next();
	}
	res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
	res.setHeader('Pragma', 'no-cache');
	res.setHeader('Expires', '0');
	res.sendFile(path.join(websiteDistPath, 'index.html'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

module.exports = app;
