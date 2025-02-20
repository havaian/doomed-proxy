// scripts/monitor-tests.js
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

class APIMonitor {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.testAudioPath = path.join(__dirname, '../test-data/test.wav');
    }

    async testChat() {
        try {
            const start = Date.now();
            const response = await axios.post(`${this.baseUrl}/api/chat`, {
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "user",
                        content: "Test message for monitoring"
                    }
                ],
                temperature: 0.5
            });
            const duration = Date.now() - start;
            console.log(`✅ Chat test successful (${duration}ms)`);
            return { success: true, duration };
        } catch (error) {
            console.error('❌ Chat test failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async testTranscribe() {
        try {
            // Create test audio file if it doesn't exist
            if (!fs.existsSync(this.testAudioPath)) {
                const testDir = path.dirname(this.testAudioPath);
                if (!fs.existsSync(testDir)) {
                    fs.mkdirSync(testDir, { recursive: true });
                }
                // Create a simple WAV file
                const wavHeader = Buffer.from([
                    0x52, 0x49, 0x46, 0x46, // "RIFF"
                    0x24, 0x00, 0x00, 0x00, // Chunk size
                    0x57, 0x41, 0x56, 0x45, // "WAVE"
                    // ... minimal WAV header
                ]);
                fs.writeFileSync(this.testAudioPath, wavHeader);
            }

            const form = new FormData();
            form.append('file', fs.createReadStream(this.testAudioPath));

            const start = Date.now();
            const response = await axios.post(`${this.baseUrl}/api/transcribe`, form, {
                headers: form.getHeaders()
            });
            const duration = Date.now() - start;
            console.log(`✅ Transcribe test successful (${duration}ms)`);
            return { success: true, duration };
        } catch (error) {
            console.error('❌ Transcribe test failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async checkDashboard() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/dashboard`);
            console.log('Current monitoring stats:', JSON.stringify(response.data, null, 2));
            return response.data;
        } catch (error) {
            console.error('❌ Dashboard check failed:', error.message);
            return null;
        }
    }

    async runTests() {
        console.log('🔄 Starting API tests...');
        
        // Run initial dashboard check
        console.log('\n📊 Initial dashboard state:');
        await this.checkDashboard();

        // Run tests
        await this.testChat();
        await this.testTranscribe();

        // Show updated dashboard
        console.log('\n📊 Updated dashboard state:');
        await this.checkDashboard();
    }
}

// If running directly
if (require.main === module) {
    const monitor = new APIMonitor('http://135.181.45.100');
    monitor.runTests();
}

module.exports = APIMonitor;