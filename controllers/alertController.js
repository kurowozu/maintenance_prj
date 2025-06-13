// controllers/alertController.js
const { pool } = require('../config/db');
const { logActivity } = require('./activityLogController');

exports.getAlerts = async (req, res) => {
    try {
        const query = `
            SELECT a.*, d.DeviceName, d.SerialNumber
            FROM Alerts a
            LEFT JOIN Devices d ON a.DeviceID = d.id
            ORDER BY a.createdAt DESC
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getAlertById = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `
                SELECT a.*, d.DeviceName, d.SerialNumber
                FROM Alerts a
                LEFT JOIN Devices d ON a.DeviceID = d.id
                WHERE a.id = ?
            `,
            [req.params.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Alert not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.resolveAlert = async (req, res) => {
    try {
        const { notes } = req.body;
        const [result] = await pool.query(
            'UPDATE Alerts SET IsResolved = 1, Notes = ?, updatedAt = NOW() WHERE id = ?',
            [notes, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Alert not found' });
        }
        const [rows] = await pool.query('SELECT * FROM Alerts WHERE id = ?', [req.params.id]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.createAlert = async (req, res) => {
    try {
        const { DeviceID, Message, Severity } = req.body;
        const [result] = await pool.query(
            'INSERT INTO Alerts (DeviceID, Message, Severity, createdAt, updatedAt) VALUES (?, ?, ?, NOW(), NOW())',
            [DeviceID, Message, Severity]
        );
        const [newAlert] = await pool.query('SELECT * FROM Alerts WHERE id = ?', [result.insertId]);
        res.status(201).json(newAlert[0]);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.deleteAlert = async (req, res) => {
    try {
        const alertId = req.params.id;
        // Lấy DeviceID trước khi xóa
        const [alert] = await pool.query('SELECT * FROM Alerts WHERE id = ?', [alertId]);
        if (alert.length === 0) {
            return res.status(404).json({ message: 'Alert not found' });
        }
        const deviceId = alert[0].DeviceID;
        // Xóa alert
        const [result] = await pool.query('DELETE FROM Alerts WHERE id = ?', [alertId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Failed to delete alert' });
        }
        // Cập nhật status device thành active
        if (deviceId) {
            await pool.query('UPDATE Devices SET Status = ? WHERE id = ?', ['active', deviceId]);
        }
        // Log activity
        if (req.user) await logActivity(req.user.id, 'DELETE', 'Alerts', alertId, `Deleted alert for device ${deviceId}`);
        res.json({ message: 'Alert deleted successfully' });
    } catch (err) {
        console.error('Error deleting alert:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.updateAlert = async (req, res) => {
    try {
        const alertId = req.params.id;
        const { DeviceID, Message, Severity, Notes, IsResolved } = req.body;
        // Kiểm tra alert có tồn tại không
        const [alert] = await pool.query('SELECT * FROM Alerts WHERE id = ?', [alertId]);
        if (alert.length === 0) {
            return res.status(404).json({ message: 'Alert not found' });
        }
        // Cập nhật alert
        const [result] = await pool.query(
            'UPDATE Alerts SET DeviceID = ?, Message = ?, Severity = ?, Notes = ?, IsResolved = ?, updatedAt = NOW() WHERE id = ?',
            [DeviceID || alert[0].DeviceID, Message || alert[0].Message, Severity || alert[0].Severity, Notes || alert[0].Notes, typeof IsResolved === 'undefined' ? alert[0].IsResolved : IsResolved, alertId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Alert not found' });
        }
        const [updatedAlert] = await pool.query('SELECT * FROM Alerts WHERE id = ?', [alertId]);
        // Log activity
        if (req.user) await logActivity(req.user.id, 'UPDATE', 'Alerts', alertId, `Updated alert for device ${DeviceID || alert[0].DeviceID}`);
        res.json(updatedAlert[0]);
    } catch (err) {
        console.error('Error updating alert:', err);
        res.status(500).json({ message: err.message });
    }
};