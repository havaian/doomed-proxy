const axios = require('axios');

// Create the OpenAI client
const openaiClient = axios.create({
    baseURL: 'https://api.openai.com/v1',
    timeout: 15000, // Changed from 30000 to 15000 (15 seconds)
    headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=5'
    },
    httpAgent: new require('http').Agent({
        keepAlive: true,
        maxSockets: 2000,
        maxFreeSockets: 200,
        timeout: 60000,
        keepAliveMsecs: 1000
    })
});

// Add response interceptor for retry logic
openaiClient.interceptors.response.use(
    // Success handler - just return the response
    (response) => response, 
    
    // Error handler with retry logic
    (err) => {
        const { config, message } = err;
        
        // If no config or retry not set, reject immediately
        if (!config || config.retry === undefined) {
            // Set default retry values for all requests
            if (config) {
                config.retry = 3;
                config.retryDelay = 2000;
            } else {
                return Promise.reject(err);
            }
        }
        
        // Only retry on timeout or network errors
        if (!(message.includes("timeout") || message.includes("Network Error"))) {
            return Promise.reject(err);
        }
        
        // If we have retries left, decrement and try again
        if (config.retry > 0) {
            config.retry -= 1;
            
            console.error(`❌ Request failed (${message}). Retrying (${3 - config.retry}/3): ${config.url}`);
            
            // Create a delay using Promise
            const delayRetryRequest = new Promise((resolve) => {
                setTimeout(() => {
                    resolve();
                }, config.retryDelay || 1000);
            });
            
            // Return the promise chain with delay then retry
            return delayRetryRequest.then(() => {
                return openaiClient(config);
            });
        }
        
        // No retries left, reject with the error
        return Promise.reject(err);
    }
);

// Add request interceptor to set default retry parameters
openaiClient.interceptors.request.use((config) => {
    // Set default retry configuration if not already set
    if (config.retry === undefined) {
        config.retry = 1;
        config.retryDelay = 2000;
    }
    return config;
});

module.exports = openaiClient;