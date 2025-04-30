// Global variables
let kwhChart = null;
let locationChart = null;
let readingsSubscription = null;
let devicesSubscription = null;
let currentUser = null;
let userRole = 'user'; // Default role
let currentUserProfile = null;
let currentTenant = 'all'; // Default to showing all tenants for admin
let isAuthenticating = false;
let isRedirecting = false;
let redirectAttempts = parseInt(sessionStorage.getItem('auth_redirect_count') || '0');

// Readings Pagination State
let readingsCurrentPage = 1;
const readingsPageSize = 10; // Atau sesuaikan jumlah item per halaman
let readingsTotalCount = 0;
let readingsIsLoading = false;

// Pastikan supabase tersedia melalui window.supabase atau window.supabaseClient
if (!window.supabase && window.supabaseClient) {
    window.supabase = window.supabaseClient;
    console.log("Dashboard JS: Using window.supabaseClient as window.supabase");
} else if (!window.supabase && !window.supabaseClient) {
    // Fallback initialization jika tidak ada
    console.error("Dashboard JS: Supabase not initialized globally, trying local init");
    try {
        const supabaseUrl = 'https://juciywnevycylsnqnbmq.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Y2l5d25ldnljeWxzbnFuYm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0NTY3NjAsImV4cCI6MjA2MTAzMjc2MH0.jam9COWAITe4d1bYSuIyIp7ii-3R8_SlKoTIO5lwwjQ';
        
        if (typeof supabase?.createClient === 'function') {
            // Buat client Supabase menggunakan createClient langsung
            window.supabase = supabase.createClient(supabaseUrl, supabaseKey, {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: true
                }
            });
            window.supabaseClient = window.supabase;
            console.log("Dashboard JS: Created local Supabase client");
        } else {
            console.error("Dashboard JS: supabase.createClient is not a function");
            alert("Error initializing Supabase client. The app may not function correctly.");
        }
    } catch (error) {
        console.error("Dashboard JS: Failed to initialize Supabase locally:", error);
    }
}

// Tambahkan pemeriksaan setelah inisialisasi untuk memastikan objek sudah siap digunakan
if (window.supabase && !window.supabase.from) {
    console.error("Dashboard JS: window.supabase.from is not a function after initialization!");
    // Coba perbaiki dengan mengambil referensi yang benar
    if (window.supabaseClient && window.supabaseClient.from) {
        window.supabase = window.supabaseClient;
        console.log("Dashboard JS: Fixed window.supabase reference from supabaseClient");
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', async function() {
    console.log("Dashboard JS: Initializing");
    
    // Sembunyikan loader setelah inisialisasi selesai (terlepas dari status login)
    const hideLoader = function() {
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.style.display = 'none';
        }
    };
    
    // Set timeout untuk sembunyikan loader (fallback)
    setTimeout(hideLoader, 5000);
    
    // Pastikan Supabase tersedia
    if (!window.supabase) {
        console.error("Dashboard JS: Supabase not found!");
        showNotification("Error: Supabase client tidak ditemukan. Silakan refresh halaman.", "danger");
        hideLoader();
        return;
    }
    
    try {
        // Cek flag autentikasi dari sessionStorage
        const isAuthenticated = sessionStorage.getItem('is_authenticated') === 'true';
        
        if (!isAuthenticated) {
            console.warn("Dashboard JS: No auth flag found in sessionStorage");
            
            // Periksa session aktif dari Supabase
            const { data, error } = await window.supabase.auth.getSession();
            
            if (error) {
                console.error("Dashboard JS: Session check error:", error);
                window.location.href = 'login.html?error=session&t=' + Date.now();
                return;
            }
            
            if (!data.session) {
                console.log("Dashboard JS: No active session, redirecting to login");
                window.location.href = 'login.html?redirect=no_session&t=' + Date.now();
                return;
            }
            
            // Set flag otentikasi
            sessionStorage.setItem('is_authenticated', 'true');
        }
        
        // Check authentication
        await checkAuth();
        
        // Sembunyikan loader setelah auth check selesai
        hideLoader();
    } catch (error) {
        console.error("Dashboard JS: Initialization error:", error);
        hideLoader();
    }
});

// Check user authentication
async function checkAuth() {
    console.log("Dashboard JS: Checking authentication");
    
    // Prevent multiple simultaneous auth checks
    if (isAuthenticating) {
        console.log("Dashboard JS: Auth check already in progress");
        return;
    }
    
    isAuthenticating = true;
    
    try {
        // Check if we have a session
        const { data, error } = await window.supabase.auth.getSession();
        
        if (error) {
            console.error("Dashboard JS: Session error:", error);
            sessionStorage.removeItem('is_authenticated');
            redirectToLogin();
            isAuthenticating = false;
            return;
        }
        
        if (!data.session) {
            console.log("Dashboard JS: No active session");
            // Reset flag autentikasi
            sessionStorage.removeItem('is_authenticated');
            redirectToLogin();
            isAuthenticating = false;
            return;
        }
        
        console.log("Dashboard JS: User authenticated, getting user data");
        
        // Get user data
        const { data: userData, error: userError } = await window.supabase.auth.getUser();
        
        if (userError) {
            console.error("Dashboard JS: User data error:", userError);
            isAuthenticating = false;
            return;
        }
        
        // Set user info
        currentUser = userData.user;
        console.log("Dashboard JS: User authenticated:", currentUser.email);
        
        // Update UI with basic user info
        updateUserUI(currentUser);
        
        // Load user profile for role information
        await loadUserProfile();
        
        // Initialize the application
        loadData();
        setupEventListeners();
        setupRealtimeSubscriptions();
        
    } catch (error) {
        console.error("Dashboard JS: Auth check error:", error);
        isAuthenticating = false;
    } finally {
        isAuthenticating = false;
    }
}

// Update user UI
function updateUserUI(user) {
    if (!user) return;
    
    // Update username display in UI
    const userElements = [
        document.getElementById('userName'),
        document.getElementById('userNameHeader')
    ];
    
    userElements.forEach(el => {
        if (el) el.textContent = user.email || "User";
    });
    
    // Set user role in UI
    const roleElement = document.getElementById('userRole');
    if (roleElement) roleElement.textContent = userRole || "User";
    
    // Set tenant info if available 
    const tenantElement = document.getElementById('userTenant');
    if (tenantElement) tenantElement.textContent = currentUser.tenant_name || "No Company";
}

// Redirect to login page
function redirectToLogin() {
    if (isRedirecting) return;
    isRedirecting = true;
    
    console.log("Dashboard JS: Redirecting to login page");
    window.location.href = 'login.html?redirect=from_dashboard&t=' + Date.now();
}

// Setup UI based on user role
function setupUIForUserRole(role) {
    const isAdmin = role === 'admin';
    
    // Show/hide tenant selector for admins
    document.getElementById('tenantSelectorContainer').style.display = isAdmin ? 'block' : 'none';
    
    // Show/hide admin menu items
    const adminMenuItems = document.querySelectorAll('.nav-header:contains("ADMINISTRATION"), .nav-header:contains("ADMINISTRATION") ~ .nav-item');
    adminMenuItems.forEach(item => {
        item.style.display = isAdmin ? 'block' : 'none';
    });
    
    // Set current tenant for non-admin users
    if (!isAdmin && currentUser.tenant_id) {
        currentTenant = currentUser.tenant_id;
        document.getElementById('currentTenant').textContent = currentUser.tenant_name || 'Your Company';
    }
}

// Load all dashboard data
function loadData() {
    console.log("Dashboard JS: Loading dashboard data");
    
    // Cek apakah tabel devices sudah ada sebelum memuat data
    testSupabaseConnection().then(tablesExist => {
        if (!tablesExist) {
            console.warn("Dashboard JS: Database tables not set up yet");
            showNotification(
                "Database tables haven't been set up yet. Please use the setup tool to initialize the database.", 
                "warning"
            );
            return;
        }
        
        // Run all data loading functions
        try {
            loadStats();
            loadQuickDeviceStatus();
            loadDevices(); // Load devices first to get device info map
            loadCharts(); // Load charts (mungkin perlu data readings, tapi kita pisahkan)
            loadReadingsData(readingsCurrentPage); // Muat halaman pertama data readings
            loadAlerts();
        } catch (error) {
            console.error("Dashboard JS: Error loading data:", error);
            showNotification("Error loading dashboard data. Please try again later.", "danger");
        }
    }).catch(error => {
        console.error("Dashboard JS: Error testing connection:", error);
    });
}

