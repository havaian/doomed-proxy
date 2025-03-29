// middleware/userAgentFilter.js
const filterUserAgent = (req, res, next) => {
    const userAgent = req.headers['user-agent'];
    
    // Allow if user-agent is empty or not present
    if (!userAgent || userAgent.trim() === '') {
        return next();
    }
    
    // Allow specific user agents (Unity and Postman)
    if (userAgent.includes('UnityPlayer') || userAgent.includes('PostmanRuntime')) {
        return next();
    }
    
    // Block all other user agents
    console.error('❌ Access denied - unauthorized user agent:', {
        ip: req.ip,
        userAgent: userAgent,
        path: req.path
    });
    
    return res.status(403).json({
        error: 'Access denied',
        message: 'This API endpoint requires an authorized user-agent'
    });
};

module.exports = filterUserAgent;