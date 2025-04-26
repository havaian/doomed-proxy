module.exports = {
    apps: [
        {
            name: 'openai-proxy-dev',
            script: 'index.js',
            instances: 1,               // Match vCPU count
            exec_mode: 'fork',       // Run in cluster mode for load balancing
            watch: false,              // Disable file watching in production
            max_memory_restart: '1G',  // Restart if memory exceeds 2GB for this instance (leaving 2GB buffer overall)
            watch: ["server", "client"],
            // Delay between restart
            watch_delay: 1000,
            ignore_watch : ["node_modules", "client/img", "\\.git", "*.log"],

            // Node.js specific settings
            node_args: [
                '--max-old-space-size=1024',  // 2GB max heap
                '--optimize-for-size',        // Optimize memory over speed
            ],

            // Environment variables
            env_file: '.env',
            env: {
                NODE_ENV: 'production',
                PORT: 18250,
                UV_THREADPOOL_SIZE: 1     // Match vCPU count
            },

            // Error handling
            max_restarts: 10,
            min_uptime: '1m',
            restart_delay: 5000,        // 5 seconds between restarts

            // Logs
            error_file: './logs/error-dev.log',
            out_file: './logs/out-dev.log',
            merge_logs: true,
            log_date_format: 'YYYY-MM-DD HH:mm:ss',

            // Performance monitoring
            metrics: {
                http: true,              // Enable HTTP metrics
                runtime: true,           // Enable runtime metrics
                transaction: false       // Disable detailed transaction tracking to save resources
            }
        }
    ]
};