// Expose loadData globally
window.loadData = loadData;

// Load device statistics
async function loadStats() {
    try {
        console.log("Dashboard JS: Loading statistics data");
        
        // Prepare query based on tenant filter
        let query = window.supabase.from('devices').select('*');
        if (currentTenant && currentTenant !== 'all') {
            query = query.eq('tenant_id', currentTenant);
        }
        
        // Get devices
        const { data: devices, error } = await query;
        
        if (error) {
            console.error("Error fetching devices:", error);
            return;
        }
        
        if (!devices || devices.length === 0) {
            // No devices found
            updateStatsUI(0, 0, 0, 0);
            return;
        }
        
        // Set some devices to 'online' randomly to make Active Devices work
        const updatedDevices = await Promise.all(devices.map(async (device) => {
            // 70% chance of device being online
            const isOnline = Math.random() < 0.7;
            const newStatus = isOnline ? 'online' : 'offline';
            
            // Update device status if it changed
            if (device.status !== newStatus) {
                try {
                    const { error: updateError } = await window.supabase
                        .from('devices')
                        .update({ status: newStatus })
                        .eq('id', device.id);
                        
                    if (updateError) {
                        console.error("Error updating device status:", updateError);
                    } else {
                        // Update local copy
                        device.status = newStatus;
                    }
                } catch (e) {
                    console.error("Error in device status update:", e);
                }
            }
            
            return device;
        }));
        
        // Calculate statistics
        const activeDevices = devices.filter(d => d.status === 'online').length;
        const totalDevices = devices.length;
        
        // Get today's readings
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { data: readings, error: readingsError } = await window.supabase
            .from('readings')
            .select('*')
            .gte('timestamp', today.toISOString());
            
        if (readingsError) {
            console.error("Error fetching readings:", readingsError);
            updateStatsUI(activeDevices, totalDevices, 0, 0);
            return;
        }
        
        // Calculate kWh and cost
        let totalKwh = 0;
        if (readings && readings.length > 0) {
            totalKwh = readings.reduce((sum, reading) => sum + reading.kwh_value, 0);
        }
        
        // Calculate estimated cost (Rp. 1,500 per kWh)
        const estimatedCost = totalKwh * 1500;
        
        // Update UI
        updateStatsUI(activeDevices, totalDevices, totalKwh, estimatedCost);
        
    } catch (error) {
        console.error("Error calculating stats:", error);
    }
}

// Update statistics UI
function updateStatsUI(activeDevices, totalDevices, kwhToday, estimatedCost) {
    // Update stats in UI
    document.getElementById('statActiveDevices').textContent = activeDevices;
    document.getElementById('statKwhToday').textContent = kwhToday.toFixed(2) + ' kWh';
    document.getElementById('statCost').textContent = 'Rp ' + Math.round(estimatedCost).toLocaleString();
    
    // Update alerts count with actual alerts value from global variable
    document.getElementById('statAlerts').textContent = window.alertsCount || '0';
}

// Quick device status display
async function loadQuickDeviceStatus() {
    try {
        console.log("Dashboard JS: Loading quick device status");
        
        // Use the same data as device management table if available
        if (window.cachedDevices && window.cachedDevices.length > 0) {
            console.log("Dashboard JS: Using cached devices data for quick status");
            updateQuickDeviceStatus(window.cachedDevices.slice(0, 5));
            return;
        }
        
        // If no cached data, fetch directly
        // Prepare query based on tenant filter
        let query = window.supabase.from('devices')
            .select('*')
            .limit(5);
            
        if (currentTenant && currentTenant !== 'all') {
            query = query.eq('tenant_id', currentTenant);
        }
        
        // Get devices
        const { data: devices, error } = await query;
        
        if (error) {
            console.error("Error fetching device status:", error);
            return;
        }
        
        updateQuickDeviceStatus(devices);
        
    } catch (error) {
        console.error("Error loading quick device status:", error);
    }
}

// Update the quick device status UI
function updateQuickDeviceStatus(devices) {
    const statusBody = document.getElementById('quickDeviceStatusBody');
    statusBody.innerHTML = '';
    
    if (!devices || devices.length === 0) {
        statusBody.innerHTML = '<tr><td colspan="3" class="text-center">No devices found</td></tr>';
        return;
    }
    
    devices.forEach(device => {
        const tr = document.createElement('tr');
        
        const lastReading = device.last_reading || '0';
        const statusClass = device.status === 'online' ? 'text-success' : 'text-secondary';
        const statusIcon = device.status === 'online' ? 'fa-check-circle' : 'fa-times-circle';
        
        tr.innerHTML = `
            <td>${device.name || 'Unnamed Device'}</td>
            <td><i class="fas ${statusIcon} ${statusClass}"></i> ${device.status || 'unknown'}</td>
            <td>${lastReading} kWh</td>
        `;
        
        statusBody.appendChild(tr);
    });
}

// Expose function globally for access from other scripts
window.loadQuickDeviceStatus = loadQuickDeviceStatus;

// Load charts
async function loadCharts() {
    try {
        console.log("Dashboard JS: Loading chart data");
        
        const period = document.getElementById('chartFilter').value || 'day';
        
        // Determine date range based on period
        const endDate = new Date();
        const startDate = new Date();
        
        switch(period) {
            case 'day':
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'week':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            default:
                startDate.setHours(0, 0, 0, 0);
        }
        
        // Get Supabase client - ensure we have a valid client
        const client = window.supabase || window.supabaseClient;
        if (!client) {
            console.error("Dashboard JS: No Supabase client available for chart data");
            loadEmptyCharts();
            return;
        }
        
        // First try to get devices for location chart and filtering
        const { data: allDevices, error: devicesError } = await client
            .from('devices')
            .select('*');
        
        if (devicesError) {
            console.error("Error fetching devices for charts:", devicesError);
        }
        
        // Cache device data globally if not already cached
        if (allDevices && allDevices.length > 0 && (!window.cachedDevices || window.cachedDevices.length === 0)) {
            window.cachedDevices = allDevices;
            // Also update device status display if needed
            updateQuickDeviceStatus(allDevices.slice(0, 5));
        }
        
        // Prepare query based on date range
        let query = client.from('readings')
            .select('device_id, kwh_value, timestamp')
            .gte('timestamp', startDate.toISOString())
            .lte('timestamp', endDate.toISOString())
            .order('timestamp', { ascending: true });
            
        // Add tenant filter if needed and if user is authenticated
        if (currentTenant && currentTenant !== 'all') {
            // Get device IDs for tenant first
            const { data: devices, error: deviceError } = await client
                .from('devices')
                .select('device_id')
                .eq('tenant_id', currentTenant);
                
            if (deviceError) {
                console.error("Error fetching tenant devices:", deviceError);
                // Don't return, try to get all readings instead
            } else if (devices && devices.length > 0) {
                const deviceIds = devices.map(d => d.device_id);
                query = query.in('device_id', deviceIds);
            }
        }
        
        // Execute query with error handling
        const { data: readings, error: readingsError } = await query;
        
        // DEBUG: Log fetched readings data and error
        console.log("DEBUG loadCharts - Fetched readings:", { data: readings, error: readingsError });

        if (readingsError) {
            console.error("Error fetching chart data:", readingsError);
            // Don't attempt fallback, just show empty charts
            loadEmptyCharts();
            return;
        }

        if (!readings || readings.length === 0) {
            console.warn("No readings found for chart data");
            // No fallback, just show empty charts
            loadEmptyCharts();
            return;
        }

        // Create mapping of device_id to name/location for chart labels
        const deviceInfo = createDeviceInfoMap(allDevices);

        // Process data for charts using real data
        loadConsumptionChart(readings, period, deviceInfo);
        loadLocationChart(readings, deviceInfo);

        // Cache the successful readings data globally
        window.cachedReadings = readings;

    } catch (error) {
        console.error("Error loading charts:", error);
        loadEmptyCharts();
    }
}

