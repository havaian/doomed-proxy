// routes/health.js
const express = require('express');
const router = express.Router();
const { healthCheck, dashboard } = require('../config/monitoring');

router.get('/health', healthCheck);
router.get('/dashboard', dashboard);

module.exports = router;