const axios = require('axios');
const axiosRetry = require('axios-retry');

const openaiClient = axios.create({
    baseURL: 'https://api.openai.com/v1',
    timeout: 15000, // 15 seconds
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

// Configure retry behavior
axiosRetry(openaiClient, {
    retries: 1, // Number of retry attempts
    retryDelay: axiosRetry.exponentialDelay, // Exponential backoff
    retryCondition: (error) => {
        // Retry on timeout errors, network errors, and 5xx responses
        return (
            error.code === 'ECONNABORTED' || // Timeout
            axiosRetry.isNetworkError(error) || // Network errors
            (error.response && error.response.status >= 500) // Server errors
        );
    },
    shouldResetTimeout: true, // Reset timeout between retries
});

// Log retry attempts
openaiClient.interceptors.response.use(undefined, async (error) => {
    const config = error.config;
    
    if (config && config['axios-retry'] && config['axios-retry'].retryCount > 0) {
        console.error(`Retry attempt ${config['axios-retry'].retryCount} for request to ${config.url}`);
    }
    
    return Promise.reject(error);
});

module.exports = openaiClient;