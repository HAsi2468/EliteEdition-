const rateLimit = require('express-rate-limit');

/**
 * Extracts a normalized client IP identifier or /24 subnet for IPv4 (or /64 for IPv6).
 * This prevents attackers from bypassing IP rate limiting using rotating IP pools within the same subnet.
 */
function getClientSubnet(ip) {
	if (!ip || typeof ip !== 'string') return 'unknown_ip';
	const cleanIp = ip.replace(/^::ffff:/, '').trim();

	// IPv4 subnet /24 (e.g. 140.248.50.56 -> 140.248.50.0/24)
	if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) {
		const parts = cleanIp.split('.');
		return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
	}

	// IPv6 prefix /64
	if (cleanIp.includes(':')) {
		const parts = cleanIp.split(':');
		return `${parts.slice(0, 4).join(':')}::/64`;
	}

	return cleanIp;
}

// 1. IP & Subnet Brute Force Limiter: 300 login requests per 15 minutes per IP/subnet
// Enterprise-grade capacity allows 50-100 staff/QA users on one NAT office IP to log in concurrently
const authIpLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 300, // Allows high-concurrency office networks & burst logins (20 req/min)
	skipSuccessfulRequests: true,
	standardHeaders: true,
	legacyHeaders: false,
	validate: { keyGeneratorIpFallback: false },
	keyGenerator: (req) => {
		const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
		return getClientSubnet(ip);
	},
	skip: (req) => {
		// Never rate-limit lightweight heartbeat pings or health probes
		if (req.path === '/ping' || req.path === '/ping/' || req.url.includes('/ping') || req.path.includes('/csrf-token')) {
			return true;
		}
		return false;
	},
	handler: (req, res) => {
		const msg = 'Too many login requests from this network. Please wait a few moments before trying again.';
		return res.status(429).json({
			code: 429,
			message: msg,
			error: msg,
		});
	},
});

// 2. Account / Target Identifier Limiter: 5 failed attempts per 15 minutes per target email/mobile
const authAccountLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 5, // Strict brute-force shield: 5 failed attempts per target account (locks out on 6th attempt)
	skipSuccessfulRequests: true,
	standardHeaders: true,
	legacyHeaders: false,
	validate: { keyGeneratorIpFallback: false },
	keyGenerator: (req) => {
		const target = req.body?.email || req.body?.username || req.body?.mobile || req.body?.phone;
		if (target && typeof target === 'string') {
			return `account:${target.trim().toLowerCase()}`;
		}
		// Fall back to IP identifier if no body target specified
		const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
		return `account:ip_${getClientSubnet(ip)}`;
	},
	skip: (req) => {
		if (req.path === '/ping' || req.path === '/ping/' || req.url.includes('/ping') || req.path.includes('/csrf-token')) {
			return true;
		}
		return false;
	},
	handler: (req, res) => {
		const msg = 'Too many failed login attempts for this account. Access is temporarily locked for 15 minutes to protect your account.';
		return res.status(429).json({
			code: 429,
			message: msg,
			error: msg,
		});
	},
});

const authLimiter = [authIpLimiter, authAccountLimiter];
authLimiter.ipLimiter = authIpLimiter;
authLimiter.accountLimiter = authAccountLimiter;

// 3. Token Refresh Limiter: Dedicated high-ceiling limiter for silent background token rotation
const tokenRefreshLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 3000, // High ceiling for background token renewals across multi-tab workstations
	standardHeaders: true,
	legacyHeaders: false,
	skipSuccessfulRequests: true,
	validate: { keyGeneratorIpFallback: false },
	keyGenerator: (req) => {
		const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
		return `refresh:${getClientSubnet(ip)}`;
	},
	handler: (req, res) => {
		return res.status(429).json({
			code: 429,
			error: 'Too many token refresh requests. Please wait a moment before trying again.',
		});
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
	tokenRefreshLimiter,
	apiLimiter,
};


