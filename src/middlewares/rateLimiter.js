const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 20, // Limit each IP to 20 failed login/auth requests per windowMs
	skipSuccessfulRequests: true,
	message: {
		code: 429,
		message: 'Too many auth attempts from this IP, please try again after 15 minutes.',
	},
});

const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 1500, // Limit each IP to 1500 requests per windowMs (generous for ERP sync, blocks flooding)
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

