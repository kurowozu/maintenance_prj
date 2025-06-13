// controllers/maintenanceController.js
const { pool } = require('../config/db');
const { logActivity } = require('./activityLogController');

exports.getAllSchedules = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT ms.*, d.DeviceName, t.FullName AS TechnicianName
            FROM MaintenanceSchedules ms
            LEFT JOIN Devices d ON ms.DeviceID = d.id
            LEFT JOIN Technicians t ON ms.TechnicianID = t.id
            ORDER BY ms.ScheduledDate ASC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getScheduleById = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `
                SELECT ms.*, d.DeviceName, d.SerialNumber, t.FullName AS TechnicianName
                FROM MaintenanceSchedules ms
                LEFT JOIN Devices d ON ms.DeviceID = d.id
                LEFT JOIN Technicians t ON ms.TechnicianID = t.id
                WHERE ms.id = ?
            `,
            [req.params.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Schedule not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.createSchedule = async (req, res) => {
    try {
        const { DeviceID, TechnicianID, MaintenanceType, ScheduledDate, Status, Description, Notes } = req.body;
        const [result] = await pool.query(
            `
                INSERT INTO MaintenanceSchedules (DeviceID, TechnicianID, MaintenanceType, ScheduledDate, Status, Description, Notes, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `,
            [DeviceID, TechnicianID ? TechnicianID : null, MaintenanceType, ScheduledDate, Status || 'pending', Description, Notes]
        );
        const [newSchedule] = await pool.query('SELECT * FROM MaintenanceSchedules WHERE id = ?', [result.insertId]);
        if (req.user) await logActivity(req.user.id, 'CREATE', 'MaintenanceSchedules', result.insertId, `Created maintenance schedule for device ${DeviceID}`);
        res.status(201).json(newSchedule[0]);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.updateSchedule = async (req, res) => {
    try {
        const { DeviceID, TechnicianID, MaintenanceType, ScheduledDate, Status, Description, Notes, CompletedDate } = req.body;
        let updateQuery = `
            UPDATE MaintenanceSchedules
            SET DeviceID = ?, TechnicianID = ?, MaintenanceType = ?, ScheduledDate = ?, Status = ?, Description = ?, Notes = ?, updatedAt = NOW()`;
        let params = [DeviceID, TechnicianID ? TechnicianID : null, MaintenanceType, ScheduledDate, Status, Description, Notes];
        if (Status === 'completed' && CompletedDate) {
            updateQuery += ', CompletedDate = ?';
            params.push(CompletedDate);
        }
        updateQuery += ' WHERE id = ?';
        params.push(req.params.id);
        const [result] = await pool.query(updateQuery, params);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Schedule not found' });
        }
        const [updatedSchedule] = await pool.query('SELECT * FROM MaintenanceSchedules WHERE id = ?', [req.params.id]);
        if (req.user) await logActivity(req.user.id, 'UPDATE', 'MaintenanceSchedules', req.params.id, `Updated maintenance schedule for device ${DeviceID}`);
        res.json(updatedSchedule[0]);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.deleteSchedule = async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM MaintenanceSchedules WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Schedule not found' });
        }
        if (req.user) await logActivity(req.user.id, 'DELETE', 'MaintenanceSchedules', req.params.id, `Deleted maintenance schedule ${req.params.id}`);
        res.json({ message: 'Schedule deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};