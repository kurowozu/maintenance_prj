const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const bcrypt = require('bcrypt');

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Query user by username only
        const [users] = await pool.query('SELECT * FROM Users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = users[0];

        // Compare provided password with stored hashed password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '1h' }
        );

        res.cookie('authToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 3600000
        });

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.verifyToken = async (req, res) => {
    try {
        const token = req.cookies.authToken || req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token provided' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

        const [users] = await pool.query('SELECT id, username, role FROM Users WHERE id = ?', [decoded.id]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        res.json({ user: users[0] });

    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

exports.logout = (req, res) => {
    res.clearCookie('authToken');
    res.json({ message: 'Logged out successfully' });
};
