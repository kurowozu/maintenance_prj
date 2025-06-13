const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const authenticateToken = require('../middleware/auth');

// GET /api/dashboard
router.get('/', authenticateToken, async (req, res) => {
    try {
        // Đếm số lượng thiết bị theo trạng thái
        const [[{ totalDevices }]] = await pool.query('SELECT COUNT(*) as totalDevices FROM Devices');
        const [[{ activeDevices }]] = await pool.query("SELECT COUNT(*) as activeDevices FROM Devices WHERE LOWER(Status) = 'active'");
        const [[{ maintenanceDevices }]] = await pool.query("SELECT COUNT(*) as maintenanceDevices FROM Devices WHERE LOWER(Status) = 'maintenance'");
        // Lấy danh sách thiết bị, cảnh báo, lịch bảo trì như cũ
        const [devices] = await pool.query('SELECT * FROM Devices');
        const [alerts] = await pool.query('SELECT * FROM Alerts');
        const [schedules] = await pool.query('SELECT * FROM MaintenanceSchedules');
        res.json({
            totalDevices,
            activeDevices,
            maintenanceDevices,
            devices,
            alerts,
            schedules
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router; 