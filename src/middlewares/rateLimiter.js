const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 5, // Strict brute-force shield: 5 failed attempts per 15 min window
	skipSuccessfulRequests: true,
	standardHeaders: true,
	legacyHeaders: false,
	skip: (req) => {
		// Never rate-limit lightweight heartbeat pings or health probes
		if (req.path === '/ping' || req.path === '/ping/' || req.url.includes('/ping') || req.path.includes('/csrf-token')) {
			return true;
		}
		return false;
	},
	message: {
		code: 429,
		error: 'Too many failed login attempts. Access is temporarily locked from this IP for 15 minutes to protect against brute-force attacks.',
	},
});

const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 3000, // 3,000 requests per 15 min ceiling for ERP operations
	standardHeaders: true,
	legacyHeaders: false,
	skip: (req) => {
		if (req.path === '/' || req.path === '/health' || req.path === '/api/health' || req.path === '/v1/health') {
			return true;
		}
		return false;
	},
	message: {
		code: 429,
		error: 'Too many requests from this IP, please try again later.',
	},
});

module.exports = {
	authLimiter,
	apiLimiter,
};


