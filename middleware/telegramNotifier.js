const axios = require('axios');

class TelegramNotifier {
    constructor(config = {}) {
        this.botToken = config.botToken || process.env.TELEGRAM_BOT_TOKEN;
        this.chatId = config.chatId || process.env.TELEGRAM_CHAT_ID;
        this.enabled = Boolean(this.botToken && this.chatId);
        
        // Request volume tracking with thresholds
        this.requestCounts = {};
        this.thresholds = config.thresholds || [ 1, 5, 10, 25, 50, 75, 100, 125, 150, 175, 200, 250, 300, 350, 400, 450, 500 ];
        this.notifiedThresholds = {};
        
        // Rate limit error tracking (for hourly summary only)
        this.rateLimitErrors = {};
        
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
            if (Object.keys(this.requestCounts).length > 0) {
                const totalRequests = Object.values(this.requestCounts).reduce((sum, count) => sum + count, 0);
                
                // Calculate total rate limit errors
                const totalRateLimits = Object.values(this.rateLimitErrors).reduce((sum, count) => sum + count, 0);
                
                // Sort routes by request count in descending order
                const sortedRoutes = Object.entries(this.requestCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5) // Only show top 5 routes
                    .map(([path, count]) => `${path}: ${count}`)
                    .join('\n');
                
                // Add rate limit info if any occurred
                let rateLimitInfo = '';
                if (totalRateLimits > 0) {
                    rateLimitInfo = '\n\n429 Errors:\n' + 
                        Object.entries(this.rateLimitErrors)
                            .sort((a, b) => b[1] - a[1])
                            .map(([path, count]) => `${path}: ${count}`)
                            .join('\n');
                }
                
                const message = `📊 Hourly Summary\n\nInstance: ${process.env.name || 'localhost'}\nHour: ${hour.split(' ')[1]}\nTotal: ${totalRequests}\nRate Limits: ${totalRateLimits}\n\nTop Routes:\n${sortedRoutes}${rateLimitInfo}`;
                
                this.sendMessage(message);
            }
            
            // Reset counters
            this.requestCounts = {};
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
    
    trackRequest(req, res) {
        const path = req.originalUrl || req.url;
        const model = req.body?.model || 'unknown';
        
        // Initialize or increment the counter for this path
        this.requestCounts[path] = (this.requestCounts[path] || 0) + 1;
        
        // Check if we've crossed any thresholds
        for (const threshold of this.thresholds) {
            // If we've just crossed a threshold and haven't notified about it yet
            if (this.requestCounts[path] === threshold && !this.notifiedThresholds[`${path}-${threshold}`]) {
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
                
                this.sendMessage(`⚠️ 429 API Response Alert\n\nInstance: ${process.env.name || 'localhost'}\nRoute: ${path}\nModel: ${model}\nCount: ${threshold}\nReset: ${resetTime}`);
            }
        }
    }
    
    trackRateLimit(req) {
        const path = req.originalUrl || req.url;
        
        // Just count rate limits for hourly summary - no immediate alerts
        this.rateLimitErrors[path] = (this.rateLimitErrors[path] || 0) + 1;
    }
    
    middleware() {
        return (req, res, next) => {
            // Track all requests
            this.trackRequest(req, res);
            
            // Capture the original response methods to track 429s for statistics
            const originalSend = res.send;
            const originalJson = res.json;
            
            // Monitor for 429 status codes (for hourly stats only)
            res.send = function(body) {
                if (res.statusCode === 429) {
                    notifier.trackRateLimit(req);
                }
                return originalSend.call(this, body);
            };
            
            res.json = function(body) {
                if (res.statusCode === 429) {
                    notifier.trackRateLimit(req);
                }
                return originalJson.call(this, body);
            };
            
            next();
        };
    }
}

// Create and export a singleton instance
const notifier = new TelegramNotifier();

module.exports = notifier;