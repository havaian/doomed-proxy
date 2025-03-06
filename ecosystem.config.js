module.exports = {
    apps: [
        {
            name: 'openai-proxy-key1',
            script: 'index.js',
            instances: 2,               // Match vCPU count
            exec_mode: 'cluster',       // Run in cluster mode for load balancing
            watch: false,              // Disable file watching in production
            max_memory_restart: '2G',  // Restart if memory exceeds 2GB for this instance (leaving 2GB buffer overall)

            // Node.js specific settings
            node_args: [
                '--max-old-space-size=2048',  // 2GB max heap
                '--optimize-for-size',        // Optimize memory over speed
            ],

            // Environment variables
            env_file: '.env.key1',
            env: {
                NODE_ENV: 'production',
                PORT: 13029,
                UV_THREADPOOL_SIZE: 2     // Match vCPU count
            },

            // Error handling
            max_restarts: 10,
            min_uptime: '1m',
            restart_delay: 5000,        // 5 seconds between restarts

            // Logs
            error_file: './logs/error-key1.log',
            out_file: './logs/out-key1.log',
            merge_logs: true,
            log_date_format: 'YYYY-MM-DD HH:mm:ss',

            // Performance monitoring
            metrics: {
                http: true,              // Enable HTTP metrics
                runtime: true,           // Enable runtime metrics
                transaction: false       // Disable detailed transaction tracking to save resources
            }
        },
        {
            name: 'openai-proxy-key2',
            script: 'index.js',
            instances: 2,               // Match vCPU count
            exec_mode: 'cluster',       // Run in cluster mode for load balancing
            watch: false,              // Disable file watching in production
            max_memory_restart: '2G',  // Restart if memory exceeds 2GB for this instance (leaving 2GB buffer overall)

            // Node.js specific settings
            node_args: [
                '--max-old-space-size=2048',  // 2GB max heap
                '--optimize-for-size',        // Optimize memory over speed
            ],

            // Environment variables
            env_file: '.env.key2',
            env: {
                NODE_ENV: 'production',
                PORT: 13030,
                UV_THREADPOOL_SIZE: 2     // Match vCPU count
            },

            // Error handling
            max_restarts: 10,
            min_uptime: '1m',
            restart_delay: 5000,        // 5 seconds between restarts

            // Logs
            error_file: './logs/error-key2.log',
            out_file: './logs/out-key2.log',
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