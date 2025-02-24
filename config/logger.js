const morgan = require('morgan');
const rfs = require('rotating-file-stream');
const path = require('path');
const fs = require('fs');

// Set up logging directory
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Log rotation settings
const rotatingLogStream = rfs.createStream('access.log', {
    interval: '1d',    // Rotate daily
    path: logsDir,
    compress: (source, dest) => {
        // Custom compression to ensure single archive
        const gzip = require('zlib').createGzip();
        const sourceStream = fs.createReadStream(source);
        const destStream = fs.createWriteStream(dest);
        
        return new Promise((resolve, reject) => {
            sourceStream
                .pipe(gzip)
                .pipe(destStream)
                .on('finish', () => {
                    fs.unlink(source, resolve);
                })
                .on('error', reject);
        });
    },
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

// Skip function to completely avoid logging certain requests
const skipBinaryResponses = (req, res) => {
    // Option 1: Skip logging TTS routes completely
    if (req.path && req.path.includes('/tts')) {
        return true; // Skip logging
    }
    
    // Option 2: Skip based on response content type
    const contentType = res.getHeader ? res.getHeader('content-type') : res._headers?.['content-type'];
    if (contentType && contentType.includes('octet-stream')) {
        return true;
    }
    
    return false;
};

module.exports = {
    stream: rotatingLogStream,
    format: logFormat,
    skip: skipBinaryResponses
};