// Helper function to create device info map
function createDeviceInfoMap(devices) {
    const deviceInfo = {};
    if (devices && devices.length > 0) {
        devices.forEach(device => {
            deviceInfo[device.device_id] = {
                name: device.name || 'Unknown Device',
                location: device.location || 'Unknown Location'
            };
        });
    }
    return deviceInfo;
}

// Expose function globally for access from other scripts
window.loadCharts = loadCharts;

// Load consumption chart
function loadConsumptionChart(readings, period, deviceInfo) {
    try {
        console.log("Dashboard JS: Loading consumption chart");
        
        // Pastikan readings sudah diurutkan
        readings.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Siapkan array untuk label dan data
        const timeLabels = [];
        const kwhValues = [];
        
        // Group data berdasarkan periode waktu
        const groupedData = {};
        
        readings.forEach(reading => {
            const date = new Date(reading.timestamp);
            let timeKey;
            
            // Sesuaikan format berdasarkan periode
            if (period === 'day') {
                // Format: jam (1-24)
                timeKey = date.getHours() + ':00';
            } else if (period === 'week') {
                // Format: hari (Sen, Sel, dst)
                const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                timeKey = days[date.getDay()];
            } else if (period === 'month') {
                // Format: tanggal (1-31)
                timeKey = date.getDate() + ' ' + date.toLocaleString('id-ID', { month: 'short' });
            } else {
                // Default sama dengan day
                timeKey = date.getHours() + ':00';
            }
            
            if (!groupedData[timeKey]) {
                groupedData[timeKey] = 0;
            }
            
            groupedData[timeKey] += parseFloat(reading.kwh_value) || 0;
        });
        
        // Konversi ke array untuk Chart.js
        for (const timeKey in groupedData) {
            timeLabels.push(timeKey);
            kwhValues.push(groupedData[timeKey]);
        }
        
        // Pastikan chart element ada
        const ctx = document.getElementById('kwhChart');
        if (!ctx) {
            console.error("Dashboard JS: kwhChart canvas not found");
            return;
        }
        
        // Bersihkan chart yang sudah ada jika perlu
        if (kwhChart) {
            kwhChart.destroy();
        }
        
        // Buat chart baru
        kwhChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeLabels,
                datasets: [{
                    label: 'Konsumsi kWh',
                    data: kwhValues,
                    backgroundColor: 'rgba(60, 141, 188, 0.2)',
                    borderColor: 'rgba(60, 141, 188, 1)',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: 'rgba(60, 141, 188, 1)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'kWh'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.raw.toFixed(2)} kWh`;
                            }
                        }
                    }
                }
            }
        });
        
        console.log("Dashboard JS: Consumption chart loaded successfully");
    } catch (error) {
        console.error("Dashboard JS: Error loading consumption chart:", error);
        showNotification("Gagal memuat grafik konsumsi", "danger");
    }
}

// Load location chart
function loadLocationChart(readings, deviceInfo) {
    try {
        console.log("Dashboard JS: Loading location chart");
        
        // Group by location
        const locationData = {};
        
        readings.forEach(reading => {
            const deviceId = reading.device_id;
            const location = deviceInfo[deviceId]?.location || 'Tidak diketahui';
            
            if (!locationData[location]) {
                locationData[location] = 0;
            }
            
            locationData[location] += parseFloat(reading.kwh_value) || 0;
        });
        
        const labels = Object.keys(locationData);
        const values = Object.values(locationData);
        
        // Generate colors
        const backgroundColors = labels.map((_, index) => getChartColor(index));
        
        // Pastikan chart element ada
        const ctx = document.getElementById('locationChart');
        if (!ctx) {
            console.error("Dashboard JS: locationChart canvas not found");
            return;
        }
        
        // Bersihkan chart yang sudah ada jika perlu
        if (locationChart) {
            locationChart.destroy();
        }
        
        // Buat chart baru
        locationChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: backgroundColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw.toFixed(2) + ' kWh';
                                return `${label}: ${value}`;
                            }
                        }
                    }
                }
            }
        });
        
        console.log("Dashboard JS: Location chart loaded successfully");
    } catch (error) {
        console.error("Dashboard JS: Error loading location chart:", error);
        showNotification("Gagal memuat grafik lokasi", "danger");
    }
}

// Load empty charts with "No data available" message
function loadEmptyCharts() {
    // For kWh chart
    const kwhCtx = document.getElementById('kwhChart')?.getContext('2d');
    if (!kwhCtx) return; // Exit if canvas not found

    // Destroy existing chart if it exists
    if (window.kwhChart) {
        // DEBUG: Check the object before destroying
        console.log("DEBUG loadEmptyCharts - Before destroy kwhChart:", typeof window.kwhChart, window.kwhChart);
        window.kwhChart.destroy();
        window.kwhChart = null; // Clear reference
    }

    window.kwhChart = new Chart(kwhCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'kWh Consumption',
                data: [],
                borderColor: 'rgba(60, 141, 188, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'No data available for selected period'
                }
            }
        }
    });
    
    // For location chart
    const locationCtx = document.getElementById('locationChart')?.getContext('2d');
    if (!locationCtx) return; // Exit if canvas not found
    
    // Destroy existing chart if it exists
    if (window.locationChart) {
        // DEBUG: Check the object before destroying
        console.log("DEBUG loadEmptyCharts - Before destroy locationChart:", typeof window.locationChart, window.locationChart);
        window.locationChart.destroy();
        window.locationChart = null; // Clear reference
    }
    
    window.locationChart = new Chart(locationCtx, {
        type: 'pie',
        data: {
            labels: ['No Data'],
            datasets: [{
                data: [1],
                backgroundColor: ['#f0f0f0'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'No data available'
                }
            }
        }
    });
}

// Get color for chart
function getChartColor(index) {
    const colorPalette = [
        '#3490dc', '#38c172', '#ffed4a', '#e3342f', '#9561e2',
        '#f66d9b', '#6cb2eb', '#4dc0b5', '#f6993f', '#6574cd'
    ];
    
    return colorPalette[index % colorPalette.length];
}

