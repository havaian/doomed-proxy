const axios = require('axios');

class TelegramNotifier {
    constructor(config = {}) {
        this.botToken = config.botToken || process.env.TELEGRAM_BOT_TOKEN;
        this.chatId = config.chatId || process.env.TELEGRAM_CHAT_ID;
        this.enabled = Boolean(this.botToken && this.chatId);
        
        // Error tracking
        this.rateLimitErrors = {};
        
        // Request volume tracking
        this.requestCounts = {};
        this.thresholds = config.thresholds || [1, 5, 10, 25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
        this.notifiedThresholds = {};
        
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
    
    // Escape special characters for Markdown
    escapeMarkdown(text) {
        return text.toString()
            .replace(/_/g, '\\_')
            .replace(/\*/g, '\\*')
            .replace(/\[/g, '\\[')
            .replace(/\]/g, '\\]')
            .replace(/\(/g, '\\(')
            .replace(/\)/g, '\\)')
            .replace(/~/g, '\\~')
            .replace(/`/g, '\\`')
            .replace(/#/g, '\\#')
            .replace(/\+/g, '\\+')
            .replace(/-/g, '\\-')
            .replace(/=/g, '\\=')
            .replace(/\|/g, '\\|')
            .replace(/\{/g, '\\{')
            .replace(/\}/g, '\\}')
            .replace(/\./g, '\\.')
            .replace(/!/g, '\\!');
    }
    
    async sendMessage(message, useMarkdown = false) {
        if (!this.enabled) return;
        
        try {
            const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
            
            // Process message based on format mode
            let processedMessage = message;
            let parseMode = undefined;
            
            if (useMarkdown) {
                parseMode = 'MarkdownV2';
                // If markdown is desired, escape special characters
                processedMessage = this.escapeMarkdown(message);
            }
            
            await axios.post(url, {
                chat_id: this.chatId,
                text: processedMessage,
                parse_mode: parseMode
            });
        } catch (error) {
            console.error('❌ Failed to send Telegram notification:', error.message);
            
            // If it was a parsing error and we were using markdown, retry with plain text
            if (useMarkdown && error.response?.data?.description?.includes("can't parse entities")) {
                console.log('⚠️ Retrying notification without markdown');
                this.sendMessage(message, false);
            }
        }
    }
    
    trackRequest(req, res) {
        const path = req.originalUrl || req.url;
        const model = req.body?.model || 'unknown';
        
        // Initialize or increment the counter for this path
        this.requestCounts[path] = (this.requestCounts[path] || 0) + 1;
        
        // Calculate next reset time
        const now = new Date();
        const nextHour = new Date(now);
        nextHour.setHours(nextHour.getHours() + 1);
        nextHour.setMinutes(0);
        nextHour.setSeconds(0);
        nextHour.setMilliseconds(0);
        
        // Format reset time as HH:MM:SS
        const resetTime = nextHour.toTimeString().split(' ')[0];
        
        // Check if we've crossed any thresholds
        for (const threshold of this.thresholds) {
            // If we've just crossed a threshold and haven't notified about it yet
            if (this.requestCounts[path] === threshold && !this.notifiedThresholds[`${path}-${threshold}`]) {
                this.notifiedThresholds[`${path}-${threshold}`] = true;
                
                this.sendMessage(`⚠️ 429 API Response Alert\n\nInstance: ${process.env.name || 'localhost'}\nRoute: ${path}\nModel: ${model}\nCount: ${threshold}\nReset: ${resetTime}`);
            }
        }
    }
    
    trackRateLimit(req, res) {
        const path = req.originalUrl || req.url;
        
        // Increment the counter for this path
        this.rateLimitErrors[path] = (this.rateLimitErrors[path] || 0) + 1;
    }
    
    trackError(err, req) {
        if (!this.enabled) return;
        
        const path = req.originalUrl || req.url;
        const model = req.body?.model || 'unknown';
        const statusCode = err.response?.status || 'N/A';
        
        this.sendMessage(`❌ Error Alert\nInstance: ${process.env.name || 'localhost'}\nRoute: ${path}\nModel: ${model}\nStatus: ${statusCode}`);
    }
    
    middleware() {
        return (req, res, next) => {
            // Track the request
            this.trackRequest(req, res);
            
            // Intercept response to detect rate limits
            const originalSend = res.send;
            const originalJson = res.json;
            
            res.send = function(body) {
                // Check for rate limit errors
                if (res.statusCode === 429) {
                    notifier.trackRateLimit(req, res);
                }
                return originalSend.call(this, body);
            };
            
            res.json = function(body) {
                // Check for rate limit errors
                if (res.statusCode === 429) {
                    notifier.trackRateLimit(req, res);
                }
                return originalJson.call(this, body);
            };
            
            next();
        };
    }
    
    // Error handler middleware
    errorHandler() {
        return (err, req, res, next) => {
            this.trackError(err, req);
            next(err);
        };
    }
}

// Create and export a singleton instance
const notifier = new TelegramNotifier();

module.exports = notifier;