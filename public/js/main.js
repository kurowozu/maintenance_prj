// Configuration
const API_BASE_URL = 'http://localhost:3000/api/';
let currentUser = null;
let authToken = localStorage.getItem('authToken');
let cachedDevices = [];
let cachedAlerts = [];
let cachedSchedules = [];
let cachedTechnicians = [];
let deviceEditMode = 'add';
let editingDeviceId = null;
let technicianEditMode = 'add';
let editingTechnicianId = null;
let maintenanceEditMode = 'add';
let editingMaintenanceId = null;
let alertEditMode = 'add';
let editingAlertId = null;
let userEditMode = 'add';
let editingUserId = null;
let deviceSortField = null;
let deviceSortAsc = true;
let maintenanceSortField = null;
let maintenanceSortAsc = true;

// DOM Elements
const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const dashboardSection = document.getElementById('dashboard');
const devicesSection = document.getElementById('devices');
const maintenanceSection = document.getElementById('maintenance');
const alertsSection = document.getElementById('alerts');
const techniciansSection = document.getElementById('technicians');
const reportsSection = document.getElementById('reports');
const userManagementSection = document.getElementById('userManagement');

// Initialize Axios
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.withCredentials = true;

// Utility Functions
function showToast(type, message) {
    const toastEl = document.getElementById(`${type}Toast`);
    const toastBody = toastEl.querySelector('.toast-body');
    toastBody.textContent = message;
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}

function updateUIForUser() {
    const usernameDisplay = document.getElementById('usernameDisplay');
    const userRoleDisplay = document.getElementById('userRoleDisplay');
    const adminElements = document.querySelectorAll('.admin-only');
    let user = window.currentUser;
    if (!user && localStorage.getItem('currentUser')) {
        user = JSON.parse(localStorage.getItem('currentUser'));
        window.currentUser = user;
    }
    if (user) {
        usernameDisplay.textContent = user.username || 'User';
        userRoleDisplay.textContent = user.role || 'Guest';
        if (user.role === 'admin') {
            adminElements.forEach(el => el.style.display = 'block');
        } else {
            adminElements.forEach(el => el.style.display = 'none');
        }
    }
}

