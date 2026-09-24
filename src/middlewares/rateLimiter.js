const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Generous limit for login attempts (100 per 15 min)
	skipSuccessfulRequests: true,
	message: {
		code: 429,
		message: 'Too many auth attempts from this IP, please try again after 15 minutes.',
	},
});

const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100000, // Maximum ceiling (100,000 requests per 15 min) for flawless ERP performance
	skip: (req) => {
		// Completely skip rate limiting for authenticated ERP staff or internal health checks
		if (req.headers && req.headers.authorization) {
			return true;
		}
		if (req.path === '/' || req.path === '/health') {
			return true;
		}
		return false;
	},
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		code: 429,
		message: 'Too many requests from this IP, please try again later.',
	},
});

module.exports = {
	authLimiter,
	apiLimiter,
};


