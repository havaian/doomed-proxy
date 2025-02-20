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
morgan.token('req-body', req => JSON.stringify(req.body));
morgan.token('res-body', (req, res) => res._responseBody || '-');

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

module.exports = {
    stream: rotatingLogStream,
    format: logFormat
};