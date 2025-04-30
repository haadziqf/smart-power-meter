// Load devices for current user
async function loadDevices() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: devices, error } = await supabase
            .from('devices')
            .select('*')
            .eq('user_id', user.id);

        if (error) throw error;

        displayDevices(devices);
    } catch (error) {
        showError(error.message);
    }
}

// Display devices in the UI
function displayDevices(devices) {
    const deviceList = document.getElementById('deviceList');
    deviceList.innerHTML = '';

    if (!devices || devices.length === 0) {
        deviceList.innerHTML = '<p>No devices found. Add your first device!</p>';
        return;
    }

    devices.forEach(device => {
        const deviceElement = document.createElement('div');
        deviceElement.className = 'device-item';
        deviceElement.innerHTML = `
            <h6>${device.name}</h6>
            <p>Location: ${device.location}</p>
            <p>Device ID: ${device.device_id}</p>
            <div class="device-actions">
                <button class="btn btn-sm btn-primary edit-device" data-id="${device.id}">Edit</button>
                <button class="btn btn-sm btn-danger delete-device" data-id="${device.id}">Delete</button>
                <button class="btn btn-sm btn-info view-readings" data-id="${device.id}">View Readings</button>
            </div>
        `;
        deviceList.appendChild(deviceElement);
    });

    // Add event listeners for device actions
    document.querySelectorAll('.edit-device').forEach(button => {
        button.addEventListener('click', (e) => editDevice(e.target.dataset.id));
    });

    document.querySelectorAll('.delete-device').forEach(button => {
        button.addEventListener('click', (e) => deleteDevice(e.target.dataset.id));
    });

    document.querySelectorAll('.view-readings').forEach(button => {
        button.addEventListener('click', (e) => viewReadings(e.target.dataset.id));
    });
}

// Add new device
async function addDevice(deviceData) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
            .from('devices')
            .insert([
                {
                    ...deviceData,
                    user_id: user.id
                }
            ]);

        if (error) throw error;

        loadDevices();
    } catch (error) {
        showError(error.message);
    }
}

// Edit device
async function editDevice(deviceId) {
    try {
        const { data: device, error } = await supabase
            .from('devices')
            .select('*')
            .eq('id', deviceId)
            .single();

        if (error) throw error;

        // Show edit form (to be implemented)
        showEditDeviceForm(device);
    } catch (error) {
        showError(error.message);
    }
}

// Delete device
async function deleteDevice(deviceId) {
    if (!confirm('Are you sure you want to delete this device?')) return;

    try {
        const { error } = await supabase
            .from('devices')
            .delete()
            .eq('id', deviceId);

        if (error) throw error;

        loadDevices();
    } catch (error) {
        showError(error.message);
    }
}

// View device readings
async function viewReadings(deviceId) {
    try {
        const { data: readings, error } = await supabase
            .from('readings')
            .select('*')
            .eq('device_id', deviceId)
            .order('timestamp', { ascending: false })
            .limit(100);

        if (error) throw error;

        // Display readings in a modal or chart (to be implemented)
        displayReadings(readings);
    } catch (error) {
        showError(error.message);
    }
}

// Add device button handler
document.getElementById('addDeviceBtn').addEventListener('click', () => {
    // Show add device form (to be implemented)
    showAddDeviceForm();
});

// Helper function to show add device form
function showAddDeviceForm() {
    const form = `
        <div class="modal fade" id="addDeviceModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Add New Device</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="addDeviceForm">
                            <div class="mb-3">
                                <label for="deviceName" class="form-label">Device Name</label>
                                <input type="text" class="form-control" id="deviceName" required>
                            </div>
                            <div class="mb-3">
                                <label for="deviceLocation" class="form-label">Location</label>
                                <input type="text" class="form-control" id="deviceLocation" required>
                            </div>
                            <div class="mb-3">
                                <label for="deviceId" class="form-label">Device ID</label>
                                <input type="text" class="form-control" id="deviceId" required>
                            </div>
                            <div class="mb-3">
                                <label for="calibrationFactor" class="form-label">Calibration Factor</label>
                                <input type="number" class="form-control" id="calibrationFactor" value="1000" required>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="saveDeviceBtn">Save Device</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', form);
    const modal = new bootstrap.Modal(document.getElementById('addDeviceModal'));
    modal.show();

    document.getElementById('saveDeviceBtn').addEventListener('click', async () => {
        const deviceData = {
            name: document.getElementById('deviceName').value,
            location: document.getElementById('deviceLocation').value,
            device_id: document.getElementById('deviceId').value,
            calibration_factor: parseFloat(document.getElementById('calibrationFactor').value)
        };

        await addDevice(deviceData);
        modal.hide();
        document.getElementById('addDeviceModal').remove();
    });
} 