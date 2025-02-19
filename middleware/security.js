const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Basic security headers with helmet
router.use(helmet({
    contentSecurityPolicy: false, // Disable CSP as we're an API server
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for our API routes and health checks
        return req.path.startsWith('/api/') || req.path === '/health';
    }
});

// Suspicious patterns in requests
const suspiciousPatterns = [
    /select.*from/i,
    /union.*select/i,
    /'.*or.*'1'.*=.*'1/i,
    /exec.*\(/i,
    /\/etc\/passwd/i,
    /\/proc\//i,
    /\/sys\//i,
    /eval\(/i,
    /<script.*>/i,
    /javascript:/i,
    /onload=/i,
    /onclick=/i,
    /onerror=/i
];

// Security middleware
const securityMiddleware = [
    // Apply rate limiting to non-API routes
    limiter,

    // Block suspicious requests
    (req, res, next) => {
        const path = req.path.toLowerCase();
        
        // Only apply security checks to non-API routes
        if (!path.startsWith('/api/')) {
            // Block sensitive file access attempts
            if (path.includes('.env') || 
                path.includes('.git') || 
                path.includes('.htaccess') ||
                path.includes('.config') ||
                path.includes('.conf') ||
                path.includes('.sql') ||
                path.includes('wp-')) {
                console.warn(`⚠️ Blocked sensitive path access: ${path} from ${req.ip}`);
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        next();
    },

    // Monitor for suspicious patterns
    (req, res, next) => {
        const reqUrl = decodeURIComponent(req.url);
        const reqBody = JSON.stringify(req.body);
        const userAgent = req.headers['user-agent'] || '';

        // Check URL and body for suspicious patterns
        if (suspiciousPatterns.some(pattern => 
            pattern.test(reqUrl) || pattern.test(reqBody)
        )) {
            console.warn(`🚨 Suspicious pattern detected:
                IP: ${req.ip}
                Path: ${reqUrl}
                User-Agent: ${userAgent}
                Body: ${reqBody}
            `);
            // Log but don't block - just monitor for now
        }

        next();
    }
];

router.use(securityMiddleware);

module.exports = router;