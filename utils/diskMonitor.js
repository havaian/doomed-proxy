const checkDiskSpace = require('check-disk-space').default;
const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');

const monitorDiskSpace = async () => {
    try {
        const diskSpace = await checkDiskSpace('/');
        const usedPercentage = ((diskSpace.size - diskSpace.free) / diskSpace.size) * 100;
        
        if (usedPercentage > 50) {
            console.warn(`⚠️ Disk usage at ${usedPercentage.toFixed(2)}%, cleaning old logs...`);
            
            let deletionError = false;
            // Get all log files sorted by date
            const files = fs.readdirSync(logsDir)
                .filter(file => file.endsWith('.gz'))
                .map(file => ({
                    name: file,
                    path: path.join(logsDir, file),
                    time: fs.statSync(path.join(logsDir, file)).mtime.getTime()
                }))
                .sort((a, b) => a.time - b.time);
            
            // Delete oldest files until we're under 40% usage
            while (files.length > 0) {
                const oldestFile = files.shift();
                try {
                    fs.unlinkSync(oldestFile.path);
                    console.log(`✅ Deleted old log file: ${oldestFile.name}`);
                } catch (err) {
                    console.error(`❌ Failed to delete ${oldestFile.name}:`, err);
                    deletionError = true;
                    continue;
                }
                
                try {
                    const newDiskSpace = await checkDiskSpace('/');
                    const newUsedPercentage = ((newDiskSpace.size - newDiskSpace.free) / newDiskSpace.size) * 100;
                    
                    if (newUsedPercentage < 40 || deletionError) break;
                } catch (err) {
                    console.error('❌ Failed to check disk usage after deletion:', err);
                    break;
                }
            }
        }
    } catch (error) {
        console.error('❌ Error in disk space monitor:', error);
        if (process.env.ADMIN_EMAIL) {
            console.error('❌ Failed to monitor disk space - admin notification required');
        }
    }
};

module.exports = monitorDiskSpace;