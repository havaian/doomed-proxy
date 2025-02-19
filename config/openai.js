const axios = require('axios');

const openaiClient = axios.create({
    baseURL: 'https://api.openai.com/v1',
    timeout: 30000,
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

module.exports = openaiClient;