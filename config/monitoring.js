// config/monitoring.js
const EventEmitter = require('events');

// Create metrics object first
const metrics = {
    startTime: Date.now(),
    endpoints: {
        '/api/chat': {
            requests: 0,
            errors: 0,
            totalLatency: 0,
            lastCheck: null,
            status: 'unknown'
        },
        '/api/transcribe': {
            requests: 0,
            errors: 0,
            totalLatency: 0,
            lastCheck: null,
            status: 'unknown'
        },
        '/api/vision': {
            requests: 0,
            errors: 0,
            totalLatency: 0,
            lastCheck: null,
            status: 'unknown'
        },
        '/api/tts': {
            requests: 0,
            errors: 0,
            totalLatency: 0,
            lastCheck: null,
            status: 'unknown'
        },
        '/health': {
            requests: 0,
            errors: 0,
            totalLatency: 0,
            lastCheck: null,
            status: 'unknown'
        }
    }
};

const monitoringEmitter = new EventEmitter();

// Monitor middleware
const monitorRequest = (req, res, next) => {
    const start = Date.now();
    const path = req.path;

    // Ensure endpoint exists in metrics
    if (!metrics.endpoints[path]) {
        metrics.endpoints[path] = {
            requests: 0,
            errors: 0,
            totalLatency: 0,
            lastCheck: null,
            status: 'unknown'
        };
    }

    // Update metrics after response
    res.on('finish', () => {
        const duration = Date.now() - start;
        const endpoint = metrics.endpoints[path];

        endpoint.requests++;
        endpoint.totalLatency += duration;
        endpoint.lastCheck = new Date().toISOString();
        endpoint.status = res.statusCode >= 400 ? 'error' : 'ok';

        if (res.statusCode >= 400) {
            endpoint.errors++;
        }

        monitoringEmitter.emit('request', {
            path,
            duration,
            status: res.statusCode,
            timestamp: new Date().toISOString()
        });
    });

    next();
};

// Health check route handler
const healthCheck = (req, res) => {
    const uptime = Date.now() - metrics.startTime;
    const status = Object.values(metrics.endpoints)
        .every(e => e.status === 'ok' || e.status === 'unknown');

    res.json({
        status: status ? 'healthy' : 'unhealthy',
        uptime: Math.floor(uptime / 1000),
        endpoints: Object.entries(metrics.endpoints).map(([path, data]) => ({
            path,
            status: data.status,
            lastCheck: data.lastCheck,
            successRate: data.requests ?
                ((data.requests - data.errors) / data.requests * 100).toFixed(2) + '%' :
                'N/A',
            avgLatency: data.requests ?
                (data.totalLatency / data.requests).toFixed(2) + 'ms' :
                'N/A'
        }))
    });
};

// Dashboard route handler
const dashboard = (req, res) => {
    res.json({
        uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
        endpoints: metrics.endpoints
    });
};

module.exports = {
    metrics,
    monitoringEmitter,
    monitorRequest,
    healthCheck,
    dashboard
};