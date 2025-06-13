const { pool } = require('../config/db');
const { logActivity } = require('./activityLogController');

exports.getAllDevices = async (req, res) => {
    try {
        const [devices] = await pool.query(`
            SELECT 
                d.*,
                t.fullName AS technicianName,
                COALESCE(d.Status, 'unknown') as Status,
                COALESCE(d.Location, 'unspecified') as Location
            FROM Devices d
            LEFT JOIN Technicians t ON d.assignedTechnician = t.id
            ORDER BY d.id DESC
        `);
        res.json(devices);
    } catch (error) {
        console.error('Error fetching devices:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getDeviceById = async (req, res) => {
    try {
        const [devices] = await pool.query(`
            SELECT 
                d.*,
                t.fullName AS technicianName,
                COALESCE(d.Status, 'unknown') as Status,
                COALESCE(d.Location, 'unspecified') as Location
            FROM Devices d
            LEFT JOIN Technicians t ON d.assignedTechnician = t.id
            WHERE d.id = ?
        `, [req.params.id]);

        if (devices.length === 0) {
            return res.status(404).json({ message: 'Device not found' });
        }

        res.json(devices[0]);
    } catch (error) {
        console.error('Error fetching device:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.createDevice = async (req, res) => {
    try {
        const { DeviceName, SerialNumber, Model, Manufacturer, Status, Location, Notes, assignedTechnician, PurchaseDate, WarrantyExpiry } = req.body;

        // Validate required fields
        if (!DeviceName || !SerialNumber || !Model) {
            return res.status(400).json({
                message: 'Missing required fields',
                required: ['DeviceName', 'SerialNumber', 'Model']
            });
        }

        // Validate date logic: WarrantyExpiry should not be earlier than PurchaseDate
        if (PurchaseDate && WarrantyExpiry && new Date(WarrantyExpiry) < new Date(PurchaseDate)) {
            return res.status(400).json({
                message: 'Warranty expiry date cannot be earlier than purchase date'
            });
        }

        const [result] = await pool.query(
            'INSERT INTO Devices (DeviceName, SerialNumber, Model, Manufacturer, Status, Location, Notes, assignedTechnician, PurchaseDate, WarrantyExpiry) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [DeviceName, SerialNumber, Model, Manufacturer, Status || 'active', Location, Notes, assignedTechnician, PurchaseDate, WarrantyExpiry]
        );

        // Log activity
        await logActivity(
            req.user.id,
            'CREATE',
            'Devices',
            result.insertId,
            `Created device: ${DeviceName}`
        );

        // After inserting device, set default LastMaintenanceDate and NextMaintenanceDate
        const lastMaintenanceDate = null; // or new Date() if you want current date
        // Set NextMaintenanceDate to 6 months after PurchaseDate if available, else 6 months from now
        let nextMaintenanceDate = null;
        if (PurchaseDate) {
            const purchase = new Date(PurchaseDate);
            purchase.setMonth(purchase.getMonth() + 6);
            nextMaintenanceDate = purchase.toISOString().slice(0, 10);
        } else {
            const now = new Date();
            now.setMonth(now.getMonth() + 6);
            nextMaintenanceDate = now.toISOString().slice(0, 10);
        }

        await pool.query(
            'UPDATE Devices SET LastMaintenanceDate = ?, NextMaintenanceDate = ? WHERE id = ?',
            [lastMaintenanceDate, nextMaintenanceDate, result.insertId]
        );

        // Fetch the created device
        const [newDevice] = await pool.query('SELECT * FROM Devices WHERE id = ?', [result.insertId]);

        res.status(201).json({
            message: 'Device created successfully',
            device: newDevice[0]
        });
    } catch (error) {
        console.error('Error creating device:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.updateDevice = async (req, res) => {
    try {
        const deviceId = req.params.id;
        const { DeviceName, SerialNumber, Model, Manufacturer, Status, Location, Notes, assignedTechnician, PurchaseDate, WarrantyExpiry } = req.body;

        // Check if device exists
        const [existingDevice] = await pool.query('SELECT * FROM Devices WHERE id = ?', [deviceId]);
        if (existingDevice.length === 0) {
            return res.status(404).json({ message: 'Device not found' });
        }

        // Validate date logic: WarrantyExpiry should not be earlier than PurchaseDate
        // Use updated values if provided, else existing values
        const effectivePurchaseDate = PurchaseDate || existingDevice[0].PurchaseDate;
        const effectiveWarrantyExpiry = WarrantyExpiry || existingDevice[0].WarrantyExpiry;
        if (effectivePurchaseDate && effectiveWarrantyExpiry && new Date(effectiveWarrantyExpiry) < new Date(effectivePurchaseDate)) {
            return res.status(400).json({
                message: 'Warranty expiry date cannot be earlier than purchase date'
            });
        }

        const prevStatus = (existingDevice[0].Status || '').toLowerCase();
        const newStatus = (Status || existingDevice[0].Status || '').toLowerCase();

        // Cập nhật thiết bị
        const [result] = await pool.query(
            'UPDATE Devices SET DeviceName=?, SerialNumber=?, Model=?, Manufacturer=?, Status=?, Location=?, Notes=?, assignedTechnician=?, PurchaseDate=?, WarrantyExpiry=?, updatedAt=NOW() WHERE id=?',
            [
                DeviceName || existingDevice[0].DeviceName,
                SerialNumber || existingDevice[0].SerialNumber,
                Model || existingDevice[0].Model,
                Manufacturer || existingDevice[0].Manufacturer,
                Status || existingDevice[0].Status,
                Location || existingDevice[0].Location,
                Notes || existingDevice[0].Notes,
                assignedTechnician || existingDevice[0].assignedTechnician,
                PurchaseDate || existingDevice[0].PurchaseDate,
                WarrantyExpiry || existingDevice[0].WarrantyExpiry,
                deviceId
            ]
        );

        // Nếu chuyển từ active sang maintenance: tạo MaintenanceSchedules mới nếu chưa có
        if (prevStatus === 'active' && newStatus === 'maintenance') {
            const [existingSchedules] = await pool.query(
                'SELECT * FROM MaintenanceSchedules WHERE DeviceID = ? AND Status != ?',
                [deviceId, 'completed']
            );
            if (existingSchedules.length === 0) {
                await pool.query(
                    'INSERT INTO MaintenanceSchedules (DeviceID, MaintenanceType, ScheduledDate, Status, Description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
                    [deviceId, 'Auto', new Date(), 'pending', 'Auto created when device set to maintenance']
                );
            }
        }
        // Nếu chuyển từ maintenance sang active: cập nhật MaintenanceSchedules gần nhất thành completed
        if (prevStatus === 'maintenance' && newStatus === 'active') {
            try {
                // Sử dụng COLLATE để so sánh không phân biệt hoa thường
                const [schedules] = await pool.query('SELECT * FROM MaintenanceSchedules WHERE DeviceID = ? AND LOWER(Status) != ? ORDER BY id DESC LIMIT 1', [deviceId, 'completed']);
                console.log('Found maintenance schedules to update:', schedules);
                if (schedules.length > 0) {
                    // Cập nhật trạng thái với chữ thường
                    const updateResult = await pool.query('UPDATE MaintenanceSchedules SET Status = ?, CompletedDate = ?, updatedAt = NOW() WHERE id = ?', ['completed', new Date().toISOString().slice(0, 10), schedules[0].id]);
                    console.log('Update result:', updateResult);
                } else {
                    console.log('No maintenance schedules found to update.');
                }
            } catch (err) {
                console.error('Error updating maintenance schedule status:', err);
            }
        }

        // Log activity
        await logActivity(
            req.user.id,
            'UPDATE',
            'Devices',
            deviceId,
            `Updated device: ${DeviceName || existingDevice[0].DeviceName}`
        );

        // Fetch updated device
        const [updatedDevice] = await pool.query('SELECT * FROM Devices WHERE id = ?', [deviceId]);

        res.json({
            message: 'Device updated successfully',
            device: updatedDevice[0]
        });
    } catch (error) {
        console.error('Error updating device:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.deleteDevice = async (req, res) => {
    try {
        const deviceId = req.params.id;

        // Kiểm tra device có tồn tại không
        const [device] = await pool.query('SELECT * FROM Devices WHERE id = ?', [deviceId]);
        if (device.length === 0) {
            return res.status(404).json({ message: 'Device not found' });
        }

        // Xóa các bản ghi liên quan trong Alerts và MaintenanceSchedules
        await pool.query('DELETE FROM Alerts WHERE DeviceID = ?', [deviceId]);
        await pool.query('DELETE FROM MaintenanceSchedules WHERE DeviceID = ?', [deviceId]);

        // Xóa device
        const [result] = await pool.query('DELETE FROM Devices WHERE id = ?', [deviceId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Failed to delete device' });
        }

        // Log activity
        await logActivity(
            req.user.id,
            'DELETE',
            'Devices',
            deviceId,
            `Deleted device: ${device[0].DeviceName}`
        );

        res.json({
            message: 'Device deleted successfully',
            deletedDevice: device[0]
        });
    } catch (error) {
        console.error('Error deleting device:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};