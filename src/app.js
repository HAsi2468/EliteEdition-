const express = require('express');
const fs = require('fs');
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
const mongoSanitize = require('express-mongo-sanitize');
const { authLimiter, apiLimiter } = require('./middlewares/rateLimiter');
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
app.use(
	helmet({
		contentSecurityPolicy: false,
		crossOriginResourcePolicy: { policy: 'cross-origin' },
		crossOriginEmbedderPolicy: false,
		hsts: {
			maxAge: 31536000,
			includeSubDomains: true,
			preload: true,
		},
		frameguard: { action: 'sameorigin' },
		noSniff: true,
	})
);

// parse json request body
app.use(express.json({ limit: '50mb' }));

// parse urlencoded request body
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// sanitize request data against MongoDB Operator Injection
app.use(mongoSanitize());

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



// limit repeated failed requests to auth endpoints & apply global API rate limiter in production
if (config.env === 'production') {
	app.use('/v1/auth', authLimiter);
	app.use('/v1', apiLimiter);
}
// Serve static uploads for Chat Image Mocks
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve design images under both /v1/designs and /designs with automatic fallback generator
const imagesDir = path.join(__dirname, '../../elite_edition_images');
app.get('/v1/designs/download-zip', (req, res) => {
  const zipFile = path.join(__dirname, '../uploads/elite_edition_images.zip');
  if (fs.existsSync(zipFile)) {
    return res.download(zipFile, 'elite_edition_images.zip');
  }
  res.status(404).json({ error: 'Zip file not found' });
});

