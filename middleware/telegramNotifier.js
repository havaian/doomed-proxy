const axios = require('axios');

class TelegramNotifier {
    constructor(config = {}) {
        this.botToken = config.botToken || process.env.TELEGRAM_BOT_TOKEN;
        this.chatId = config.chatId || process.env.TELEGRAM_CHAT_ID;
        this.enabled = Boolean(this.botToken && this.chatId);

        // Request volume tracking with thresholds
        this.errorCounts = {}; // Changed from requestCounts to errorCounts to be more clear
        this.thresholds = config.thresholds || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 25, 50, 75, 100, 125, 150, 175, 200, 250, 300, 350, 400, 450, 500];
        this.notifiedThresholds = {};

        // Rate limit error tracking (for hourly summary only)
        this.rateLimitErrors = {};

        // Track all requests for hourly summary
        this.allRequestCounts = {};

        // Initialize hourly reset
        this.setupHourlyReset();

        if (!this.enabled) {
            console.warn('⚠️ Telegram notifier disabled: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
        } else {
            console.log('✅ Telegram notifier initialized');
        }
    }

    setupHourlyReset() {
        // Reset counters every hour
        const resetCounters = () => {
            const now = new Date();
            const hour = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:00`;

            // Log the hourly stats before resetting
            if (Object.keys(this.allRequestCounts).length > 0) {
                const totalRequests = Object.values(this.allRequestCounts).reduce((sum, count) => sum + count, 0);
                const totalErrors = Object.values(this.errorCounts).reduce((sum, count) => sum + count, 0);

                // Calculate total rate limit errors
                const totalRateLimits = Object.values(this.rateLimitErrors).reduce((sum, count) => sum + count, 0);

                // Sort routes by request count in descending order
                const sortedRoutes = Object.entries(this.allRequestCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5) // Only show top 5 routes
                    .map(([path, count]) => `${path}: ${count}`)
                    .join('\n');

                // Add error info if any occurred
                let errorInfo = '';
                if (totalErrors > 0) {
                    errorInfo = '\n\nError Counts:\n' +
                        Object.entries(this.errorCounts)
                            .sort((a, b) => b[1] - a[1])
                            .map(([path, count]) => `${path}: ${count}`)
                            .join('\n');
                }

                // Add rate limit info if any occurred
                let rateLimitInfo = '';
                if (totalRateLimits > 0) {
                    rateLimitInfo = '\n\n429 Errors:\n' +
                        Object.entries(this.rateLimitErrors)
                            .sort((a, b) => b[1] - a[1])
                            .map(([path, count]) => `${path}: ${count}`)
                            .join('\n');
                }

                const message = `📊 Hourly Summary\n\nInstance: ${process.env.name || 'localhost'}\nHour: ${hour.split(' ')[1]}\nTotal: ${totalRequests}\nErrors: ${totalErrors}\nRate Limits: ${totalRateLimits}\n\nTop Routes:\n${sortedRoutes}${errorInfo}${rateLimitInfo}`;

                this.sendMessage(message);
            }

            // Reset counters
            this.errorCounts = {};
            this.allRequestCounts = {};
            this.notifiedThresholds = {};
            this.rateLimitErrors = {};
        };

        // Calculate time until the next hour
        const now = new Date();
        const nextHour = new Date(now);
        nextHour.setHours(nextHour.getHours() + 1);
        nextHour.setMinutes(0);
        nextHour.setSeconds(0);
        nextHour.setMilliseconds(0);

        const timeUntilNextHour = nextHour - now;

        // Set initial timeout to align with the hour boundary
        setTimeout(() => {
            resetCounters();
            // Then set interval for every hour
            setInterval(resetCounters, 60 * 60 * 1000);
        }, timeUntilNextHour);
    }

    async sendMessage(message) {
        if (!this.enabled) return;

        try {
            const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
            await axios.post(url, {
                chat_id: this.chatId,
                text: message
            });
        } catch (error) {
            console.error('❌ Failed to send Telegram notification:', error.message);
        }
    }

    trackError(req, statusCode) {
        const path = req.originalUrl || req.url;
        const model = req.body?.model || 'unknown';

        // Initialize or increment the counter for this path
        this.errorCounts[path] = (this.errorCounts[path] || 0) + 1;

        // Check if we've crossed any thresholds
        for (const threshold of this.thresholds) {
            // If we've just crossed a threshold and haven't notified about it yet
            if (this.errorCounts[path] === threshold && !this.notifiedThresholds[`${path}-${threshold}`]) {
                this.notifiedThresholds[`${path}-${threshold}`] = true;

                // Calculate next reset time
                const now = new Date();
                const nextHour = new Date(now);
                nextHour.setHours(nextHour.getHours() + 1);
                nextHour.setMinutes(0);
                nextHour.setSeconds(0);
                nextHour.setMilliseconds(0);

                // Format reset time as HH:MM:SS
                const resetTime = nextHour.toTimeString().split(' ')[0];

                this.sendMessage(`⚠️ Error API Response Alert\n\nInstance: ${process.env.name || 'localhost'}\nRoute: ${path}\nModel: ${model}\nStatus: ${statusCode}\nCount: ${threshold}\nReset: ${resetTime}`);
            }
        }
    }

    trackRequest(req) {
        const path = req.originalUrl || req.url;

        // Don't track TTS routes
        if (this.shouldIgnoreRoute(path)) {
            return;
        }

        // Track all requests for statistics
        this.allRequestCounts[path] = (this.allRequestCounts[path] || 0) + 1;
    }

    trackRateLimit(req) {
        const path = req.originalUrl || req.url;

        // Count rate limits for hourly summary
        this.rateLimitErrors[path] = (this.rateLimitErrors[path] || 0) + 1;
    }

    shouldIgnoreRoute(path) {
        // Ignore TTS route as requested
        return path && path.includes('/api/tts');
    }

    middleware() {
        return (req, res, next) => {
            const path = req.originalUrl || req.url;

            // Skip TTS routes completely
            if (this.shouldIgnoreRoute(path)) {
                next();
                return;
            }

            // Track all requests for statistics
            this.trackRequest(req);

            // Add a flag to prevent duplicate tracking
            let errorTracked = false;

            // Capture the original response methods to track non-2xx status codes
            const originalSend = res.send;
            const originalJson = res.json;
            const originalEnd = res.end;

            // Helper function to track error only once
            const trackErrorOnce = () => {
                if (!errorTracked && (res.statusCode < 200 || res.statusCode >= 300) && !this.shouldIgnoreRoute(path)) {
                    errorTracked = true;
                    this.trackError(req, res.statusCode);

                    // Also track rate limits separately
                    if (res.statusCode === 429) {
                        this.trackRateLimit(req);
                    }
                }
            };

            // Monitor for non-2xx status codes
            res.send = function (body) {
                trackErrorOnce();
                return originalSend.call(this, body);
            };

            res.json = function (body) {
                trackErrorOnce();
                return originalJson.call(this, body);
            };

            res.end = function (chunk) {
                trackErrorOnce();
                return originalEnd.call(this, chunk);
            };

            next();
        };
    }
}

// Create and export a singleton instance
const notifier = new TelegramNotifier();

module.exports = notifier;