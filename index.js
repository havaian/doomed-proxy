const express = require('express');
const compression = require('compression');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const morgan = require('morgan');

const instanceKey = process.env.name ? process.env.name.split('-').pop() : 'key1';
console.log(`Loading environment from .env.${instanceKey}`);
require('dotenv').config({ path: `.env.${instanceKey}` });
// require('dotenv').config();

// Import middleware
const captureResponseBody = require('./middleware/capture');
const security = require('./middleware/security');
const filterUserAgent = require('./middleware/userAgentFilter');

// Import config
const logger = require('./config/logger');

// Import utils
const monitorDiskSpace = require('./utils/diskMonitor');

const app = express();

app.set('trust proxy', 1);

console.log(`Instance ${process.env.name || 'unknown'} starting with API key: ${process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 4) + '...' + process.env.OPENAI_API_KEY.substring(process.env.OPENAI_API_KEY.length - 4) : 'undefined'}`);

app.use((req, res, next) => {
    res.setHeader('X-Instance-ID', process.env.name || 'unknown');
    next();
});

// Request ID middleware
app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || uuidv4();
    res.setHeader('x-request-id', req.id);
    next();
});

// Apply security middleware
app.use(security);

// Apply user agent filter middleware
app.use(filterUserAgent);

// Optimize compression for NVMe speed
app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        return req.headers['accept-encoding']?.includes('gzip');
    }
}));

// Body parsing
app.use(express.json({
    limit: '1mb',
    strict: false
}));

// Logging setup
app.use(captureResponseBody);
app.use(morgan(logger.format, {
    stream: logger.stream,
    skip: logger.skip
}));

// Development console logging
if (process.env.NODE_ENV !== 'production') {
    app.use(morgan(logger.format, {
        skip: (req) => req.url === '/health' || logger.skip(req, req.res)
    }));
}

const telegramNotifier = require('./middleware/telegramNotifier');

// Add the telegramNotifier to your app so that the middleware can access it
app.set('telegramNotifier', telegramNotifier);

// Apply the middleware (before route handlers, after parsing)
app.use(telegramNotifier.middleware());

// Import routes
const chatRouter = require('./routes/chat');
const transcribeRouter = require('./routes/transcribe');
const visionRouter = require('./routes/vision');
const healthRouter = require('./routes/health');
const ttsRouter = require('./routes/tts');

// Routes
app.get('/api/test-rate-limit', (req, res) => {
    res.status(429).json({ error: 'Too many requests' });
});

app.use('/api', chatRouter);
app.use('/api', transcribeRouter);
app.use('/api', visionRouter);
app.use('/api', healthRouter);
app.use('/api', ttsRouter);

// Schedule disk space check
cron.schedule('0 * * * *', monitorDiskSpace);

// Start server
const PORT = process.env.PORT || 13029;
app.listen(PORT, '0.0.0.0', () => {
    process.env.UV_THREADPOOL_SIZE = '4';
    console.log(`✅ Server running on port ${PORT}`);
});