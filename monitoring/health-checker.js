// monitoring/health-checker.js
const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');

class HealthChecker {
    constructor(baseUrl, logDir) {
        this.baseUrl = baseUrl;
        this.logDir = logDir;
        this.endpoints = [
            '/api/chat',
            '/api/transcribe',
            '/health'
        ];
    }

    async check() {
        const timestamp = new Date().toISOString();
        const results = [];

        for (const endpoint of this.endpoints) {
            try {
                const start = Date.now();
                await axios.get(`${this.baseUrl}${endpoint}`);
                const duration = Date.now() - start;

                results.push({
                    endpoint,
                    status: 'ok',
                    latency: duration,
                    timestamp
                });
            } catch (error) {
                results.push({
                    endpoint,
                    status: 'error',
                    error: error.message,
                    timestamp
                });
            }
        }

        await this.logResults(results);
        return results;
    }

    async logResults(results) {
        const logFile = path.join(this.logDir, `health-${new Date().toISOString().split('T')[0]}.log`);
        const logEntry = JSON.stringify({
            timestamp: new Date().toISOString(),
            checks: results
        }) + '\n';

        await fs.appendFile(logFile, logEntry);
    }
}

module.exports = HealthChecker;