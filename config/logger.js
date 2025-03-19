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
    interval: '30d',    // Rotate daily
    path: logsDir,
    size: '100M',      // Also rotate if size exceeds 100MB
    compress: 'gzip',  // Use built-in gzip compression
    maxFiles: 100,
    maxSize: '5G'
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

// Log format
const logFormat = [
    ':date[iso]',
    'reqId::request-id',
    ':method :url',
    'HTTP/:http-version',
    ':status',
    ':response-time ms',
    'IP: :remote-addr',
    'User Agent: :user-agent',
    'Request Body: :req-body',
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

// Skip function to avoid logging requests that don't match our API routes
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