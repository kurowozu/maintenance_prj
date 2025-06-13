const express = require('express');
const router = express.Router();
const { getActivityLogs } = require('../controllers/activityLogController');

// Get activity logs (admin only)
router.get('/', getActivityLogs);

module.exports = router; 