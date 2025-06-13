const { pool } = require('../config/db');
const bcrypt = require('bcrypt');
const { logActivity } = require('./activityLogController');

exports.getAllUsers = async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, username, email, role, createdAt FROM Users');
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { username, fullName, email, password, role } = req.body;

        // Check if user already exists
        const [existingUsers] = await pool.query('SELECT * FROM Users WHERE username = ? OR email = ?', [username, email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        const [result] = await pool.query(
            'INSERT INTO Users (username, fullName, email, password, role) VALUES (?, ?, ?, ?, ?)',
            [username, fullName, email, hashedPassword, role]
        );

        // Log activity
        await logActivity(
            req.user.id,
            'CREATE',
            'Users',
            result.insertId,
            `Created user: ${username}`
        );

        res.status(201).json({ id: result.insertId, message: 'User created successfully' });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { username, email, role } = req.body;
        const userId = req.params.id;

        // Check if user exists
        const [existingUser] = await pool.query('SELECT * FROM Users WHERE id = ?', [userId]);
        if (existingUser.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update user
        await pool.query(
            'UPDATE Users SET username = ?, email = ?, role = ? WHERE id = ?',
            [username, email, role, userId]
        );

        // Log activity
        await logActivity(
            req.user.id,
            'UPDATE',
            'Users',
            userId,
            `Updated user: ${username}`
        );

        res.json({ message: 'User updated successfully' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;

        // Get user info before deletion for logging
        const [user] = await pool.query('SELECT username FROM Users WHERE id = ?', [userId]);
        if (user.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Delete user
        await pool.query('DELETE FROM Users WHERE id = ?', [userId]);

        // Log activity
        await logActivity(
            req.user.id,
            'DELETE',
            'Users',
            userId,
            `Deleted user: ${user[0].username}`
        );

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Server error' });
    }
};