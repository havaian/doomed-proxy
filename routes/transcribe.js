const express = require('express');
const router = express.Router();
const multer = require('multer');
const FormData = require('form-data');
const handleUpload = require('../middleware/upload');
const openaiClient = require('../config/openai');

router.post('/transcribe', (req, res) => {
    handleUpload(req, res, async (err) => {
        try {
            if (err instanceof multer.MulterError) {
                console.error('❌ Multer error:', {
                    code: err.code,
                    field: err.field,
                    message: err.message
                });
                return res.status(400).json({ 
                    error: `❌ File upload error: ${err.message}`,
                    details: `❌ Expected field name: 'file' or 'File'`
                });
            } else if (err) {
                console.error('❌ Unknown upload error:', err);
                return res.status(500).json({ error: '❌ File upload failed' });
            }

            if (!req.file) {
                return res.status(400).json({ error: '❌ No audio file provided' });
            }

            const formData = new FormData();
            
            formData.append('file', req.file.buffer, {
                filename: 'audio.wav',
                contentType: req.file.mimetype || 'audio/wav'
            });
            formData.append('model', 'whisper-1');
            
            if (req.body.language) {
                formData.append('language', req.body.language);
            }

            const response = await openaiClient.post('/audio/transcriptions', formData, {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                },
                timeout: 60000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            res.json(response.data);
        } catch (error) {
            console.error('❌ Transcription error:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data
            });
            res.status(error.response?.status || 500).json({
                error: error.response?.data?.error?.message || error.message
            });
        }
    });
});

module.exports = router;