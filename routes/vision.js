const express = require('express');
const router = express.Router();
const openaiClient = require('../config/openai');
const multer = require('multer');
const handleUpload = require('../middleware/upload');

// POST endpoint for image-based chat completions
router.post('/vision', (req, res) => {
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
                    message: `❌ Expected field name: 'file' or 'File'`,
                    details: '070'
                });
            } else if (err) {
                console.error('❌ Unknown upload error:', err);
                return res.status(500).json({ 
                    error: '❌ File upload failed',
                    details: '071'
                });
            }

            if (!req.file) {
                return res.status(400).json({ 
                    error: '❌ No image provided',
                    details: '072'
                });
            }

            // Get text prompt from request body
            const prompt = req.body.prompt || 'Describe this image';
            
            // Convert buffer to base64
            const base64Image = req.file.buffer.toString('base64');
            const mimeType = req.file.mimetype || 'image/png';
            
            // Prepare message content with text and image
            const messages = [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: prompt
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType};base64,${base64Image}`
                            }
                        }
                    ]
                }
            ];

            // Prepare request body
            const body = {
                model: req.body.model || 'gpt-4o',
                messages: messages,
                max_tokens: parseInt(req.body.max_tokens) || 300,
                temperature: parseFloat(req.body.temperature) || 0.7
            };

            // Make request to OpenAI
            const response = await openaiClient.post('/chat/completions', body);
            
            if (response.data) {
                res.json(response.data);
            } else {
                console.error('❌ Empty response from OpenAI');
                res.status(400).json({ 
                    error: '❌ No completion generated',
                    details: '073'
                });
            }
        } catch (error) {
            console.error('❌ Vision completion error:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data
            });
            
            res.status(error.response?.status || 500).json({
                error: error.response?.data?.error?.message || error.message,
                details: '074'
            });
        }
    });
});

module.exports = router;