app.use(['/v1/designs/:filename', '/designs/:filename'], async (req, res, next) => {
  const rawFilename = req.params.filename || '';
  let filename = rawFilename;
  try { filename = decodeURIComponent(rawFilename); } catch (e) {}
  
  const cleanName = filename.replace(/\.(jpg|jpeg|png|webp|gif|svg)$/i, '').trim();
  if (!cleanName) return next();

  // Bypass image serving middleware for reserved API subpaths
  const reservedApiSubpaths = ['next-number', 'categories', 'import-pkd-orders', 'download-zip'];
  if (reservedApiSubpaths.includes(cleanName.toLowerCase())) {
    return next();
  }

  // 1. Check if any matching photo file exists locally in imagesDir or uploads
  try {
    const searchDirs = [imagesDir, path.join(__dirname, '../uploads'), path.join(process.cwd(), 'uploads')];
    for (const sDir of searchDirs) {
      if (!fs.existsSync(sDir)) continue;
      const files = fs.readdirSync(sDir);
      const targetUpper = cleanName.toUpperCase();
      const matchedFile = files.find(f => {
        if (f.startsWith('.')) return false;
        const fBase = f.replace(/\.(jpg|jpeg|png|webp|gif|svg)$/i, '').trim().toUpperCase();
        return fBase === targetUpper ||
               fBase === filename.toUpperCase() ||
               fBase.startsWith(targetUpper + ' ') ||
               fBase.startsWith(targetUpper + '(') ||
               fBase.startsWith(targetUpper + '-');
      });

      if (matchedFile) {
        const fullPath = path.join(sDir, matchedFile);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).size > 100) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.sendFile(fullPath);
        }
      }
    }
  } catch (e) {
    console.warn('Smart local image lookup error:', e.message);
  }

  // 2. If not found locally and not an explicit fallback request, stream directly from Cloudflare R2
  const isExplicitFallback = req.query.fallback === '1' || req.query.svg === '1';
  if (!isExplicitFallback && config.r2 && config.r2.publicUrl) {
    const r2Base = config.r2.publicUrl.replace(/\/+$/, '');
    const axios = require('axios');
    const r2Candidates = [];

    // If filename is already a multer upload key (image-178...)
    if (cleanName.startsWith('image-')) {
      r2Candidates.push(`designs/${encodeURIComponent(cleanName)}`);
      r2Candidates.push(`designs/${encodeURIComponent(cleanName)}.jpg`);
    } else if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(filename)) {
      r2Candidates.push(`designs/${encodeURIComponent(filename)}`);
    }

    // Check MongoDB design or jobcard record if cleanName looks like a design identifier
    try {
      const db = require('./db/models');
      const dDoc = await db.Design.findOne({
        $or: [{ designName: cleanName }, { designNo: cleanName }]
      }).lean();
      let matchedImgUrl = dDoc?.imageUrl || dDoc?.imageUrl1 || dDoc?.imageUrl2 || '';

      if (!matchedImgUrl) {
        const jDoc = await db.JobCard.findOne({
          $or: [{ designName: cleanName }, { designNo: cleanName }, { jobNo: cleanName }]
        }).lean();
        matchedImgUrl = jDoc?.imageUrl1 || jDoc?.imageUrl || jDoc?.imageUrl2 || '';
      }

      if (matchedImgUrl) {
        const strippedKey = matchedImgUrl.replace(/^https?:\/\/[^\/]+\//, '').replace(/^\/?designs\//, '').replace(/^\/+/, '').split('?')[0];
        if (strippedKey) {
          r2Candidates.unshift(`designs/${encodeURIComponent(strippedKey)}`);
        }
      }
    } catch (e) {}

    // Add standard extension variations on R2
    r2Candidates.push(`designs/${encodeURIComponent(cleanName)}.jpg`);
    r2Candidates.push(`designs/${encodeURIComponent(cleanName)}.jpeg`);
    r2Candidates.push(`designs/${encodeURIComponent(cleanName)}.png`);
    r2Candidates.push(`designs/${encodeURIComponent(cleanName)}.webp`);
    r2Candidates.push(`designs/${encodeURIComponent(cleanName)}`);

    // De-duplicate candidate list
    const uniqueKeys = Array.from(new Set(r2Candidates));

    for (const key of uniqueKeys) {
      try {
        const streamRes = await axios.get(`${r2Base}/${key}`, {
          responseType: 'stream',
          timeout: 4500,
          headers: { 'User-Agent': 'Mozilla/5.0 EliteEdition-Proxy' }
        });
        if (streamRes.status === 200) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
          res.setHeader('Content-Type', streamRes.headers['content-type'] || 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return streamRes.data.pipe(res);
        }
      } catch (err) {
        // Continue to next candidate
      }
    }
  }

  const displayName = cleanName ? cleanName.toUpperCase() : 'DESIGN';

  let hash = 0;
  for (let i = 0; i < displayName.length; i++) {
    hash = displayName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const absHash = Math.abs(hash);

  const palettes = [
    { bg1: '#1e1b4b', bg2: '#312e81', bg3: '#4338ca', accent: '#fbbf24', secondary: '#818cf8' },
    { bg1: '#064e3b', bg2: '#047857', bg3: '#059669', accent: '#f59e0b', secondary: '#34d399' },
    { bg1: '#831843', bg2: '#be123c', bg3: '#e11d48', accent: '#fef08a', secondary: '#fb7185' },
    { bg1: '#0f172a', bg2: '#1e293b', bg3: '#334155', accent: '#38bdf8', secondary: '#94a3b8' },
    { bg1: '#4c1d95', bg2: '#6d28d9', bg3: '#7c3aed', accent: '#fde047', secondary: '#c084fc' },
    { bg1: '#701a75', bg2: '#a21caf', bg3: '#c026d3', accent: '#fb7185', secondary: '#e879f9' },
    { bg1: '#78350f', bg2: '#b45309', bg3: '#d97706', accent: '#fef08a', secondary: '#fbbf24' }
  ];

  const p = palettes[absHash % palettes.length];
  const patternType = absHash % 4;

  let patternElements = '';
  if (patternType === 0) {
    patternElements = `
      <g opacity="0.2" stroke="${p.accent}" stroke-width="1.5" fill="none">
        <circle cx="150" cy="100" r="80" />
        <circle cx="150" cy="100" r="60" stroke-dasharray="6,6" />
        <circle cx="150" cy="100" r="40" />
        <path d="M 150 20 L 150 180 M 70 100 L 230 100 M 93 43 L 207 157 M 93 157 L 207 43" />
        <circle cx="450" cy="300" r="90" />
        <circle cx="450" cy="300" r="70" stroke-dasharray="8,8" />
        <circle cx="450" cy="300" r="45" />
        <path d="M 450 210 L 450 390 M 360 300 L 540 300 M 386 236 L 514 364 M 386 364 L 514 236" />
      </g>`;
  } else if (patternType === 1) {
    patternElements = `
      <g opacity="0.22" stroke="${p.accent}" stroke-width="1.2" fill="none">
        <pattern id="grid_${absHash}" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 30 0 L 60 30 L 30 60 L 0 30 Z" />
          <circle cx="30" cy="30" r="8" fill="${p.secondary}" opacity="0.3" />
        </pattern>
        <rect width="600" height="400" fill="url(#grid_${absHash})" />
      </g>`;
  } else if (patternType === 2) {
    patternElements = `
      <g opacity="0.25" fill="none" stroke-width="2">
        <path d="M -50 100 Q 150 300 350 100 T 750 300" stroke="${p.accent}" opacity="0.6" />
        <path d="M -50 140 Q 150 340 350 140 T 750 340" stroke="${p.secondary}" opacity="0.5" />
        <path d="M -50 180 Q 150 380 350 180 T 750 380" stroke="${p.accent}" opacity="0.4" />
        <path d="M -50 220 Q 150 420 350 220 T 750 420" stroke="${p.secondary}" opacity="0.3" />
      </g>`;
  } else {
    patternElements = `
      <g opacity="0.2" fill="${p.accent}">
        <circle cx="100" cy="80" r="35" />
        <circle cx="300" cy="80" r="35" />
        <circle cx="500" cy="80" r="35" />
        <circle cx="200" cy="240" r="45" />
        <circle cx="400" cy="240" r="45" />
        <circle cx="100" cy="360" r="35" />
        <circle cx="300" cy="360" r="35" />
        <circle cx="500" cy="360" r="35" />
      </g>`;
  }

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <defs>
    <linearGradient id="bgGrad_${absHash}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${p.bg1}" />
      <stop offset="50%" stop-color="${p.bg2}" />
      <stop offset="100%" stop-color="${p.bg3}" />
    </linearGradient>
    <linearGradient id="goldGrad_${absHash}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${p.accent}" />
      <stop offset="50%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="${p.accent}" />
    </linearGradient>
  </defs>

  <!-- Base Fabric Background -->
  <rect width="600" height="400" fill="url(#bgGrad_${absHash})" />
  
  <!-- Textile Pattern Overlay -->
  ${patternElements}

  <!-- Center Decorative Frame -->
  <rect x="90" y="105" width="420" height="190" rx="16" fill="rgba(15, 23, 42, 0.8)" stroke="url(#goldGrad_${absHash})" stroke-width="2.5" />
  <rect x="98" y="113" width="404" height="174" rx="12" fill="none" stroke="${p.secondary}" stroke-width="1" opacity="0.4" />

  <!-- Header Icon & Category Badge -->
  <circle cx="300" cy="150" r="20" fill="rgba(255,255,255,0.1)" stroke="${p.accent}" stroke-width="1.5" />
  <path d="M 292 156 L 300 141 L 308 156 Z" fill="${p.accent}" />

  <!-- Design Title -->
  <text x="300" y="210" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">${displayName}</text>
  
  <!-- Subtitle -->
  <text x="300" y="248" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" fill="${p.accent}" text-anchor="middle" letter-spacing="1">ELITE DIGITAL PRINTS • MASTER CATALOGUE</text>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(svg);
});

// Serve frontend static build assets
const distCandidates = [
	path.join(__dirname, '../elite_edition_website_dist'),
	path.join(__dirname, '../elite_edition_website/dist'),
	path.join(process.cwd(), 'elite_edition_website_dist'),
	path.join(process.cwd(), 'elite_edition_website/dist'),
];
const websiteDistPath = distCandidates.find(p => fs.existsSync(p)) || distCandidates[0];
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
