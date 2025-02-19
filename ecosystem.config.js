module.exports = {
    apps: [{
        name: 'openai-proxy',
        script: 'index.js',
        instances: 4,               // Match vCPU count
        exec_mode: 'cluster',       // Run in cluster mode for load balancing
        watch: false,              // Disable file watching in production
        max_memory_restart: '6G',  // Restart if memory exceeds 6GB (leaving 2GB buffer)

        // Node.js specific settings
        node_args: [
            '--max-old-space-size=6144',  // 6GB max heap
            '--optimize-for-size',        // Optimize memory over speed
        ],

        // Environment variables
        env: {
            NODE_ENV: 'production',
            PORT: 8000,
            UV_THREADPOOL_SIZE: 4     // Match vCPU count
        },

        // Error handling
        max_restarts: 10,
        min_uptime: '1m',
        restart_delay: 5000,        // 5 seconds between restarts

        // Logs
        error_file: './logs/error.log',
        out_file: './logs/out.log',
        merge_logs: true,
        log_date_format: 'YYYY-MM-DD HH:mm:ss',

        // Performance monitoring
        metrics: {
            http: true,              // Enable HTTP metrics
            runtime: true,           // Enable runtime metrics
            transaction: false       // Disable detailed transaction tracking to save resources
        }
    }]
};