// Data Loading Functions
async function loadDashboardData() {
    try {
        const response = await axios.get('/dashboard', {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        // Lấy số lượng từ API mới
        const { totalDevices, activeDevices, maintenanceDevices, devices, alerts, schedules } = response.data;
        cachedDevices = devices;
        cachedAlerts = alerts;
        cachedSchedules = schedules;
        updateDashboardCounters(totalDevices, activeDevices, maintenanceDevices);
        renderRecentAlerts();
        renderUpcomingMaintenance();
        updateMaintenanceBadge();
        // Sau khi cập nhật cache, cập nhật UI cho tab hiện tại
        const activeTab = document.querySelector('.tab-pane.active');
        if (activeTab) {
            if (activeTab.id === 'devices') loadDevices();
            if (activeTab.id === 'maintenance') loadMaintenance();
            if (activeTab.id === 'alerts') loadAlerts();
            if (activeTab.id === 'technicians') loadTechnicians();
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showToast('error', 'Failed to load dashboard data');
    }
}

function updateDashboardCounters(totalDevices, activeDevices, maintenanceDevices) {
    document.getElementById('totalDevices').textContent = totalDevices ?? cachedDevices.length;
    document.getElementById('activeDevices').textContent = activeDevices ?? cachedDevices.filter(d => (d.Status || d.status || '').toLowerCase() === 'active').length;
    document.getElementById('maintenanceDevices').textContent = maintenanceDevices ?? cachedDevices.filter(d => (d.Status || d.status || '').toLowerCase() === 'maintenance').length;
}

function renderRecentAlerts() {
    const tbody = document.querySelector('#recentAlertsTable tbody');
    tbody.innerHTML = '';
    let recentAlerts = (cachedAlerts || []);
    if (recentAlerts.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="3" class="text-center">No alerts found</td>`;
        tbody.appendChild(row);
        return;
    }
    recentAlerts = recentAlerts
        .filter(a => a.AlertDate)
        .sort((a, b) => new Date(b.AlertDate) - new Date(a.AlertDate))
        .slice(0, 10);
    recentAlerts.forEach(alert => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${alert.deviceName || alert.DeviceID || 'N/A'}</td>
            <td>${alert.message || alert.Message || ''}</td>
            <td>${alert.AlertDate ? new Date(alert.AlertDate).toLocaleDateString() : ''}</td>
        `;
        tbody.appendChild(row);
    });
}

function renderUpcomingMaintenance() {
    const tbody = document.querySelector('#upcomingMaintenanceTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!cachedDevices || cachedDevices.length === 0) return;
    cachedDevices
        .filter(device => device.NextMaintenanceDate)
        .sort((a, b) => new Date(b.NextMaintenanceDate) - new Date(a.NextMaintenanceDate))
        .slice(0, 10)
        .forEach(device => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${device.id || 'N/A'}</td>
                <td>${device.NextMaintenanceDate ? new Date(device.NextMaintenanceDate).toLocaleDateString() : 'N/A'}</td>
                <td>${device.assignedTechnician || 'N/A'}</td>
                <td>${device.Status || 'N/A'}</td>
            `;
            tbody.appendChild(row);
        });
}

// Event Listeners
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(loginForm);
    const credentials = {
        username: formData.get('username'),
        password: formData.get('password')
    };

    try {
        const response = await axios.post('/auth/login', credentials);

        authToken = response.data.token;
        localStorage.setItem('authToken', authToken);
        currentUser = response.data.user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        loginModal.hide();
        updateUIForUser();
        loadDashboardData();
        showToast('success', 'Login successful');

    } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = error.response?.data?.message || 'Login failed';
        loginError.style.display = 'block';
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    currentUser = null;
    window.location.reload();
});

// Tab Navigation
function showTab(target) {
    document.querySelectorAll('.tab-pane').forEach(section => {
        section.classList.remove('show', 'active');
    });
    const tab = document.querySelector(target);
    if (tab) {
        tab.classList.add('show', 'active');
    }
}

document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
    tab.addEventListener('click', function (e) {
        e.preventDefault();
        const target = this.getAttribute('data-bs-target');
        showTab(target);
        if (target === '#devices') loadDevices();
        if (target === '#maintenance') loadMaintenance();
        if (target === '#alerts') loadAlerts();
        if (target === '#technicians') loadTechnicians();
        if (target === '#reports') loadReports();
        if (target === '#activitylog') loadActivityLog();
    });
});

// Sửa các nút View All để chuyển tab đúng
const viewAllAlertsBtn = document.querySelector('a[data-bs-target="#alerts"]');
if (viewAllAlertsBtn) {
    viewAllAlertsBtn.addEventListener('click', function (e) {
        e.preventDefault();
        showTab('#alerts');
        loadAlerts();
    });
}
const viewAllMaintenanceBtn = document.querySelector('a[data-bs-target="#maintenance"]');
if (viewAllMaintenanceBtn) {
    viewAllMaintenanceBtn.addEventListener('click', function (e) {
        e.preventDefault();
        showTab('#maintenance');
        loadMaintenance();
    });
}

// Nút Export Devices
const exportDevicesBtn = document.getElementById('exportDevicesBtn');
if (exportDevicesBtn) {
    exportDevicesBtn.addEventListener('click', function () {
        // Xuất dữ liệu devices ra CSV
        let csv = 'ID,Name,Serial,Model,Status,Location\n';
        cachedDevices.forEach(device => {
            csv += `${device.id},${device.DeviceName || ''},${device.SerialNumber || ''},${device.Model || ''},${device.Status || ''},${device.Location || ''}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'devices.csv';
        a.click();
        URL.revokeObjectURL(url);
    });
}

// Bổ sung hàm loadTechnicians
async function loadTechnicians() {
    console.log('Dashboard data:', authToken);
    const tbody = document.querySelector('#techniciansTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    // Nếu đã có cache thì dùng, chưa có thì gọi API
    if (cachedTechnicians.length === 0) {
        try {
            const response = await axios.get('/technicians', {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            cachedTechnicians = response.data;
        } catch (error) {
            showToast('error', 'Failed to load technicians');
            return;
        }
    }
    cachedTechnicians.forEach(tech => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${tech.id}</td>
            <td>${tech.FullName || ''}</td>
            <td>${tech.Specialization || ''}</td>
            <td>${tech.PhoneNumber || ''}</td>
            <td>${tech.HireDate ? new Date(tech.HireDate).toLocaleDateString() : ''}</td>
            <td>
                <button class="btn btn-sm btn-warning edit-technician-btn"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-danger delete-technician-btn"><i class="bi bi-trash"></i></button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Bổ sung hàm loadReports (hiện chỉ clear bảng, bạn có thể mở rộng sau)
function loadReports() {
    // Nếu có bảng, clear nội dung hoặc hiển thị thông báo
    // Tuỳ vào logic thực tế
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('authToken')) {
        authToken = localStorage.getItem('authToken');
        if (localStorage.getItem('currentUser')) {
            currentUser = JSON.parse(localStorage.getItem('currentUser'));
        }
        axios.get('/auth/verify-token', {
            headers: { Authorization: `Bearer ${authToken}` }
        })
            .then(response => {
                currentUser = response.data.user;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                updateUIForUser();
                loadDashboardData();
            })
            .catch(() => {
                localStorage.clear();
                loginModal.show();
            });
    } else {
        loginModal.show();
    }
});

// Hiển thị danh sách thiết bị
function loadDevices() {
    renderDevicesTable();
}

// Hiển thị danh sách lịch bảo trì
function loadMaintenance() {
    const tbody = document.querySelector('#maintenanceTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!cachedSchedules || cachedSchedules.length === 0) return;

    cachedSchedules.forEach(schedule => {
        let repairDate = '';
        if ((schedule.Status || '').toLowerCase() === 'completed') {
            repairDate = schedule.CompletedDate ? new Date(schedule.CompletedDate).toLocaleDateString() : (schedule.UpdatedAt ? new Date(schedule.UpdatedAt).toLocaleDateString() : '');
        }
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${schedule.id}</td>
            <td>${schedule.DeviceID || ''}</td>
            <td>${schedule.MaintenanceType || ''}</td>
            <td>${schedule.ScheduledDate ? new Date(schedule.ScheduledDate).toLocaleDateString() : ''}</td>
            <td>${repairDate}</td>
            <td>${schedule.Status || ''}</td>
            <td>${schedule.TechnicianID || ''}</td>
            <td><button class="btn btn-sm btn-warning edit-maintenance-btn"><i class="bi bi-pencil"></i></button></td>
        `;
        tbody.appendChild(row);
    });
    updateMaintenanceBadge();
}

// Hiển thị danh sách cảnh báo
function loadAlerts() {
    const tbody = document.querySelector('#alertsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!cachedAlerts || cachedAlerts.length === 0) return;

    cachedAlerts.forEach(alert => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${alert.id}</td>
            <td>${alert.DeviceID || ''}</td>
            <td>${alert.Message || ''}</td>
            <td>${alert.AlertDate ? new Date(alert.AlertDate).toLocaleDateString() : ''}</td>
            <td>${alert.Severity || ''}</td>
            <td>
                <button class="btn btn-sm btn-success resolve-alert-btn"><i class="bi bi-check-lg"></i></button>
                <button class="btn btn-sm btn-warning edit-alert-btn"><i class="bi bi-pencil"></i></button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Thêm cho Users
function loadUsers() {
    const tbody = document.querySelector('#usersTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    // Giả sử cachedUsers là mảng user đã lấy từ API
    if (!window.cachedUsers || window.cachedUsers.length === 0) return;
    window.cachedUsers.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.fullName}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>${user.isActive ? 'Active' : 'Inactive'}</td>
            <td>
                <button class="btn btn-sm btn-warning edit-user-btn"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-danger delete-user-btn"><i class="bi bi-trash"></i></button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Sự kiện Thêm Device
const addDeviceBtn = document.getElementById('addDeviceBtn');
if (addDeviceBtn) {
    addDeviceBtn.addEventListener('click', function () {
        deviceEditMode = 'add';
        editingDeviceId = null;
        document.getElementById('deviceForm').reset();
        document.querySelector('#addDeviceModal .modal-title').textContent = 'Add New Device';
        new bootstrap.Modal(document.getElementById('addDeviceModal')).show();
    });
}

// Sự kiện Sửa/Xóa Device
const devicesTable = document.getElementById('devicesTable');
if (devicesTable) {
    devicesTable.addEventListener('click', function (e) {
        if (e.target.closest('.edit-device-btn')) {
            const row = e.target.closest('tr');
            deviceEditMode = 'edit';
            editingDeviceId = row.children[0].textContent;
            document.getElementById('deviceName').value = row.children[1].textContent;
            document.getElementById('serialNumber').value = row.children[2].textContent;
            document.getElementById('deviceModel').value = row.children[3].textContent;
            document.getElementById('deviceStatus').value = row.children[6].textContent.toLowerCase();
            document.getElementById('deviceLocation').value = row.children[7].textContent;
            if (row.children[4]) document.getElementById('purchaseDate').value = formatDateForInput(row.children[4].textContent);
            else document.getElementById('purchaseDate').value = '';
            if (row.children[5]) document.getElementById('warrantyExpiry').value = formatDateForInput(row.children[5].textContent);
            else document.getElementById('warrantyExpiry').value = '';
            if (row.children[8]) document.getElementById('manufacturer') && (document.getElementById('manufacturer').value = row.children[8].textContent);
            if (row.children[9]) document.getElementById('deviceNotes') && (document.getElementById('deviceNotes').value = row.children[9].textContent);
            if (row.children[10]) document.getElementById('assignedTechnician') && (document.getElementById('assignedTechnician').value = row.children[10].textContent);
            document.querySelector('#addDeviceModal .modal-title').textContent = 'Edit Device';
            new bootstrap.Modal(document.getElementById('addDeviceModal')).show();
        }
        if (e.target.closest('.delete-device-btn')) {
            if (confirm('Bạn có chắc chắn muốn xóa thiết bị này?')) {
                const row = e.target.closest('tr');
                const deviceId = row.children[0].textContent;
                axios.delete(`/devices/${deviceId}`)
                    .then(() => {
                        showToast('success', 'Xóa thiết bị thành công');
                        cachedDevices = [];
                        loadDashboardData();
                    })
                    .catch(() => showToast('error', 'Xóa thiết bị thất bại'));
            }
        }
    });
}

// Validate khi thêm/sửa device
function validateDeviceForm() {
    const requiredFields = [
        'deviceName', 'serialNumber', 'deviceModel', 'manufacturer',
        'deviceStatus', 'deviceLocation'
    ];
    for (const id of requiredFields) {
        const el = document.getElementById(id);
        if (!el || !el.value) {
            if (el) el.focus();
            showToast('error', 'Vui lòng nhập đầy đủ thông tin thiết bị!');
            return false;
        }
    }
    return true;
}

// Sự kiện Lưu Device (Thêm/Sửa)
document.getElementById('saveDeviceBtn').addEventListener('click', async function () {
    if (!validateDeviceForm()) return;
    const data = {
        DeviceName: document.getElementById('deviceName').value,
        SerialNumber: document.getElementById('serialNumber').value,
        Model: document.getElementById('deviceModel').value,
        Manufacturer: document.getElementById('manufacturer').value,
        Status: document.getElementById('deviceStatus').value,
        Location: document.getElementById('deviceLocation').value,
        Notes: document.getElementById('deviceNotes').value,
        assignedTechnician: document.getElementById('assignedTechnician') ? document.getElementById('assignedTechnician').value : undefined,
        PurchaseDate: document.getElementById('purchaseDate') ? document.getElementById('purchaseDate').value : undefined,
        WarrantyExpiry: document.getElementById('warrantyExpiry') ? document.getElementById('warrantyExpiry').value : undefined
    };
    let prevStatus = null;
    if (deviceEditMode === 'edit' && editingDeviceId) {
        // Lấy trạng thái cũ
        const device = cachedDevices.find(d => d.id == editingDeviceId);
        prevStatus = device ? (device.Status || '').toLowerCase() : null;
    }
    if (deviceEditMode === 'add') {
        axios.post('/devices', data)
            .then(() => {
                showToast('success', 'Thêm thiết bị thành công');
                cachedDevices = [];
                loadDashboardData();
                bootstrap.Modal.getInstance(document.getElementById('addDeviceModal')).hide();
            })
            .catch(() => showToast('error', 'Thêm thiết bị thất bại'));
    } else if (deviceEditMode === 'edit' && editingDeviceId) {
        axios.put(`/devices/${editingDeviceId}`, data)
            .then(async () => {
                // Nếu chuyển từ active sang maintenance thì tự động thêm maintenance schedule
                if (prevStatus === 'active' && data.Status === 'maintenance') {
                    await axios.post('/maintenance', {
                        DeviceID: editingDeviceId,
                        MaintenanceType: 'Auto',
                        ScheduledDate: new Date().toISOString().slice(0, 16),
                        Status: 'pending',
                        Description: 'Auto created when device set to maintenance',
                        TechnicianID: null
                    });
                }
                // Nếu chuyển từ maintenance sang active thì cập nhật maintenance schedule gần nhất thành completed
                if (prevStatus === 'maintenance' && data.Status === 'active') {
                    // Lấy maintenance schedule gần nhất (status != completed)
                    await axios.get('/maintenance').then(res => {
                        const schedules = res.data.filter(s => s.DeviceID == editingDeviceId && s.Status !== 'completed');
                        if (schedules.length > 0) {
                            // Lấy schedule mới nhất (id lớn nhất)
                            const latest = schedules.reduce((a, b) => (+a.id > +b.id ? a : b));
                            axios.put(`/maintenance/${latest.id}`, {
                                Status: 'completed',
                                CompletedDate: new Date().toISOString().slice(0, 10)
                            });
                        }
                    });
                }
                showToast('success', 'Cập nhật thiết bị thành công');
                cachedDevices = [];
                loadDashboardData();
                bootstrap.Modal.getInstance(document.getElementById('addDeviceModal')).hide();
            })
            .catch(() => showToast('error', 'Cập nhật thiết bị thất bại'));
    }
});

// Sự kiện Thêm Technician
const addTechnicianBtn = document.getElementById('addTechnicianBtn');
if (addTechnicianBtn) {
    addTechnicianBtn.addEventListener('click', function () {
        technicianEditMode = 'add';
        editingTechnicianId = null;
        document.getElementById('technicianForm').reset();
        document.querySelector('#addTechnicianModal .modal-title').textContent = 'Add Technician';
        new bootstrap.Modal(document.getElementById('addTechnicianModal')).show();
    });
}

// Sự kiện Sửa/Xóa Technician
const techniciansTable = document.getElementById('techniciansTable');
if (techniciansTable) {
    techniciansTable.addEventListener('click', function (e) {
        if (e.target.closest('.edit-technician-btn')) {
            const row = e.target.closest('tr');
            technicianEditMode = 'edit';
            editingTechnicianId = row.children[0].textContent;
            document.getElementById('technicianName').value = row.children[1].textContent;
            document.getElementById('technicianSpecialization').value = row.children[2].textContent;
            document.getElementById('technicianPhone').value = row.children[3].textContent;
            document.getElementById('technicianHireDate').value = row.children[4].textContent;
            document.querySelector('#addTechnicianModal .modal-title').textContent = 'Edit Technician';
            new bootstrap.Modal(document.getElementById('addTechnicianModal')).show();
        }
        if (e.target.closest('.delete-technician-btn')) {
            if (confirm('Bạn có chắc chắn muốn xóa kỹ thuật viên này?')) {
                const row = e.target.closest('tr');
                const techId = row.children[0].textContent;
                axios.delete(`/technicians/${techId}`, { data: { id: techId } })
                    .then(() => {
                        showToast('success', 'Xóa kỹ thuật viên thành công');
                        cachedTechnicians = [];
                        loadDashboardData();
                    })
                    .catch(() => showToast('error', 'Xóa kỹ thuật viên thất bại'));
            }
        }
    });
}

// Sự kiện Lưu Technician (Thêm/Sửa)
document.getElementById('saveTechnicianBtn').addEventListener('click', async function () {
    const data = {
        FullName: document.getElementById('technicianName').value,
        Specialization: document.getElementById('technicianSpecialization').value,
        PhoneNumber: document.getElementById('technicianPhone').value,
        HireDate: document.getElementById('technicianHireDate').value
    };
    if (technicianEditMode === 'add') {
        axios.post('/technicians', data)
            .then(() => {
                showToast('success', 'Thêm kỹ thuật viên thành công');
                cachedTechnicians = [];
                loadDashboardData();
                bootstrap.Modal.getInstance(document.getElementById('addTechnicianModal')).hide();
            })
            .catch(() => showToast('error', 'Thêm kỹ thuật viên thất bại'));
    } else if (technicianEditMode === 'edit' && editingTechnicianId) {
        axios.put(`/technicians/${editingTechnicianId}`, data)
            .then(() => {
                showToast('success', 'Cập nhật kỹ thuật viên thành công');
                cachedTechnicians = [];
                loadDashboardData();
                bootstrap.Modal.getInstance(document.getElementById('addTechnicianModal')).hide();
            })
            .catch(() => showToast('error', 'Cập nhật kỹ thuật viên thất bại'));
    }
});

// Sự kiện Thêm Maintenance
const addScheduleBtn = document.getElementById('addScheduleBtn');
if (addScheduleBtn) {
    addScheduleBtn.addEventListener('click', function () {
        scheduleEditMode = 'add';
        editingScheduleId = null;
        document.getElementById('scheduleForm').reset();
        document.querySelector('#addScheduleModal .modal-title').textContent = 'Add Maintenance Schedule';
        new bootstrap.Modal(document.getElementById('addScheduleModal')).show();
    });
}

// Sự kiện Sửa/Xóa Maintenance
const maintenanceTable = document.getElementById('maintenanceTable');
if (maintenanceTable) {
    maintenanceTable.addEventListener('click', async function (e) {
        if (e.target.closest('.edit-maintenance-btn')) {
            const row = e.target.closest('tr');
            scheduleEditMode = 'edit';
            editingScheduleId = row.children[0].textContent;
            // Lấy giá trị cần set
            const deviceId = row.children[1].textContent;
            const maintenanceType = row.children[2].textContent.toLowerCase();
            const scheduledDate = row.children[3].textContent;
            const completedDate = row.children[4].textContent;
            const status = row.children[5].textContent.toLowerCase();
            const technicianId = row.children[6].textContent;
            // Load dropdown trước rồi set value
            await populateDeviceDropdown(deviceId);
            await loadTechnicianDropdown(technicianId);
            document.getElementById('maintenanceType').value = maintenanceType;
            // Hiển thị đúng định dạng cho input type="datetime-local"
            document.getElementById('scheduledDate').value = formatDateTimeForInput(scheduledDate);
            document.getElementById('completedDate').value = formatDateForInput(completedDate);
            document.getElementById('scheduleStatus').value = status;
            document.querySelector('#addScheduleModal .modal-title').textContent = 'Edit Maintenance Schedule';
            new bootstrap.Modal(document.getElementById('addScheduleModal')).show();
        }
        if (e.target.closest('.delete-maintenance-btn')) {
            if (confirm('Bạn có chắc chắn muốn xóa lịch bảo trì này?')) {
                const row = e.target.closest('tr');
                const scheduleId = row.children[0].textContent;
                axios.delete(`/maintenance/${scheduleId}`)
                    .then(() => {
                        showToast('success', 'Xóa lịch bảo trì thành công');
                        loadDashboardData();
                    })
                    .catch(() => showToast('error', 'Xóa lịch bảo trì thất bại'));
            }
        }
    });
}

function formatDateForInput(dateStr) {
    // Chuyển dd/mm/yyyy hoặc yyyy-mm-dd thành yyyy-MM-dd
    if (!dateStr) return '';
    if (dateStr.includes('/')) {
        const [d, m, y] = dateStr.split(/[\/]/);
        if (!d || !m || !y) return '';
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (dateStr.includes('-')) {
        // yyyy-mm-dd hoặc yyyy-mm-ddTHH:mm
        return dateStr.split('T')[0];
    }
    return '';
}

function formatDateTimeForInput(dateStr) {
    // Chuyển dd/mm/yyyy hh:mm hoặc yyyy-mm-ddTHH:mm thành yyyy-MM-ddTHH:mm
    if (!dateStr) return '';
    let d, m, y, h = '00', min = '00';
    if (dateStr.includes('/')) {
        const parts = dateStr.split(' ');
        [d, m, y] = parts[0].split('/');
        if (parts[1]) {
            [h, min] = parts[1].split(':');
        }
    } else if (dateStr.includes('-')) {
        const t = dateStr.split('T');
        [y, m, d] = t[0].split('-');
        if (t[1]) {
            [h, min] = t[1].split(':');
        }
    }
    if (!y || !m || !d) return '';
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min.padStart(2, '0')}`;
}

// Sự kiện Thêm Alert (giả sử có modal addAlertModal và form alertForm)
const addAlertBtn = document.getElementById('addAlertBtn');
if (addAlertBtn) {
    addAlertBtn.addEventListener('click', function () {
        alertEditMode = 'add';
        editingAlertId = null;
        document.getElementById('alertForm').reset();
        new bootstrap.Modal(document.getElementById('addAlertModal')).show();
    });
}

// Sự kiện Sửa/Xóa Alert
const alertsTable = document.getElementById('alertsTable');
if (alertsTable) {
    alertsTable.addEventListener('click', function (e) {
        if (e.target.closest('.resolve-alert-btn')) {
            const row = e.target.closest('tr');
            const alertId = row.children[0].textContent;
            axios.delete(`/alerts/${alertId}`)
                .then(() => {
                    showToast('success', 'Sửa thiết bị thành công');
                    // Ghi activity log
                    const userId = window.currentUser?.id;
                    axios.post('/activity-logs', {
                        userId,
                        action: 'RESOLVE',
                        tableName: 'Alerts',
                        recordId: alertId,
                        details: 'Resolved alert'
                    });
                    loadDashboardData();
                })
                .catch(() => showToast('error', 'Xử lý cảnh báo thất bại'));
        }
        if (e.target.closest('.edit-alert-btn')) {
            const row = e.target.closest('tr');
            const alertId = row.children[0].textContent;
            const alert = cachedAlerts.find(a => a.id == alertId);
            if (!alert) return;
            document.getElementById('editAlertDevice').value = alert.DeviceID || '';
            document.getElementById('editAlertMessage').value = alert.Message || '';
            document.getElementById('editAlertSeverity').value = alert.Severity || 'Low';
            document.getElementById('editAlertDate').value = alert.AlertDate ? new Date(alert.AlertDate).toISOString().slice(0, 10) : '';
            document.getElementById('editAlertResolution').value = alert.ResolutionNotes || '';
            window.editingAlertId = alertId;
            new bootstrap.Modal(document.getElementById('editAlertModal')).show();
        }
    });
}

document.getElementById('saveEditAlertBtn').addEventListener('click', async function () {
    const data = {
        Message: document.getElementById('editAlertMessage').value,
        Severity: document.getElementById('editAlertSeverity').value,
        AlertDate: document.getElementById('editAlertDate').value,
        ResolutionNotes: document.getElementById('editAlertResolution').value
    };
    const alertId = window.editingAlertId;
    if (!alertId) return;
    axios.put(`/alerts/${alertId}`, data)
        .then(() => {
            showToast('success', 'Cập nhật cảnh báo thành công');
            // Ghi activity log
            const userId = window.currentUser?.id;
            axios.post('/activity-logs', {
                userId,
                action: 'EDIT',
                tableName: 'Alerts',
                recordId: alertId,
                details: 'Edited alert'
            });
            loadDashboardData();
            bootstrap.Modal.getInstance(document.getElementById('editAlertModal')).hide();
        })
        .catch(() => showToast('error', 'Cập nhật cảnh báo thất bại'));
});

// Sự kiện Thêm User (chỉ admin mới thấy nút addUserBtn)
const addUserBtn = document.getElementById('addUserBtn');
if (addUserBtn) {
    addUserBtn.addEventListener('click', function () {
        userEditMode = 'add';
        editingUserId = null;
        document.getElementById('userForm').reset();
        new bootstrap.Modal(document.getElementById('addUserModal')).show();
    });
}

// Sự kiện Sửa/Xóa User
const usersTable = document.getElementById('usersTable');
if (usersTable) {
    usersTable.addEventListener('click', function (e) {
        if (e.target.closest('.edit-user-btn')) {
            const row = e.target.closest('tr');
            userEditMode = 'edit';
            editingUserId = row.children[0].textContent;
            document.getElementById('newUsername').value = row.children[1].textContent;
            document.getElementById('newFullName').value = row.children[2].textContent;
            document.getElementById('newEmail').value = row.children[3].textContent;
            document.getElementById('userRole').value = row.children[4].textContent.toLowerCase();
            // Không điền password khi sửa
            new bootstrap.Modal(document.getElementById('addUserModal')).show();
        }
        if (e.target.closest('.delete-user-btn')) {
            if (confirm('Bạn có chắc chắn muốn xóa user này?')) {
                const row = e.target.closest('tr');
                const userId = row.children[0].textContent;
                axios.delete(`/users/${userId}`)
                    .then(() => {
                        showToast('success', 'Xóa user thành công');
                        loadDashboardData();
                    })
                    .catch(() => showToast('error', 'Xóa user thất bại'));
            }
        }
    });
}

// Sự kiện Lưu User (Thêm/Sửa)
document.getElementById('saveUserBtn').addEventListener('click', async function () {
    const password = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    if (userEditMode === 'add') {
        if (password !== confirmPassword) {
            showToast('error', 'Mật khẩu và xác nhận mật khẩu không khớp');
            return;
        }
    }
    const data = {
        username: document.getElementById('newUsername').value,
        fullName: document.getElementById('newFullName').value,
        email: document.getElementById('newEmail').value,
        password: password,
        role: document.getElementById('userRole').value
    };
    if (userEditMode === 'add') {
        axios.post('/users', data)
            .then(() => {
                showToast('success', 'Thêm user thành công');
                loadDashboardData();
                bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
            })
            .catch(() => showToast('error', 'Thêm user thất bại'));
    } else if (userEditMode === 'edit' && editingUserId) {
        axios.put(`/users/${editingUserId}`, data)
            .then(() => {
                showToast('success', 'Cập nhật user thành công');
                loadDashboardData();
                bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
            })
            .catch(() => showToast('error', 'Cập nhật user thất bại'));
    }
});

async function loadActivityLog() {
    const tbody = document.querySelector('#activityLogTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
        const response = await axios.get('/activity-logs', {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const logs = response.data;
        logs.forEach(log => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${log.id}</td>
                <td>${log.username || log.userId}</td>
                <td>${log.action}</td>
                <td>${log.tableName || ''}</td>
                <td>${log.recordId || ''}</td>
                <td>${log.details}</td>
                <td>${log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        showToast('error', 'Failed to load activity log');
    }
}

// User Management Functions
async function loadUsers() {
    try {
        const response = await fetch('/users', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch users');
        const users = await response.json();

        const tbody = document.querySelector('#userTable tbody');
        tbody.innerHTML = '';

        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td>
                    <button onclick="editUser(${user.id})" class="btn btn-sm btn-primary">Edit</button>
                    <button onclick="deleteUser(${user.id})" class="btn btn-sm btn-danger">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading users:', error);
        showAlert('Error loading users', 'danger');
    }
}

async function addUser() {
    const username = document.getElementById('newUsername').value;
    const email = document.getElementById('newEmail').value;
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;

    try {
        const response = await fetch('/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ username, email, password, role })
        });

        if (!response.ok) throw new Error('Failed to create user');

        showAlert('User created successfully', 'success');
        loadUsers();
        $('#addUserModal').modal('hide');
    } catch (error) {
        console.error('Error creating user:', error);
        showAlert('Error creating user', 'danger');
    }
}

async function editUser(id) {
    try {
        const response = await fetch(`/users/${id}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch user');
        const user = await response.json();

        document.getElementById('editUserId').value = user.id;
        document.getElementById('editUsername').value = user.username;
        document.getElementById('editEmail').value = user.email;
        document.getElementById('editRole').value = user.role;

        $('#editUserModal').modal('show');
    } catch (error) {
        console.error('Error loading user:', error);
        showAlert('Error loading user', 'danger');
    }
}

async function updateUser() {
    const id = document.getElementById('editUserId').value;
    const username = document.getElementById('editUsername').value;
    const email = document.getElementById('editEmail').value;
    const role = document.getElementById('editRole').value;

    try {
        const response = await fetch(`/users/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ username, email, role })
        });

        if (!response.ok) throw new Error('Failed to update user');

        showAlert('User updated successfully', 'success');
        loadUsers();
        $('#editUserModal').modal('hide');
    } catch (error) {
        console.error('Error updating user:', error);
        showAlert('Error updating user', 'danger');
    }
}

async function deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
        const response = await fetch(`/users/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) throw new Error('Failed to delete user');

        showAlert('User deleted successfully', 'success');
        loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        showAlert('Error deleting user', 'danger');
    }
}

// Activity Log Functions
async function loadActivityLogs() {
    try {
        const response = await fetch('/activity-logs', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch activity logs');
        const logs = await response.json();

        const tbody = document.querySelector('#activityLogTable tbody');
        tbody.innerHTML = '';

        logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${log.username}</td>
                <td>${log.action}</td>
                <td>${log.tableName}</td>
                <td>${log.recordId}</td>
                <td>${log.details}</td>
                <td>${new Date(log.timestamp).toLocaleString()}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading activity logs:', error);
        showAlert('Error loading activity logs', 'danger');
    }
}

// Update tab switching function
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');

    // Show selected tab
    document.getElementById(tabName + 'Tab').style.display = 'block';

    // Load data based on tab
    switch (tabName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'devices':
            loadDevices();
            break;
        case 'maintenance':
            loadMaintenance();
            break;
        case 'alerts':
            loadAlerts();
            break;
        case 'technicians':
            loadTechnicians();
            break;
        case 'reports':
            loadReports();
            break;
        case 'users':
            loadUsers();
            break;
        case 'activityLogs':
            loadActivityLogs();
            break;
    }
}

document.getElementById('deviceStatusReportBtn')?.addEventListener('click', function () {
    window.open('/api/reports/devices', '_blank');
});
document.getElementById('maintenanceReportBtn')?.addEventListener('click', function () {
    window.open('/api/reports/maintenance', '_blank');
});
document.getElementById('alertReportBtn')?.addEventListener('click', function () {
    window.open('/api/reports/alerts', '_blank');
});

async function populateDeviceDropdown(selectedId = null) {
    const select = document.getElementById('scheduleDevice');
    select.innerHTML = '<option value="">Select Device</option>';
    try {
        const response = await axios.get('/devices', {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        response.data.forEach(device => {
            const option = document.createElement('option');
            option.value = device.id;
            option.textContent = device.DeviceName;
            if (selectedId && device.id == selectedId) option.selected = true;
            select.appendChild(option);
        });
    } catch (error) {
        showToast('error', 'Failed to load devices');
    }
}

// Hàm load danh sách technician cho dropdown schedule
async function loadTechnicianDropdown(selectedId = null) {
    const select = document.getElementById('scheduleTechnician');
    if (!select) return;
    select.innerHTML = '<option value="">Select Technician</option>';
    try {
        const response = await axios.get('/technicians', {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        response.data.forEach(tech => {
            const option = document.createElement('option');
            option.value = tech.id;
            option.textContent = tech.FullName;
            if (selectedId && selectedId == tech.id) option.selected = true;
            select.appendChild(option);
        });
    } catch (error) {
        // Nếu lỗi thì vẫn để option mặc định
    }
}

// Search Maintenance Schedules
const maintenanceSearchInput = document.getElementById('maintenanceSearch');
if (maintenanceSearchInput) {
    maintenanceSearchInput.addEventListener('input', function () {
        const keyword = this.value.toLowerCase();
        const filtered = cachedSchedules.filter(item =>
            (item.DeviceID + '').includes(keyword) ||
            (item.MaintenanceType || '').toLowerCase().includes(keyword)
        );
        renderMaintenanceTable(filtered);
    });
}

function renderMaintenanceTable(data) {
    const tbody = document.querySelector('#maintenanceTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    (data || cachedSchedules).forEach(schedule => {
        if (!schedule || !schedule.id) return; // Bỏ qua dòng không hợp lệ
        let repairDate = '';
        if ((schedule.Status || '').toLowerCase() === 'completed') {
            repairDate = schedule.CompletedDate ? new Date(schedule.CompletedDate).toLocaleDateString() : (schedule.UpdatedAt ? new Date(schedule.UpdatedAt).toLocaleDateString() : '');
        }
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${schedule.id}</td>
            <td>${schedule.DeviceID || ''}</td>
            <td>${schedule.MaintenanceType || ''}</td>
            <td>${schedule.ScheduledDate ? new Date(schedule.ScheduledDate).toLocaleDateString() : ''}</td>
            <td>${repairDate}</td>
            <td>${schedule.Status || ''}</td>
            <td>${schedule.TechnicianID || ''}</td>
            <td><button class="btn btn-sm btn-warning edit-maintenance-btn"><i class="bi bi-pencil"></i></button></td>
        `;
        tbody.appendChild(row);
    });
    updateMaintenanceBadge();
}

// Technicians Search
const technicianSearchInput = document.getElementById('technicianSearch');
if (technicianSearchInput) {
    technicianSearchInput.addEventListener('input', function () {
        const keyword = this.value.toLowerCase();
        const filtered = cachedTechnicians.filter(item =>
            (item.id + '').includes(keyword) ||
            (item.FullName || '').toLowerCase().includes(keyword)
        );
        renderTechniciansTable(filtered);
    });
}

function renderTechniciansTable(data) {
    const tbody = document.querySelector('#techniciansTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    (data || cachedTechnicians).forEach(tech => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${tech.id}</td>
            <td>${tech.FullName || ''}</td>
            <td>${tech.Specialization || ''}</td>
            <td>${tech.Phone || ''}</td>
            <td>${tech.HireDate ? new Date(tech.HireDate).toLocaleDateString() : ''}</td>
            <td>
                <button class="btn btn-sm btn-warning edit-technician-btn"><i class="bi bi-pencil"></i></button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Activity Log Search
const activityLogSearchInput = document.getElementById('activityLogSearch');
if (activityLogSearchInput) {
    activityLogSearchInput.addEventListener('input', function () {
        const keyword = this.value.toLowerCase();
        if (!window.cachedActivityLogs) return;
        const filtered = window.cachedActivityLogs.filter(log =>
            (log.id + '').includes(keyword) ||
            (log.username || '').toLowerCase().includes(keyword)
        );
        renderActivityLogTable(filtered);
    });
}

function renderActivityLogTable(data) {
    const tbody = document.querySelector('#activityLogTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    (data || window.cachedActivityLogs || []).forEach(log => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${log.id}</td>
            <td>${log.username || log.userId}</td>
            <td>${log.action}</td>
            <td>${log.tableName || ''}</td>
            <td>${log.recordId || ''}</td>
            <td>${log.details}</td>
            <td>${log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateAlertBadge() {
    const badge = document.getElementById('alertBadge');
    if (!badge) return;
    // Đếm số lượng alert có Status === 'Active'
    const activeAlerts = cachedAlerts.filter(a => a.Status === 'Active').length;
    badge.textContent = activeAlerts > 0 ? activeAlerts : '';
    badge.style.display = activeAlerts > 0 ? 'inline-block' : 'none';
}

function updateMaintenanceBadge() {
    const badge = document.getElementById('alertBadge');
    if (!badge) return;
    const now = new Date();
    const tenDaysLater = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    // Đếm số lịch bảo trì ScheduledDate trong 10 ngày tới
    const upcoming = cachedSchedules.filter(sch => {
        if (!sch.ScheduledDate) return false;
        const date = new Date(sch.ScheduledDate);
        return date >= now && date <= tenDaysLater;
    }).length;
    badge.textContent = upcoming > 0 ? upcoming : '';
    badge.style.display = upcoming > 0 ? 'inline-block' : 'none';
}

function renderDevicesTable(data) {
    const tbody = document.querySelector('#devicesTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    (data || cachedDevices).forEach(device => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${device.id}</td>
            <td>${device.DeviceName || ''}</td>
            <td>${device.SerialNumber || ''}</td>
            <td>${device.Model || ''}</td>
            <td>${device.PurchaseDate ? new Date(device.PurchaseDate).toLocaleDateString() : ''}</td>
            <td>${device.WarrantyExpiry ? new Date(device.WarrantyExpiry).toLocaleDateString() : ''}</td>
            <td>${device.Status || ''}</td>
            <td>${device.Location || ''}</td>
            <td>
                <button class="btn btn-sm btn-warning edit-device-btn"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-danger delete-device-btn"><i class="bi bi-trash"></i></button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

const devicesTableHead = document.querySelector('#devicesTable thead');
if (devicesTableHead) {
    devicesTableHead.addEventListener('click', function (e) {
        const th = e.target.closest('th');
        if (!th) return;
        if (th.textContent === 'ID') {
            if (deviceSortField === 'id') deviceSortAsc = !deviceSortAsc;
            else { deviceSortField = 'id'; deviceSortAsc = true; }
            sortAndRenderDevices();
        }
        if (th.textContent === 'Name') {
            if (deviceSortField === 'DeviceName') deviceSortAsc = !deviceSortAsc;
            else { deviceSortField = 'DeviceName'; deviceSortAsc = true; }
            sortAndRenderDevices();
        }
    });
}

function sortAndRenderDevices() {
    let data = [...cachedDevices];
    if (deviceSortField) {
        data.sort((a, b) => {
            if (deviceSortField === 'id') {
                return deviceSortAsc ? a.id - b.id : b.id - a.id;
            } else if (deviceSortField === 'DeviceName') {
                return deviceSortAsc
                    ? (a.DeviceName || '').localeCompare(b.DeviceName || '')
                    : (b.DeviceName || '').localeCompare(a.DeviceName || '');
            }
            return 0;
        });
    }
    renderDevicesTable(data);
}

const maintenanceTableHead = document.querySelector('#maintenanceTable thead');
if (maintenanceTableHead) {
    maintenanceTableHead.addEventListener('click', function (e) {
        const th = e.target.closest('th');
        if (!th) return;
        if (th.textContent === 'ID') {
            if (maintenanceSortField === 'id') maintenanceSortAsc = !maintenanceSortAsc;
            else { maintenanceSortField = 'id'; maintenanceSortAsc = true; }
            sortAndRenderMaintenance();
        }
        if (th.textContent === 'Device') {
            if (maintenanceSortField === 'DeviceID') maintenanceSortAsc = !maintenanceSortAsc;
            else { maintenanceSortField = 'DeviceID'; maintenanceSortAsc = true; }
            sortAndRenderMaintenance();
        }
        if (th.textContent === 'Type') {
            if (maintenanceSortField === 'MaintenanceType') maintenanceSortAsc = !maintenanceSortAsc;
            else { maintenanceSortField = 'MaintenanceType'; maintenanceSortAsc = true; }
            sortAndRenderMaintenance();
        }
    });
}

function sortAndRenderMaintenance() {
    let data = [...cachedSchedules];
    if (maintenanceSortField) {
        data.sort((a, b) => {
            if (maintenanceSortField === 'id') {
                return maintenanceSortAsc ? a.id - b.id : b.id - a.id;
            } else if (maintenanceSortField === 'DeviceID') {
                return maintenanceSortAsc ? a.DeviceID - b.DeviceID : b.DeviceID - a.DeviceID;
            } else if (maintenanceSortField === 'MaintenanceType') {
                return maintenanceSortAsc
                    ? (a.MaintenanceType || '').localeCompare(b.MaintenanceType || '')
                    : (b.MaintenanceType || '').localeCompare(a.MaintenanceType || '');
            }
            return 0;
        });
    }
    renderMaintenanceTable(data);
}

const alertSearchInput = document.getElementById('alertsSearch');
if (alertSearchInput) {
    alertSearchInput.addEventListener('input', function () {
        const keyword = this.value.toLowerCase();
        const filtered = cachedAlerts.filter(alert =>
            (alert.id + '').includes(keyword) ||
            (alert.DeviceID + '').includes(keyword) ||
            (alert.Message || '').toLowerCase().includes(keyword)
        );
        renderAlertsTable(filtered);
    });
}

function renderAlertsTable(data) {
    const tbody = document.querySelector('#alertsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    (data || cachedAlerts).forEach(alert => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${alert.id}</td>
            <td>${alert.DeviceID || ''}</td>
            <td>${alert.Message || ''}</td>
            <td>${alert.AlertDate ? new Date(alert.AlertDate).toLocaleDateString() : ''}</td>
            <td>${alert.Severity || ''}</td>
            <td>
                <button class="btn btn-sm btn-success resolve-alert-btn"><i class="bi bi-check-lg"></i></button>
                <button class="btn btn-sm btn-warning edit-alert-btn"><i class="bi bi-pencil"></i></button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

let alertSortField = null;
let alertSortAsc = true;
const alertsTableHead = document.querySelector('#alertsTable thead');
if (alertsTableHead) {
    alertsTableHead.addEventListener('click', function (e) {
        const th = e.target.closest('th');
        if (!th) return;
        if (th.textContent === 'ID') {
            if (alertSortField === 'id') alertSortAsc = !alertSortAsc;
            else { alertSortField = 'id'; alertSortAsc = true; }
            sortAndRenderAlerts();
        }
        if (th.textContent === 'Device') {
            if (alertSortField === 'DeviceID') alertSortAsc = !alertSortAsc;
            else { alertSortField = 'DeviceID'; alertSortAsc = true; }
            sortAndRenderAlerts();
        }
        if (th.textContent === 'Alert') {
            if (alertSortField === 'Message') alertSortAsc = !alertSortAsc;
            else { alertSortField = 'Message'; alertSortAsc = true; }
            sortAndRenderAlerts();
        }
    });
}
function sortAndRenderAlerts() {
    let data = [...cachedAlerts];
    if (alertSortField) {
        data.sort((a, b) => {
            if (alertSortField === 'id') {
                return alertSortAsc ? a.id - b.id : b.id - a.id;
            } else if (alertSortField === 'DeviceID') {
                return alertSortAsc ? a.DeviceID - b.DeviceID : b.DeviceID - a.DeviceID;
            } else if (alertSortField === 'Message') {
                return alertSortAsc
                    ? (a.Message || '').localeCompare(b.Message || '')
                    : (b.Message || '').localeCompare(a.Message || '');
            }
            return 0;
        });
    }
    renderAlertsTable(data);
}

// Search Alerts
const alertsSearchInput = document.getElementById('alertsSearch');
if (alertsSearchInput) {
    alertsSearchInput.addEventListener('input', function () {
        const keyword = this.value.toLowerCase();
        const filtered = cachedAlerts.filter(alert =>
            (alert.DeviceID + '').includes(keyword) ||
            (alert.Message || '').toLowerCase().includes(keyword)
        );
        renderAlertsTable(filtered);
    });
}

// Search Devices
const devicesSearchInput = document.getElementById('devicesSearch');
if (devicesSearchInput) {
    devicesSearchInput.addEventListener('input', function () {
        const keyword = this.value.toLowerCase();
        const filtered = cachedDevices.filter(device =>
            (device.id + '').includes(keyword) ||
            (device.DeviceName || '').toLowerCase().includes(keyword) ||
            (device.SerialNumber || '').toLowerCase().includes(keyword)
        );
        renderDevicesTable(filtered);
    });
}

document.getElementById('saveScheduleBtn').addEventListener('click', async function () {
    const deviceId = document.getElementById('scheduleDevice').value;
    const scheduledDate = new Date(document.getElementById('scheduledDate').value);
    const completedDateInput = document.getElementById('completedDate');
    const completedDate = completedDateInput && completedDateInput.value ? new Date(completedDateInput.value) : null;
    // Lấy ngày lắp đặt của thiết bị từ cachedDevices
    const device = cachedDevices.find(d => d.id == deviceId);
    const installDate = device && device.PurchaseDate ? new Date(device.PurchaseDate) : null;
    // Kiểm tra logic ngày
    if (installDate && scheduledDate < installDate) {
        showToast('error', 'Ngày bảo trì phải lớn hơn hoặc bằng ngày lắp đặt!');
        return;
    }
    if (completedDate && completedDate < scheduledDate) {
        showToast('error', 'Ngày hoàn thành phải lớn hơn hoặc bằng ngày bảo trì!');
        return;
    }
    const data = {
        DeviceID: deviceId,
        TechnicianID: document.getElementById('scheduleTechnician').value,
        MaintenanceType: document.getElementById('maintenanceType').value,
        ScheduledDate: document.getElementById('scheduledDate').value,
        Status: document.getElementById('scheduleStatus').value,
        Description: document.getElementById('scheduleDescription').value,
        Notes: document.getElementById('scheduleNotes') ? document.getElementById('scheduleNotes').value : ''
    };
    if (completedDateInput && completedDateInput.value) {
        data.CompletedDate = completedDateInput.value;
    }
    if (scheduleEditMode === 'add') {
        axios.post('/maintenance', data)
            .then(() => {
                showToast('success', 'Thêm lịch bảo trì thành công');
                loadDashboardData();
                bootstrap.Modal.getInstance(document.getElementById('addScheduleModal')).hide();
            })
            .catch(() => showToast('error', 'Thêm lịch bảo trì thất bại'));
    } else if (scheduleEditMode === 'edit' && editingScheduleId) {
        axios.put(`/maintenance/${editingScheduleId}`, data)
            .then(() => {
                showToast('success', 'Cập nhật lịch bảo trì thành công');
                loadDashboardData();
                bootstrap.Modal.getInstance(document.getElementById('addScheduleModal')).hide();
            })
            .catch(() => showToast('error', 'Cập nhật lịch bảo trì thất bại'));
    }
});