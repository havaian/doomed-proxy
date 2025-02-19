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
    interval: '1d',
    path: logsDir,
    size: '100M',
    compress: 'gzip',
    maxFiles: 100,
    maxSize: '5G'
});

// Custom tokens
morgan.token('req-body', (req) => {
    if (req.body && Object.keys(req.body).length > 0) {
        const sanitizedBody = { ...req.body };
        if (sanitizedBody.messages) {
            sanitizedBody.messages = sanitizedBody.messages.map(msg => ({
                role: msg.role,
                content: msg.content,
            }));
        }
        delete sanitizedBody.api_key;
        delete sanitizedBody.apiKey;
        delete sanitizedBody.authorization;
        delete sanitizedBody.password;
        delete sanitizedBody.token;
        return JSON.stringify(sanitizedBody);
    }
    return '-';
});

morgan.token('res-body', (req, res) => {
    const rawBody = res._responseBody;
    if (rawBody) {
        try {
            const body = JSON.parse(rawBody);
            if (body.choices) {
                body.choices = body.choices.map(choice => ({
                    ...choice,
                    message: {
                        role: choice.message?.role,
                        content: choice.message?.content,
                        ...(choice.message?.refusal && { refusal: choice.message.refusal })
                    }
                }));
            }
            delete body.authorization;
            delete body.token;
            return JSON.stringify(body);
        } catch (e) {
            return rawBody.length > 1000 ? `${rawBody.substring(0, 1000)}...` : rawBody;
        }
    }
    return '-';
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

module.exports = {
    stream: rotatingLogStream,
    format: logFormat
};