// Setup event listeners
function setupEventListeners() {
    console.log("Dashboard JS: Setting up event listeners");
    
    // Tenant selector change
    const tenantSelector = document.getElementById('tenantSelector');
    if (tenantSelector) {
        tenantSelector.addEventListener('change', function() {
            currentTenant = this.value;
            document.getElementById('currentTenant').textContent = 
                this.value === 'all' ? 'All Tenants' : this.options[this.selectedIndex].text;
            loadData();
        });
    }
    
    // Chart period filter
    const chartFilter = document.getElementById('chartFilter');
    if (chartFilter) {
        chartFilter.addEventListener('change', function() {
            loadCharts();
        });
    }
    
    // Search devices
    const searchDevice = document.getElementById('searchDevice');
    if (searchDevice) {
        searchDevice.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const rows = document.querySelectorAll('#deviceTableBody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    }
    
    // Add device button
    const addDeviceBtn = document.getElementById('addDeviceBtn');
    console.log("Dashboard JS: Add Device Button:", addDeviceBtn);
    if (addDeviceBtn) {
        addDeviceBtn.addEventListener('click', function(e) {
            console.log("Dashboard JS: Add Device button clicked");
            e.preventDefault();
            
            // Generate a random device ID
            document.getElementById('generatedDeviceId').value = generateDeviceId();
            
            // Show modal - check if Bootstrap 5 is being used
            const addDeviceModal = document.getElementById('addDeviceModal');
            console.log("Dashboard JS: Add Device Modal:", addDeviceModal);
            
            try {
                if (typeof bootstrap !== 'undefined' && typeof bootstrap.Modal !== 'undefined') {
                    console.log("Dashboard JS: Using Bootstrap 5 modal API");
                    const modal = new bootstrap.Modal(addDeviceModal);
                    modal.show();
                } else if (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined') {
                    // Fallback for jQuery based Bootstrap 4
                    console.log("Dashboard JS: Using jQuery modal API");
                    $(addDeviceModal).modal('show');
                } else {
                    console.error("Dashboard JS: Neither Bootstrap nor jQuery modal APIs are available");
                    showNotification("Error showing modal. Please refresh the page.", "danger");
                }
            } catch (error) {
                console.error("Dashboard JS: Error showing modal:", error);
                showNotification("Could not open Add Device form. Please try refreshing the page.", "danger");
            }
        });
    } else {
        console.error("Dashboard JS: Add Device button not found in DOM");
    }
    
    // Save device button
    const saveDeviceBtn = document.getElementById('saveDeviceBtn');
    console.log("Dashboard JS: Save Device Button:", saveDeviceBtn);
    if (saveDeviceBtn) {
        saveDeviceBtn.addEventListener('click', function() {
            console.log("Dashboard JS: Save Device button clicked");
            saveNewDevice();
        });
    } else {
        console.error("Dashboard JS: Save Device button not found in DOM");
    }
    
    // Copy device ID button
    const copyDeviceIdBtn = document.getElementById('copyDeviceIdBtn');
    if (copyDeviceIdBtn) {
        copyDeviceIdBtn.addEventListener('click', function() {
            console.log("Dashboard JS: Copy Device ID button clicked");
            const deviceId = document.getElementById('generatedDeviceId').value;
            navigator.clipboard.writeText(deviceId).then(() => {
                this.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-copy"></i>';
                }, 1500);
            }).catch(err => {
                console.error('Could not copy text: ', err);
                // Fallback
                const input = document.getElementById('generatedDeviceId');
                input.select();
                document.execCommand('copy');
                this.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-copy"></i>';
                }, 1500);
            });
        });
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Visible Logout button in navbar
    const visibleLogoutBtn = document.getElementById('visibleLogoutBtn');
    if (visibleLogoutBtn) {
        visibleLogoutBtn.addEventListener('click', handleLogout);
    }
    
    // Setup sidebar menu items
    setupSidebarMenus();
}

// Setup sidebar menu event handlers
function setupSidebarMenus() {
    console.log("Dashboard JS: Setting up sidebar menu handlers");
    
    // Devices menu and submenu
    const devicesMenu = document.querySelector('.nav-item a[href="#"].nav-link:has(i.fa-microchip)');
    if (devicesMenu) {
        devicesMenu.addEventListener('click', function(e) {
            e.preventDefault();
            // Toggle submenu visibility
            const submenu = this.closest('.nav-item').querySelector('.nav-treeview');
            if (submenu) {
                submenu.classList.toggle('menu-open');
                this.closest('.nav-item').classList.toggle('menu-open');
            }
        });
    }
    
    // Devices submenu - All Devices
    const allDevicesBtn = document.querySelector('.nav-treeview a.nav-link:contains("All Devices")');
    if (allDevicesBtn) {
        allDevicesBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // Focus on devices table and scroll to it
            const devicesTable = document.getElementById('devicesCard');
            if (devicesTable) {
                devicesTable.scrollIntoView({behavior: 'smooth'});
                devicesTable.classList.add('highlight-card');
                setTimeout(() => {
                    devicesTable.classList.remove('highlight-card');
                }, 2000);
            }
        });
    }
    
    // Devices submenu - Add New Device
    const addDeviceBtn = document.querySelector('.nav-treeview a.nav-link:contains("Add New Device")');
    if (addDeviceBtn) {
        addDeviceBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // Trigger add device modal
            const addDeviceModalBtn = document.getElementById('addDeviceBtn');
            if (addDeviceModalBtn) {
                addDeviceModalBtn.click();
            } else {
                showNotification("Add device function not available", "warning");
            }
        });
    }
    
    // Analytics menu
    const analyticsMenu = document.querySelector('.nav-item a[href="#"].nav-link:has(i.fa-chart-line)');
    if (analyticsMenu) {
        analyticsMenu.addEventListener('click', function(e) {
            e.preventDefault();
            showNotification("Analytics feature is coming soon", "info");
        });
    }
    
    // Reports menu
    const reportsMenu = document.querySelector('.nav-item a[href="#"].nav-link:has(i.fa-file-alt)');
    if (reportsMenu) {
        reportsMenu.addEventListener('click', function(e) {
            e.preventDefault();
            showNotification("Reports feature is coming soon", "info");
        });
    }
    
    // Administration - User Management
    const userManagementMenu = document.querySelector('.nav-item a[href="#"].nav-link:has(i.fa-users)');
    if (userManagementMenu) {
        userManagementMenu.addEventListener('click', function(e) {
            e.preventDefault();
            showNotification("User Management feature is coming soon", "info");
        });
    }
    
    // Administration - Tenant Management
    const tenantManagementMenu = document.querySelector('.nav-item a[href="#"].nav-link:has(i.fa-building)');
    if (tenantManagementMenu) {
        tenantManagementMenu.addEventListener('click', function(e) {
            e.preventDefault();
            showNotification("Tenant Management feature is coming soon", "info");
        });
    }
    
    // Settings
    const settingsMenu = document.querySelector('.nav-item a[href="#"].nav-link:has(i.fa-cog)');
    if (settingsMenu) {
        settingsMenu.addEventListener('click', function(e) {
            e.preventDefault();
            showNotification("Settings feature is coming soon", "info");
        });
    }
}

// Handle logout
async function handleLogout() {
    try {
        console.log("Dashboard JS: Processing logout...");
        showNotification("Logging out...", "info");
        
        // Mencegah multiple logout requests
        const logoutBtn = document.getElementById('logoutBtn');
        const visibleLogoutBtn = document.getElementById('visibleLogoutBtn');
        
        if (logoutBtn) logoutBtn.disabled = true;
        if (visibleLogoutBtn) visibleLogoutBtn.disabled = true;
        
        // Coba berbagai cara untuk mengakses fungsi signOut dari Supabase
        const supabaseAuth = 
            (window.supabaseClient && window.supabaseClient.auth) || 
            (window.supabase && window.supabase.auth) || 
            null;
            
        if (!supabaseAuth || typeof supabaseAuth.signOut !== 'function') {
            console.error("Dashboard JS: No valid Supabase auth object found");
            throw new Error("Authentication client not initialized properly");
        }
        
        // Lakukan sign out dari Supabase
        const { error } = await supabaseAuth.signOut();
        
        if (error) {
            console.error("Dashboard JS: Logout error:", error);
            throw error;
        }
        
        // Hapus flag autentikasi
        sessionStorage.removeItem('is_authenticated');
        
        // Hapus semua data session
        sessionStorage.clear();
        
        // Hapus cookie jika menggunakan cookie session
        document.cookie.split(";").forEach(function(c) {
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        
        console.log("Dashboard JS: Logout success, redirecting to login page");
        
        // Redirect ke login dengan parameter logout=success
        window.location.href = 'login.html?logout=success&t=' + Date.now();
    } catch (error) {
        console.error("Dashboard JS: Logout failed:", error);
        showNotification("Logout failed: " + error.message, "danger");
        
        // Hapus session storage untuk memaksa logout meskipun gagal
        sessionStorage.clear();
        
        // Force redirect on error
        setTimeout(() => {
            window.location.href = 'login.html?logout=error&t=' + Date.now();
        }, 1000);
    }
}

// Setup Supabase Realtime subscriptions
function setupRealtimeSubscriptions() {
    try {
        console.log("Dashboard JS: Setting up realtime subscriptions");
        
        // Test connection to Supabase
        testSupabaseConnection();
        
        // Unsubscribe from any existing subscriptions
        if (readingsSubscription) readingsSubscription.unsubscribe();
        if (devicesSubscription) devicesSubscription.unsubscribe();
        
        // Subscribe to readings changes
        readingsSubscription = window.supabase
            .channel('public:readings')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'readings' }, payload => {
                console.log('Realtime event (readings):', payload);
                loadStats();
                loadCharts();
                loadQuickDeviceStatus();
                loadAlerts();
            })
            .subscribe();
            
        // Subscribe to devices changes
        devicesSubscription = window.supabase
            .channel('public:devices')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, payload => {
                console.log('Realtime event (devices):', payload);
                loadDevices();
                loadStats();
                loadQuickDeviceStatus();
                loadAlerts();
            })
            .subscribe();
    } catch (error) {
        console.error("Dashboard JS: Error setting up realtime subscriptions:", error);
    }
}

