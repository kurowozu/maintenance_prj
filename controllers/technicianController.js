const { pool } = require('../config/db');
const { logActivity } = require('./activityLogController');

const getAllTechnicians = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM Technicians');
        // Map PhoneNumber to Phone for frontend compatibility and handle NULL or empty values
        const mappedRows = rows.map(row => ({
            ...row,
            Phone: row.PhoneNumber && row.PhoneNumber.trim() !== '' ? row.PhoneNumber : 'Chưa có số điện thoại'
        }));
        res.json(mappedRows);
    } catch (error) {
        console.error('Error fetching technicians:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getTechnicianById = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM Technicians WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Technician not found' });
        const technician = rows[0];
        technician.Phone = technician.PhoneNumber && technician.PhoneNumber.trim() !== '' ? technician.PhoneNumber : 'Chưa có số điện thoại';
        res.json(technician);
    } catch (error) {
        console.error('Error fetching technician:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const createTechnician = async (req, res) => {
    const { FullName, Specialization, PhoneNumber, Address, HireDate } = req.body;
    try {
        // Check if PhoneNumber already exists
        const [existing] = await pool.query('SELECT id FROM Technicians WHERE PhoneNumber = ?', [PhoneNumber]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Số điện thoại đã tồn tại' });
        }
        const [result] = await pool.query(
            'INSERT INTO Technicians (FullName, Specialization, PhoneNumber, Address, HireDate) VALUES (?, ?, ?, ?, ?)',
            [FullName, Specialization, PhoneNumber, Address, HireDate]
        );
        if (req.user) await logActivity(req.user.id, 'CREATE', 'Technicians', result.insertId, `Created technician: ${FullName}`);
        res.status(201).json({ id: result.insertId, message: 'Technician created' });
    } catch (error) {
        console.error('Error creating technician:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updateTechnician = async (req, res) => {
    const { id } = req.params;
    let { FullName, Specialization, PhoneNumber, Address, HireDate } = req.body;
    if (PhoneNumber == null) {
        PhoneNumber = '';
    }
    try {
        const [result] = await pool.query(
            'UPDATE Technicians SET FullName = ?, Specialization = ?, PhoneNumber = ?, Address = ?, HireDate = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE id = ?',
            [FullName, Specialization, PhoneNumber, Address, HireDate, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Technician not found' });
        if (req.user) await logActivity(req.user.id, 'UPDATE', 'Technicians', id, `Updated technician: ${FullName}`);
        res.json({ message: 'Technician updated' });
    } catch (error) {
        console.error('Error updating technician:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const deleteTechnician = async (req, res) => {
    const { id } = req.params;
    try {
        // Set NULL cho các schedule liên quan
        await pool.query('UPDATE MaintenanceSchedules SET TechnicianID = NULL WHERE TechnicianID = ?', [id]);
        // Set NULL cho các thiết bị đang gán technician này
        await pool.query('UPDATE Devices SET assignedTechnician = NULL WHERE assignedTechnician = ?', [id]);
        // Xóa technician
        const [result] = await pool.query('DELETE FROM Technicians WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Technician not found' });
        if (req.user) await logActivity(req.user.id, 'DELETE', 'Technicians', id, `Deleted technician: ${id}`);
        res.json({ message: 'Technician deleted' });
    } catch (error) {
        console.error('Error deleting technician:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getAllTechnicians, getTechnicianById, createTechnician, updateTechnician, deleteTechnician };