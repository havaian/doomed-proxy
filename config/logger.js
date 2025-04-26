const morgan = require('morgan');
const rfs = require('rotating-file-stream');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

// Set up logging directory
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Create initial access.log to prevent ENOENT errors
const accessLogPath = path.join(logsDir, 'access.log');
if (!fs.existsSync(accessLogPath)) {
    fs.writeFileSync(accessLogPath, '');
}

// Log rotation settings
const rotatingLogStream = rfs.createStream('access.log', {
    interval: '7d',    // Rotate daily
    path: logsDir,
    size: '25M',      // Also rotate if size exceeds 100MB
    compress: 'gzip',  // Use built-in gzip compression
    maxFiles: 100,
    maxSize: '5G'
});


morgan.token('instance-info', () => {
    return `${process.env.name || 'unknown'}:${process.env.PORT || 'unknown'}`;
});

// Add a custom token for request headers
morgan.token('req-headers', req => {
    try {
        // Create a copy of headers to avoid exposing sensitive data
        const headers = { ...req.headers };

        // Optionally redact sensitive headers
        if (headers.authorization) {
            headers.authorization = '[REDACTED]';
        }
        if (headers.cookie) {
            headers.cookie = '[REDACTED]';
        }

        return JSON.stringify(headers);
    } catch (err) {
        return '[CANNOT STRINGIFY HEADERS]';
    }
});

// Custom tokens
morgan.token('req-body', req => {
    // Don't log file uploads or large binary data
    if (req.is('multipart/form-data') || req.is('application/octet-stream')) {
        return '[FILE UPLOAD - NOT LOGGED]';
    }

    try {
        return JSON.stringify(req.body);
    } catch (err) {
        return '[CANNOT STRINGIFY BODY]';
    }
});

// Also create a token for response headers
morgan.token('res-headers', (req, res) => {
    try {
        const headers = res.getHeaders ? res.getHeaders() : res._headers || {};
        return JSON.stringify(headers);
    } catch (err) {
        return '[CANNOT STRINGIFY HEADERS]';
    }
});

morgan.token('res-body', (req, res) => {
    // Skip binary responses and TTS responses
    const contentType = res.getHeader ? res.getHeader('content-type') : res._headers?.['content-type'];

    if (contentType && (
        contentType.includes('octet-stream') ||
        contentType.includes('audio') ||
        contentType.includes('video') ||
        contentType.includes('image')
    )) {
        return '[BINARY DATA - NOT LOGGED]';
    }

    // Check if it's a TTS endpoint
    if (req.path && req.path.includes('/tts')) {
        return '[TTS AUDIO DATA - NOT LOGGED]';
    }

    return res._responseBody || '-';
});

morgan.token('file-info', (req) => {
    if (req.file) {
        return JSON.stringify({
            originalname: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });
    }
    return '-';
});

morgan.token('request-id', (req) => req.id);

// Add a custom token for API key identification
morgan.token('api-key-info', (req) => {
    try {
        // Get authorization header
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            // Extract the token
            const token = authHeader.substring(7);

            // Create a safe identifier (first 4 chars + last 4 chars)
            if (token.length > 8) {
                const prefix = token.substring(0, 4);
                const suffix = token.substring(token.length - 4);
                return `${prefix}...${suffix}`;
            } else {
                return 'INVALID_KEY_FORMAT';
            }
        }

        // Check for OpenAI API key in environment
        if (process.env.OPENAI_API_KEY) {
            const key = process.env.OPENAI_API_KEY;
            if (key.length > 8) {
                const prefix = key.substring(0, 4);
                const suffix = key.substring(key.length - 4);
                return `ENV:${prefix}...${suffix}`;
            }
        }

        // Check for ElevenLabs API key in environment
        if (process.env.ELEVENLABS_API_KEY) {
            const key = process.env.ELEVENLABS_API_KEY;
            if (key.length > 8) {
                const prefix = key.substring(0, 4);
                const suffix = key.substring(key.length - 4);
                return `ELEVENLABS:${prefix}...${suffix}`;
            }
        }

        return 'NO_API_KEY_FOUND';
    } catch (err) {
        return 'ERROR_PROCESSING_KEY';
    }
});

// Log format
const logFormat = [
    ':date[iso]',
    'instance::instance-info',
    'reqId::request-id',
    ':method :url',
    'HTTP/:http-version',
    ':status',
    ':response-time ms',
    'IP: :remote-addr',
    'API Key: :api-key-info',
    'User Agent: :user-agent',
    'Request Headers: :req-headers',
    'Request Body: :req-body',
    'Response Headers: :res-headers',
    'Response Body: :res-body',
    'File: :file-info'
].join(' | ');

// Define valid API routes
const validApiRoutes = [
    '/api/chat',
    '/api/transcribe',
    '/api/vision',
    '/api/tts',
    '/api/health',
    '/api/dashboard'
];

// Modified skip function to ensure auth failures are logged
const skipNonApiRoutes = (req, res) => {
    // Get the path from the request
    const path = req.originalUrl || req.url;

    // Skip if it's a TTS route
    if (path && path.includes('/tts')) {
        return true; // Skip logging
    }

    // Skip if content type is binary
    const contentType = res.getHeader ? res.getHeader('content-type') : res._headers?.['content-type'];
    if (contentType && contentType.includes('octet-stream')) {
        return true;
    }

    // Never skip error responses (4xx and 5xx)
    if (res.statusCode >= 400) {
        return false; // Don't skip logging errors
    }

    // Skip if the route doesn't match any of our valid API routes
    if (!validApiRoutes.some(route => path.startsWith(route))) {
        return true; // Skip logging
    }

    return false;
};

module.exports = {
    stream: rotatingLogStream,
    format: logFormat,
    skip: skipNonApiRoutes
};