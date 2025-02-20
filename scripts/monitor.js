// scripts/monitor.js
const HealthChecker = require('../monitoring/health-checker');
const path = require('path');

const checker = new HealthChecker(
    process.env.API_BASE_URL || 'http://localhost:13029',
    path.join(__dirname, '..', 'logs', 'health')
);

async function runCheck() {
    try {
        const results = await checker.check();
        console.log('Health check completed:', results);
    } catch (error) {
        console.error('Health check failed:', error);
    }
}

if (require.main === module) {
    runCheck();
}

module.exports = runCheck;