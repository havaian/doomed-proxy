const express = require('express');
const compression = require('compression');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const morgan = require('morgan');
require('dotenv').config();

// Import routes
const chatRouter = require('./routes/chat');
const transcribeRouter = require('./routes/transcribe');

// Import middleware
const captureResponseBody = require('./middleware/capture');
const security = require('./middleware/security');

// Import config
const logger = require('./config/logger');

// Import utils
const monitorDiskSpace = require('./utils/diskMonitor');

const app = express();

// Request ID middleware
app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || uuidv4();
    res.setHeader('x-request-id', req.id);
    next();
});

// Apply security middleware
app.use(security);

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
app.use(morgan(logger.format, { stream: logger.stream }));

// Development console logging
if (process.env.NODE_ENV !== 'production') {
    app.use(morgan(logger.format, {
        skip: (req) => req.url === '/health'
    }));
}

// Routes
app.use('/api', chatRouter);
app.use('/api', transcribeRouter);

// Schedule disk space check
cron.schedule('0 * * * *', monitorDiskSpace);

// Start server
const PORT = process.env.PORT || 13029;
app.listen(PORT, '0.0.0.0', () => {
    process.env.UV_THREADPOOL_SIZE = '4';  // Match vCPU count
    console.log(`✅ Server running on port ${PORT}`);
});