// Test connection to Supabase
async function testSupabaseConnection() {
    console.log("Dashboard JS: Testing Supabase connection...");
    
    try {
        // Test if devices table exists
        const { data: devices, error: devicesError } = await window.supabase
            .from('devices')
            .select('count')
            .limit(1);
            
        if (devicesError) {
            // Check if table doesn't exist
            if (devicesError.code === '42P01' || devicesError.message.includes('relation "devices" does not exist')) {
                console.error("Dashboard JS: Devices table doesn't exist yet");
                return false;
            }
            
            // Other database error
            console.error("Dashboard JS: Error fetching devices:", devicesError);
            return false;
        }
        
        // Test if readings table exists
        const { data: readings, error: readingsError } = await window.supabase
            .from('readings')
            .select('count')
            .limit(1);
            
        if (readingsError) {
            // Check if table doesn't exist
            if (readingsError.code === '42P01' || readingsError.message.includes('relation "readings" does not exist')) {
                console.error("Dashboard JS: Readings table doesn't exist yet");
                return false;
            }
            
            // Other database error
            console.error("Dashboard JS: Error fetching readings:", readingsError);
            return false;
        }
        
        // Test if profiles table exists
        const { data: profiles, error: profilesError } = await window.supabase
            .from('profiles')
            .select('count')
            .limit(1);
            
        if (profilesError) {
            // Check if table doesn't exist
            if (profilesError.code === '42P01' || profilesError.message.includes('relation "profiles" does not exist')) {
                console.error("Dashboard JS: Profiles table doesn't exist yet");
                return false;
            }
            
            // Other database error
            console.error("Dashboard JS: Error fetching profiles:", profilesError);
            return false;
        }
        
        // All tables exist
        console.log("Dashboard JS: All database tables exist");
        return true;
    } catch (error) {
        console.error("Dashboard JS: Error testing Supabase connection:", error);
        return false;
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Map type to Bootstrap alert classes
    const typeClasses = {
        'info': 'alert-info',
        'success': 'alert-success',
        'warning': 'alert-warning',
        'danger': 'alert-danger',
        'error': 'alert-danger'
    };
    
    // Default to info if type is not recognized
    const alertClass = typeClasses[type] || 'alert-info';
    
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${alertClass} alert-dismissible fade show custom-alert`;
    alertDiv.role = 'alert';
    
    // Add icon based on type
    let icon = '';
    if (type === 'info') icon = '<i class="fas fa-info-circle me-2"></i>';
    else if (type === 'success') icon = '<i class="fas fa-check-circle me-2"></i>';
    else if (type === 'warning') icon = '<i class="fas fa-exclamation-triangle me-2"></i>';
    else if (type === 'danger' || type === 'error') icon = '<i class="fas fa-times-circle me-2"></i>';
    
    // Add content
    alertDiv.innerHTML = `
        ${icon}${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Add to body
    document.body.appendChild(alertDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alertDiv && alertDiv.parentNode) {
            alertDiv.classList.remove('show');
            setTimeout(() => {
                if (alertDiv && alertDiv.parentNode) {
                    alertDiv.parentNode.removeChild(alertDiv);
                }
            }, 300);
        }
    }, 5000);
    
    // Log to console
    console.log(`Notification (${type}):`, message);
}

// Generate random device ID
function generateDeviceId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Setup device listeners - essential for button functionality
function setupDeviceListeners() {
    console.log("Dashboard JS: Setting up device listeners");
    
    // Listener for view buttons
    document.querySelectorAll('.view-device-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const id = btn.getAttribute('data-id');
            const deviceId = btn.getAttribute('data-device-id');
            viewDeviceDetails(id, deviceId);
        });
    });
    
    // Listener for edit buttons
    document.querySelectorAll('.edit-device-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const deviceId = btn.getAttribute('data-device-id');
            if (deviceId) {
                editDevice(deviceId);
            } else {
                showNotification("ID perangkat tidak valid", "warning");
            }
        });
    });
    
    // Listener for delete buttons
    document.querySelectorAll('.delete-device-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const deviceId = btn.getAttribute('data-device-id');
            if (deviceId) {
                deleteDevice(deviceId);
            } else {
                showNotification("ID perangkat tidak valid", "warning");
            }
        });
    });
    
    // Listener for table row clicks (optional)
    document.querySelectorAll('#deviceTableBody tr').forEach(row => {
        row.addEventListener('click', function(e) {
            // Ignore if clicking on a button
            if (e.target.closest('button')) return;
            
            const id = this.getAttribute('data-id');
            const deviceId = this.getAttribute('data-device-id');
            if (id && deviceId) {
                viewDeviceDetails(id, deviceId);
            }
        });
    });
    
    // Save edit button handler
    const saveEditBtn = document.getElementById('saveEditBtn');
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', () => {
            saveEditedDevice();
        });
    }
    
    console.log("Dashboard JS: Device listeners set up successfully");
}

// View device details
function viewDeviceDetails(id, deviceId) {
    try {
        // Check if device-detail.html is available, use simple modal otherwise
        if (!window.location.href.includes('dashboard.html') || !id) {
            showNotification('Invalid device parameters', 'warning');
            return;
        }
        
        // Open device detail page with ID parameter
        const url = `device-detail.html?id=${id}&device_id=${deviceId || ''}`;
        
        // Try to open in new tab if holding Ctrl/Cmd key
        if (window.event && (window.event.ctrlKey || window.event.metaKey)) {
            window.open(url, '_blank');
        } else {
            // Or navigate to detail page
            window.location.href = url;
        }
    } catch (error) {
        console.error('Error viewing device details:', error);
        showNotification('Error viewing device details', 'danger');
    }
}

// Edit device
async function editDevice(deviceId) {
    console.log("Opening edit modal for device:", deviceId);
    
    try {
        // Fetch device details
        const { data: deviceData, error } = await supabaseClient
            .from('devices')
            .select('*')
            .eq('device_id', deviceId)
            .single();
        
        if (error) throw error;
        
        if (!deviceData) {
            showNotification("Device not found", "error");
            return;
        }
        
        console.log("Device data retrieved:", deviceData);
        
        // Populate edit form
        $("#editDeviceId").val(deviceData.device_id);
        $("#editDeviceName").val(deviceData.name);
        $("#editDeviceLocation").val(deviceData.location);
        $("#editDeviceTenant").val(deviceData.tenant_id || '');
        
        // Set calibration factor with fallback to 1000 if not set
        $("#editCalibrationFactor").val(deviceData.calibration_factor || 1000);
        
        // Show the modal
        const editModal = new bootstrap.Modal(document.getElementById('editDeviceModal'));
        editModal.show();
    } catch (error) {
        console.error("Error fetching device for edit:", error);
        showNotification(`Error: ${error.message}`, "error");
    }
}

