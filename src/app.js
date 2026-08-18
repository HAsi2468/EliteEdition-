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
// v1 api routes
app.use('/v1', routes);

// Serve static uploads for Chat Image Mocks
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// send back a 404 error for any unknown api request
app.use('/v1', (req, res, next) => {
	next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// Serve frontend website
app.use(express.static(path.join(__dirname, '../../elite_edition_website_dist')));

// Serve design images
app.use('/designs', express.static(path.join(__dirname, '../../elite_edition_images')));

// Serve frontend website with no-cache headers to ensure users always receive the latest version
app.get('*', (req, res, next) => {
	if (req.path.startsWith('/v1') || req.path.startsWith('/uploads') || req.path.startsWith('/designs')) {
		return next();
	}
	res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
	res.setHeader('Pragma', 'no-cache');
	res.setHeader('Expires', '0');
	res.sendFile(path.join(__dirname, '../../elite_edition_website_dist/index.html'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

module.exports = app;
