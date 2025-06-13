const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { connectDB } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const alertRoutes = require('./routes/alertRoutes');
const technicianRoutes = require('./routes/technicianRoutes');
const userRoutes = require('./routes/userRoutes');
const cookieParser = require('cookie-parser');
const activityLogRoutes = require('./routes/activityLogRoutes');
const reportRoutes = require('./routes/reportRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

// Load environment variables
dotenv.config();

// Khởi tạo ứng dụng
const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// API Routes - phải đặt trước static và route frontend
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/users', userRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Dashboard API
const { pool } = require('./config/db');
app.get('/api/dashboard', async (req, res) => {
    try {
        const [devices] = await pool.query('SELECT * FROM Devices');
        const [alerts] = await pool.query('SELECT * FROM Alerts');
        const [schedules] = await pool.query('SELECT * FROM MaintenanceSchedules');
        res.json({ devices, alerts, schedules });
    } catch (error) {
        console.error('Dashboard API error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// API 404 handler - xử lý API không tồn tại
app.use('/api/*', (req, res) => {
    res.status(404).json({ message: 'API endpoint not found' });
});

// Serve frontend - chỉ cho các route không phải API
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something broke!' });
});

// Khởi động server
const PORT = process.env.PORT || 3000;

// Kết nối database và khởi động server
const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`API Base URL: http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();