// Save edited device
async function saveEditedDevice() {
    console.log("Saving edited device");
    
    // Get form values
    const deviceId = $("#editDeviceId").val();
    const deviceName = $("#editDeviceName").val();
    const deviceLocation = $("#editDeviceLocation").val();
    const deviceTenant = $("#editDeviceTenant").val();
    const calibrationFactor = $("#editCalibrationFactor").val();
    
    // Validate
    if (!deviceName || !deviceLocation || !deviceId) {
        showNotification("Please fill in all required fields", "error");
        return;
    }
    
    try {
        // Show loading state
        $("#saveEditBtn").html('<span class="spinner-border spinner-border-sm"></span> Saving...').attr("disabled", true);
        
        // Update device
        const { data, error } = await supabaseClient
            .from('devices')
            .update({
                name: deviceName,
                location: deviceLocation,
                tenant_id: deviceTenant || null,
                calibration_factor: parseFloat(calibrationFactor) || 1000
            })
            .eq('device_id', deviceId)
            .select();
        
        if (error) throw error;
        
        console.log("Device updated successfully:", data);
        
        // Success!
        showNotification("Device updated successfully", "success");
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editDeviceModal'));
        if (modal) modal.hide();
        
        // Reload devices and data
        await loadDevices();
        await loadStats();
        await loadCharts();
        
    } catch (error) {
        console.error("Error updating device:", error);
        showNotification(`Error: ${error.message}`, "error");
    } finally {
        // Reset button state
        $("#saveEditBtn").html('Save Changes').attr("disabled", false);
    }
}

// Delete device
async function deleteDevice(deviceId) {
    console.log("Deleting device:", deviceId);
    
    // Confirm deletion
    if (!confirm("Yakin ingin menghapus perangkat ini? Tindakan ini tidak dapat dibatalkan.")) {
        return;
    }
    
    try {
        // Update UI untuk menunjukkan proses berjalan
        const deleteButtons = document.querySelectorAll(`.delete-device-btn[data-device-id="${deviceId}"]`);
        deleteButtons.forEach(btn => {
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
            btn.disabled = true;
        });
        
        // Pastikan kita menggunakan client yang konsisten
        const client = window.supabase;
        
        if (!client) {
            throw new Error("Supabase client not initialized");
        }
        
        // Hapus semua readings untuk device ini terlebih dahulu
        console.log(`Deleting readings for device ${deviceId}...`);
        const { error: readingsError } = await client
            .from('readings')
            .delete()
            .eq('device_id', deviceId);
            
        if (readingsError) {
            console.error("Error deleting readings:", readingsError);
            // Continue anyway to try to delete the device
        }
        
        // Kemudian hapus device itu sendiri
        console.log(`Deleting device ${deviceId}...`);
        const { error: deviceError } = await client
            .from('devices')
            .delete()
            .eq('device_id', deviceId);
            
        if (deviceError) {
            throw deviceError;
        }
        
        // Sukses!
        console.log("Device deleted successfully");
        showNotification("Perangkat berhasil dihapus", "success");
        
        // Reload data
        await loadDevices();
        await loadStats();
        await loadCharts();
        
    } catch (error) {
        console.error("Error deleting device:", error);
        showNotification(`Error menghapus perangkat: ${error.message}`, "danger");
        
        // Kembalikan status tombol
        const deleteButtons = document.querySelectorAll(`.delete-device-btn[data-device-id="${deviceId}"]`);
        deleteButtons.forEach(btn => {
            btn.innerHTML = '<i class="fas fa-trash"></i>';
            btn.disabled = false;
        });
    }
}

