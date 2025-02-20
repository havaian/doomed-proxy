const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Basic security headers with helmet
router.use(helmet({
    contentSecurityPolicy: false,
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
    // No need for skip logic since all routes are under /api/
});

router.use(limiter);

module.exports = router;