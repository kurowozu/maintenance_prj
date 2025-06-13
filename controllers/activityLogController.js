const { pool } = require('../config/db');

async function logActivity(userId, action, tableName, recordId, details) {
    await pool.query(
        'INSERT INTO activitylog (userId, action, tableName, recordId, details, timestamp) VALUES (?, ?, ?, ?, ?, NOW())',
        [userId, action, tableName, recordId, details]
    );
}

const getActivityLogs = async (req, res) => {
    try {
        const [logs] = await pool.query(`
            SELECT al.id, u.username, al.action, al.tableName, al.recordId, al.details, al.timestamp
            FROM activitylog al
            LEFT JOIN users u ON al.userId = u.id
            ORDER BY al.timestamp DESC
        `);
        res.json(logs);
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { logActivity, getActivityLogs }; 