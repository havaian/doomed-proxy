// middleware/apiKeyValidator.js
const validateApiKey = (req, res, next) => {
    // Skip validation for health check endpoints
    if (req.path === '/health' || req.path === '/api/health' || req.path === '/api/dashboard') {
        return next();
    }

    // Skip validation for test endpoints
    if (req.path.includes('/api/test-rate-limit')) {
        return next();
    }

    // Skip validation in development if explicitly disabled
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_API_KEY_VALIDATION === 'true') {
        console.log('⚠️ Development mode: API key validation skipped');
        return next();
    }

    const authHeader = req.headers.authorization;

    // Check if Authorization header exists
    if (!authHeader) {
        console.error('❌ API Key validation failed: Missing Authorization header', {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            path: req.path
        });

        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing Authorization header',
            details: '001'
        });
    }

    // Check if it's a Bearer token
    if (!authHeader.startsWith('Bearer ')) {
        console.error('❌ API Key validation failed: Invalid Authorization format', {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            path: req.path,
            authFormat: authHeader.substring(0, 10) + '...'
        });

        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid Authorization format',
            details: '002'
        });
    }

    // Extract the token
    const token = authHeader.substring(7);

    // Validate token format (OpenAI keys start with 'sk-' and are typically 48+ characters)
    if (!token || token.length < 20 || !token.startsWith('sk-')) {
        console.error('❌ API Key validation failed: Invalid token format', {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            path: req.path,
            tokenLength: token.length,
            tokenPrefix: token.substring(0, 3)
        });

        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid API key format',
            details: '003'
        });
    }

    // Optional: Validate against a whitelist of allowed API keys
    const allowedKeys = [
        process.env.OPENAI_API_KEY,
        // Add other allowed keys here if needed
    ].filter(Boolean); // Remove undefined values

    if (allowedKeys.length > 0 && !allowedKeys.includes(token)) {
        console.error('❌ API Key validation failed: Unauthorized API key', {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            path: req.path,
            keyPrefix: token.substring(0, 4) + '...' + token.substring(token.length - 4)
        });

        return res.status(403).json({
            error: 'Forbidden',
            message: 'Unauthorized API key',
            details: '004'
        });
    }

    // If we reach here, the API key is valid
    req.apiKey = token;
    next();
};

module.exports = validateApiKey;