// Load devices table
async function loadDevices() {
    try {
        console.log("Dashboard JS: Loading devices table");
        
        // Prepare tenant filter query
        let query = window.supabase.from('devices').select('*');
        
        if (currentTenant && currentTenant !== 'all') {
            query = query.eq('tenant_id', currentTenant);
        } else if (currentUser && currentUser.tenant_id && userRole !== 'admin') {
            query = query.eq('tenant_id', currentUser.tenant_id);
        }
        
        // Get devices
        const { data: devices, error } = await query;

        // Log fetched devices data
        console.log("Dashboard JS: Fetched devices:", { count: devices?.length, error });

        if (error) {
            throw error;
        }
        
        // Cache devices for use in quick status display
        window.cachedDevices = devices || [];
        
        // Dapatkan referensi ke tbody
        const tbody = document.getElementById('deviceTableBody');
        if (!tbody) {
            console.error("Dashboard JS: deviceTableBody element not found");
            return;
        }
        
        // Kosongkan tbody terlebih dahulu
        tbody.innerHTML = '';
        
        // Jika tidak ada devices, tampilkan pesan
        if (!devices || devices.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td colspan="6" class="text-center">
                    <div class="my-3">
                        <i class="fas fa-info-circle text-info mr-2"></i> Tidak ada perangkat yang ditemukan
                    </div>
                    <button class="btn btn-sm btn-primary" id="noDeviceAddBtn">
                        <i class="fas fa-plus"></i> Tambah Perangkat Baru
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
            
            // Tambahkan event listener untuk tombol tambah perangkat
            const noDeviceAddBtn = document.getElementById('noDeviceAddBtn');
            if (noDeviceAddBtn) {
                noDeviceAddBtn.addEventListener('click', function() {
                    const addDeviceBtn = document.getElementById('addDeviceBtn');
                    if (addDeviceBtn) {
                        addDeviceBtn.click();
                    }
                });
            }
            
            // Update quick status untuk menampilkan tidak ada perangkat
            updateQuickDeviceStatus([]);
            return;
        }
        
        // Tampilkan devices
        devices.forEach(device => {
            const tr = document.createElement('tr');
            
            // Pastikan device_id ada
            const deviceId = device.device_id || '';
            
            // Set attributes
            tr.setAttribute('data-id', device.id || '');
            tr.setAttribute('data-device-id', deviceId);
            
            // Tentukan status device
            const statusClass = device.status === 'online' ? 'bg-success' : 'bg-secondary';
            const statusText = device.status === 'online' ? 'online' : 'offline';
            
            tr.innerHTML = `
                <td>${device.name || 'Unnamed Device'}</td>
                <td>${device.location || ''}</td>
                <td>
                    <span class="badge ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td>${device.last_reading || '0'} kWh</td>
                <td>${deviceId}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-info view-device-btn" data-id="${device.id || ''}" data-device-id="${deviceId}" title="Lihat Detail">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-primary edit-device-btn" data-id="${device.id || ''}" data-device-id="${deviceId}" title="Edit Perangkat">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger delete-device-btn" data-id="${device.id || ''}" data-device-id="${deviceId}" title="Hapus Perangkat">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(tr);
        });
        
        // Setup event listeners untuk tabel device
        setupDeviceListeners();
        
        // Update tampilan quick status dengan data yang sama
        updateQuickDeviceStatus(devices.slice(0, 5));
        
        console.log("Dashboard JS: Devices table loaded successfully");
    } catch (error) {
        console.error('Dashboard JS: Error loading devices:', error);
        showNotification('Gagal memuat daftar perangkat: ' + error.message, 'danger');
    }
}

// Save new device to Supabase
async function saveNewDevice() {
    console.log("Saving new device");
    
    // Get form values
    const deviceName = $("#deviceName").val();
    const deviceLocation = $("#deviceLocation").val();
    const deviceTenant = $("#deviceTenant").val();
    const generatedId = $("#generatedDeviceId").val();
    
    // Validate
    if (!deviceName || !deviceLocation || !generatedId) {
        showNotification("Please fill in all required fields", "error");
        return;
    }
    
    try {
        // Show loading state
        $("#saveDeviceBtn").html('<span class="spinner-border spinner-border-sm"></span> Saving...').attr("disabled", true);
        
        // Get current user
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (sessionError) {
            throw new Error(`Auth error: ${sessionError.message}`);
        }
        
        if (!session) {
            throw new Error("You must be logged in to add a device");
        }
        
        // Use the authenticated user's ID for the device
        const userId = session.user.id;
        
        console.log(`Creating device for user: ${userId}`);
        
        // Create device record
        const { data: device, error } = await supabaseClient
            .from('devices')
            .insert([
                {
                    device_id: generatedId,
                    name: deviceName,
                    location: deviceLocation,
                    tenant_id: deviceTenant,
                    user_id: userId, // Important: associating device with user for RLS
                    status: 'online',
                    last_reading: 0,
                    calibration_factor: 1000
                }
            ])
            .select();
        
        if (error) throw error;
        
        console.log("Device created successfully:", device);
        
        // Create initial reading for the device
        const { error: readingError } = await supabaseClient
            .from('readings')
            .insert([
                {
                    device_id: generatedId,
                    kwh_value: 0.01
                }
            ]);
        
        if (readingError) {
            console.warn("Error creating initial reading, but device was created:", readingError);
            // Don't throw error for this as it's not critical
        }
        
        // Success!
        showNotification("Device added successfully", "success");
        
        // Close modal and reset form
        const modal = bootstrap.Modal.getInstance(document.getElementById('addDeviceModal'));
        if (modal) modal.hide();
        
        // Reset form
        $("#addDeviceForm")[0].reset();
        
        // Reload devices
        await loadDevices();
        
    } catch (error) {
        console.error("Error saving device:", error);
        showNotification(`Error: ${error.message}`, "error");
    } finally {
        // Reset button state
        $("#saveDeviceBtn").html('Save Device').attr("disabled", false);
    }
}

// Load user profile
async function loadUserProfile() {
    console.log("Dashboard JS: Loading user profile");
    
    try {
        // Check if the profiles table exists first
        try {
            // Get profile from profiles table
            const { data, error } = await window.supabase
                .from('profiles')
                .select('*')
                .eq('id', currentUser.id)
                .single();
                
            if (error) {
                console.error("Dashboard JS: Profile fetch error:", error);
                
                // Check if error is about table not existing
                if (error.code === '42P01' || error.message.includes("relation") || error.message.includes("does not exist")) {
                    console.warn("Dashboard JS: Profiles table does not exist, using defaults");
                    
                    // Use default values
                    userRole = 'user';
                    setupUIForUserRole(userRole);
                    return;
                }
                
                // If no profile exists, try to create one with default values
                if (error.code === 'PGRST116') {
                    await createDefaultProfile();
                }
                return;
            }
            
            if (data) {
                // Store profile information
                currentUserProfile = data;
                userRole = data.role || 'user';
                
                // Setup UI based on role
                setupUIForUserRole(userRole);
                
                console.log("Dashboard JS: Profile loaded, user role:", userRole);
            } else {
                console.log("Dashboard JS: No profile found, creating one");
                await createDefaultProfile();
            }
        } catch (error) {
            // Catch-all for any database errors
            console.error("Dashboard JS: Error accessing profiles table:", error);
            console.log("Dashboard JS: Using default role settings");
            
            // Use default values
            userRole = 'user';
            setupUIForUserRole(userRole);
        }
    } catch (error) {
        console.error("Dashboard JS: Profile handling error:", error);
        // Fallback to basic user role
        userRole = 'user';
        setupUIForUserRole(userRole);
    }
}

// Create default profile for user
async function createDefaultProfile() {
    try {
        // First check if profiles table exists
        try {
            const { error: insertError } = await window.supabase
                .from('profiles')
                .insert([{
                    id: currentUser.id,
                    email: currentUser.email,
                    role: 'user',
                    created_at: new Date().toISOString()
                }]);
                
            if (insertError) {
                // Check if error is about table not existing
                if (insertError.code === '42P01' || insertError.message.includes("relation") || insertError.message.includes("does not exist")) {
                    console.warn("Dashboard JS: Profiles table does not exist, cannot create profile");
                    // Use default values anyway
                    userRole = 'user';
                    setupUIForUserRole(userRole);
                    return;
                }
                
                console.error("Dashboard JS: Profile creation error:", insertError);
            } else {
                userRole = 'user';
                setupUIForUserRole(userRole);
                console.log("Dashboard JS: Default profile created");
            }
        } catch (error) {
            console.error("Dashboard JS: Error accessing profiles table:", error);
            // Use default values anyway
            userRole = 'user';
            setupUIForUserRole(userRole);
        }
    } catch (error) {
        console.error("Dashboard JS: Error creating profile:", error);
        // Fallback to basic user role
        userRole = 'user';
        setupUIForUserRole(userRole);
    }
}

// Load alerts
async function loadAlerts() {
    try {
        console.log("Dashboard JS: Loading alerts data");
        
        // Initialize alerts count
        let alertsCount = 0;
        
        // Get high usage devices (over 20 kWh in the last day)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { data: highUsageReadings, error: readingsError } = await window.supabase
            .from('readings')
            .select('device_id, kwh_value')
            .gte('timestamp', today.toISOString())
            .gt('kwh_value', 20);
            
        if (readingsError) {
            console.error("Error fetching high usage readings:", readingsError);
        } else if (highUsageReadings && highUsageReadings.length > 0) {
            // Count unique device IDs with high usage
            const highUsageDevices = new Set();
            highUsageReadings.forEach(reading => {
                highUsageDevices.add(reading.device_id);
            });
            alertsCount += highUsageDevices.size;
        }
        
        // Get offline devices (where status is offline)
        const { data: offlineDevices, error: devicesError } = await window.supabase
            .from('devices')
            .select('id, name')
            .eq('status', 'offline');
            
        if (devicesError) {
            console.error("Error fetching offline devices:", devicesError);
        } else if (offlineDevices && offlineDevices.length > 0) {
            alertsCount += offlineDevices.length;
            
            // Generate notifications for offline devices
            offlineDevices.forEach(device => {
                showNotification(`Device ${device.name || device.id} is offline`, "warning");
            });
        }
        
        // Store alerts count in global variable for use in updateStatsUI
        window.alertsCount = alertsCount;
        
        // Update the alerts badge in navbar
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.textContent = alertsCount;
            badge.style.display = alertsCount > 0 ? 'inline-block' : 'none';
        }
        
        // Update alerts dropdown in navbar
        const dropdown = document.getElementById('notificationDropdown');
        if (dropdown) {
            // Clear existing alerts except the footer
            const footer = dropdown.querySelector('.dropdown-footer');
            dropdown.innerHTML = '';
            
            // Add header with count
            const header = document.createElement('span');
            header.className = 'dropdown-header';
            header.textContent = `${alertsCount} Notifications`;
            dropdown.appendChild(header);
            
            if (alertsCount === 0) {
                const noAlerts = document.createElement('a');
                noAlerts.href = '#';
                noAlerts.className = 'dropdown-item';
                noAlerts.innerHTML = '<i class="fas fa-check-circle mr-2 text-success"></i> No active alerts';
                dropdown.appendChild(noAlerts);
            } else {
                // Add high usage alerts
                if (highUsageReadings && highUsageReadings.length > 0) {
                    const uniqueDevices = new Set();
                    highUsageReadings.forEach(reading => uniqueDevices.add(reading.device_id));
                    
                    uniqueDevices.forEach(deviceId => {
                        const deviceName = getDeviceName(deviceId);
                        const alert = document.createElement('a');
                        alert.href = '#';
                        alert.className = 'dropdown-item';
                        alert.innerHTML = `
                            <i class="fas fa-exclamation-triangle mr-2 text-warning"></i> High usage detected for ${deviceName}
                            <span class="float-right text-muted text-sm">Today</span>
                        `;
                        dropdown.appendChild(alert);
                        dropdown.appendChild(document.createElement('div')).className = 'dropdown-divider';
                    });
                }
                
                // Add offline device alerts
                if (offlineDevices && offlineDevices.length > 0) {
                    offlineDevices.forEach(device => {
                        const alert = document.createElement('a');
                        alert.href = '#';
                        alert.className = 'dropdown-item';
                        alert.innerHTML = `
                            <i class="fas fa-exclamation-circle mr-2 text-danger"></i> ${device.name || device.id} is offline
                            <span class="float-right text-muted text-sm">Now</span>
                        `;
                        dropdown.appendChild(alert);
                        dropdown.appendChild(document.createElement('div')).className = 'dropdown-divider';
                    });
                }
            }
            
            // Add footer back
            if (footer) {
                dropdown.appendChild(footer);
            } else {
                const newFooter = document.createElement('a');
                newFooter.href = '#';
                newFooter.className = 'dropdown-item dropdown-footer';
                newFooter.textContent = 'See All Notifications';
                dropdown.appendChild(newFooter);
            }
        }
        
        // Also update the stats UI to show the alerts count
        document.getElementById('statAlerts').textContent = alertsCount;
        
    } catch (error) {
        console.error("Error loading alerts:", error);
    }
}

// Helper function to get device name from device ID
function getDeviceName(deviceId) {
    if (window.cachedDevices) {
        const device = window.cachedDevices.find(d => d.device_id === deviceId);
        if (device) {
            return device.name || 'Unknown Device';
        }
    }
    return `Device ${deviceId}`;
}

// Add this CSS to the head of the document to style our notifications properly
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.textContent = `
        /* Custom notification styles */
        .custom-alert {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 280px;
            max-width: 350px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border-radius: 4px;
            overflow: hidden;
            transition: all 0.3s ease;
            opacity: 0;
            transform: translateY(-10px);
        }
        
        .custom-alert.show {
            opacity: 1;
            transform: translateY(0);
        }
        
        /* Highlight card effect */
        .highlight-card {
            animation: highlight 1.5s ease-in-out;
        }
        
        @keyframes highlight {
            0% { box-shadow: 0 0 0 rgba(0, 123, 255, 0); }
            50% { box-shadow: 0 0 10px 3px rgba(0, 123, 255, 0.7); }
            100% { box-shadow: 0 0 0 rgba(0, 123, 255, 0); }
        }
        
        /* Make sure our modals have proper z-index */
        .modal {
            z-index: 9999;
        }
        
        /* Fix for Bootstrap 5 modals */
        .modal-backdrop {
            z-index: 9998;
        }
    `;
    document.head.appendChild(style);
});

// Global error handler 
window.addEventListener('error', function(event) {
    console.error('Global error handler caught:', event.error);
    showNotification('Terjadi kesalahan: ' + (event.error?.message || 'Error tidak diketahui'), 'danger');
    return false; // Allow default error handling to continue
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showNotification('Promise tidak tertangani: ' + (event.reason?.message || 'Error tidak diketahui'), 'danger');
    return false; // Allow default error handling to continue
});

// Load Readings Data with Pagination
async function loadReadingsData(page = 1) {
    if (readingsIsLoading) return;
    readingsIsLoading = true;
    console.log(`Dashboard JS: Loading readings data page ${page}`);
    const readingsTableBody = document.getElementById('readingsTableBody');
    const paginationContainer = document.getElementById('readingsPagination');

    if (!readingsTableBody || !paginationContainer) {
        console.error("Readings table body or pagination container not found");
        readingsIsLoading = false;
        return;
    }

    // Tampilkan loading indicator di tabel
    readingsTableBody.innerHTML = `<tr><td colspan="5" class="text-center">Loading data...</td></tr>`;
    paginationContainer.innerHTML = ''; // Kosongkan pagination saat loading

    try {
        if (!window.supabase) {
            console.error("Supabase client is not available.");
            showNotification("Error connecting to the database.", "danger");
            readingsIsLoading = false;
            return;
        }

        const startIndex = (page - 1) * readingsPageSize;
        const endIndex = startIndex + readingsPageSize - 1;

        // Query data untuk halaman ini DAN total count
        const { data, error, count } = await window.supabase
            .from('readings')
            .select(`
                timestamp,
                device_id,
                voltage,
                current,
                power,
                energy,
                frequency,
                power_factor,
                devices ( name )
            `, { count: 'exact' }) // Minta total count
            .order('timestamp', { ascending: false })
            .range(startIndex, endIndex);

        if (error) {
            console.error("Error fetching readings:", error);
            showNotification(`Error fetching readings: ${error.message}`, "danger");
            readingsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Failed to load data.</td></tr>`;
            readingsIsLoading = false;
            return;
        }

        console.log("Dashboard JS: Readings data fetched:", data);
        console.log("Dashboard JS: Total readings count:", count);

        readingsTotalCount = count || 0; // Simpan total count
        readingsCurrentPage = page; // Update halaman saat ini

        // Dapatkan map device info jika belum ada (meskipun idealnya sudah dari loadDevices)
        let deviceInfo = {};
        const devicesData = await window.supabase.from('devices').select('id, name');
        if (!devicesData.error && devicesData.data) {
           deviceInfo = createDeviceInfoMap(devicesData.data);
        }

        displayReadingsTable(data || [], deviceInfo);
        setupReadingsPagination(); // Setup pagination setelah data & count didapat

    } catch (err) {
        console.error("Error in loadReadingsData:", err);
        showNotification("An unexpected error occurred while loading readings.", "danger");
        readingsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">An error occurred.</td></tr>`;
    } finally {
        readingsIsLoading = false;
    }
}

// Display Readings Table
function displayReadingsTable(readings, deviceInfo) {
    const readingsTableBody = document.getElementById('readingsTableBody');
    if (!readingsTableBody) return;

    readingsTableBody.innerHTML = ''; // Kosongkan tabel

    if (!readings || readings.length === 0) {
        readingsTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No reading data available.</td></tr>';
        return;
    }

    readings.forEach(reading => {
        const row = document.createElement('tr');
        const deviceName = reading.devices?.name || deviceInfo[reading.device_id]?.name || reading.device_id.substring(0, 8) + '...' || 'Unknown Device'; // Gunakan nama dari join, fallback ke map, lalu ID pendek
        let timestampStr = 'Invalid Date';
        try {
            // Pastikan timestamp valid sebelum diformat
            if (reading.timestamp && typeof reading.timestamp === 'string') {
                 const date = new Date(reading.timestamp);
                 if (!isNaN(date)) { // Check if date is valid
                    timestampStr = date.toLocaleString();
                 } else {
                    console.warn("Invalid timestamp format received:", reading.timestamp);
                 }
            } else if (reading.timestamp instanceof Date && !isNaN(reading.timestamp)) {
                 timestampStr = reading.timestamp.toLocaleString();
            }
             else {
                 console.warn("Timestamp is null or not a string/date:", reading.timestamp);
            }
        } catch(e) {
             console.error("Error formatting date:", e, "Timestamp:", reading.timestamp);
        }

        row.innerHTML = `
            <td>${timestampStr}</td>
            <td>${deviceName}</td>
            <td>${reading.voltage !== null ? reading.voltage.toFixed(2) : 'N/A'} V</td>
            <td>${reading.current !== null ? reading.current.toFixed(3) : 'N/A'} A</td>
            <td>${reading.energy !== null ? reading.energy.toFixed(4) : 'N/A'} kWh</td>
        `;
        readingsTableBody.appendChild(row);
    });
}

// Setup Readings Pagination Controls
function setupReadingsPagination() {
    const paginationContainer = document.getElementById('readingsPagination');
    if (!paginationContainer) return;

    paginationContainer.innerHTML = ''; // Clear previous controls

    const totalPages = Math.ceil(readingsTotalCount / readingsPageSize);

    if (totalPages <= 1) {
        // Tidak perlu pagination jika hanya 1 halaman atau kurang
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'pagination justify-content-center'; // Center pagination

    // Tombol Previous
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${readingsCurrentPage === 1 ? 'disabled' : ''}`;
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.href = '#';
    prevLink.textContent = 'Previous';
    prevLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (readingsCurrentPage > 1) {
            loadReadingsData(readingsCurrentPage - 1);
        }
    });
    prevLi.appendChild(prevLink);
    ul.appendChild(prevLi);

    // Informasi Halaman (contoh: Page 2 of 10)
    const pageInfoLi = document.createElement('li');
    pageInfoLi.className = 'page-item disabled'; // Disabled, hanya untuk info
    const pageInfoSpan = document.createElement('span');
    pageInfoSpan.className = 'page-link';
    pageInfoSpan.textContent = `Page ${readingsCurrentPage} of ${totalPages}`;
    pageInfoLi.appendChild(pageInfoSpan);
    ul.appendChild(pageInfoLi);

    // Tombol Next
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${readingsCurrentPage === totalPages ? 'disabled' : ''}`;
    const nextLink = document.createElement('a');
    nextLink.className = 'page-link';
    nextLink.href = '#';
    nextLink.textContent = 'Next';
    nextLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (readingsCurrentPage < totalPages) {
            loadReadingsData(readingsCurrentPage + 1);
        }
    });
    nextLi.appendChild(nextLink);
    ul.appendChild(nextLi);

    paginationContainer.appendChild(ul);
} 