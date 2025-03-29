// middleware/telegramNotifier.js
const axios = require('axios');

class TelegramNotifier {
    constructor(config = {}) {
        this.botToken = config.botToken || process.env.TELEGRAM_BOT_TOKEN;
        this.chatId = config.chatId || process.env.TELEGRAM_CHAT_ID;
        this.enabled = Boolean(this.botToken && this.chatId);
        
        // Error tracking
        this.rateLimitErrors = 0;
        this.lastRateLimitNotification = 0;
        
        // Request volume tracking
        this.requestCounts = {};
        this.thresholds = config.thresholds || [1, 10, 50, 100];
        this.notifiedThresholds = {};
        
        // Initialize hourly reset
        this.setupHourlyReset();
        
        if (!this.enabled) {
            console.warn('⚠️ Telegram notifier disabled: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
        } else {
            console.log('✅ Telegram notifier initialized');
            // Send startup notification
            this.sendMessage(`🚀 API Server started: ${process.env.name || 'unknown'}`);
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
                const message = `📊 Hourly stats (${hour}):\nTotal requests: ${totalRequests}\n` + 
                    Object.entries(this.requestCounts)
                        .map(([path, count]) => `- ${path}: ${count}`)
                        .join('\n');
                
                this.sendMessage(message);
            }
            
            // Reset counters
            this.requestCounts = {};
            this.notifiedThresholds = {};
            this.rateLimitErrors = 0;
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
                text: message,
                parse_mode: 'Markdown'
            });
        } catch (error) {
            console.error('❌ Failed to send Telegram notification:', error.message);
        }
    }
    
    trackRequest(req) {
        const path = req.originalUrl || req.url;
        // Extract the base path (e.g., /api/chat from /api/chat?param=value)
        const basePath = path;
        
        // Initialize or increment the counter for this path
        this.requestCounts[basePath] = (this.requestCounts[basePath] || 0) + 1;
        
        // Check if we've crossed any thresholds
        for (const threshold of this.thresholds) {
            // If we've just crossed a threshold and haven't notified about it yet
            if (this.requestCounts[basePath] === threshold && !this.notifiedThresholds[`${basePath}-${threshold}`]) {
                this.notifiedThresholds[`${basePath}-${threshold}`] = true;
                this.sendMessage(`🔔 Request volume alert: *${basePath}* has reached *${threshold}* requests this hour`);
            }
        }
    }
    
    trackRateLimit(req) {
        this.rateLimitErrors++;
        
        // Throttle notifications to avoid spam (max 1 per 5 minutes)
        const now = Date.now();
        if (now - this.lastRateLimitNotification > 5 * 60 * 1000) {
            this.lastRateLimitNotification = now;
            
            const path = req.originalUrl || req.url;
            const model = req.body?.model || 'unknown';
            
            this.sendMessage(`⚠️ *RATE LIMIT ERROR*\nPath: ${path}\nModel: ${model}\nCount this hour: ${this.rateLimitErrors}`);
        }
    }
    
    middleware() {
        return (req, res, next) => {
            // Track the request
            this.trackRequest(req);
            
            // Check for rate limit responses
            const originalSend = res.send;
            res.send = function(body) {
                // Check if this is a rate limit error
                const isRateLimit = res.statusCode === 429;
                
                if (isRateLimit) {
                    const notifier = req.app.get('telegramNotifier');
                    if (notifier) {
                        notifier.trackRateLimit(req);
                    }
                }
                
                return originalSend.call(this, body);
            };
            
            next();
        };
    }
}

// Create and export a singleton instance
const notifier = new TelegramNotifier();

module.exports = notifier;