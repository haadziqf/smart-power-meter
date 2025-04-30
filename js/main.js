// Supabase Configuration
const supabaseUrl = 'https://juciywnevycylsnqnbmq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Y2l5d25ldnljeWxzbnFuYm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0NTY3NjAsImV4cCI6MjA2MTAzMjc2MH0.jam9COWAITe4d1bYSuIyIp7ii-3R8_SlKoTIO5lwwjQ';

// Initialize Supabase client
const supabase = supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

// Check if user is logged in
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        showDashboard();
    } else {
        showLoginForm();
    }
}

// Show login form
function showLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const dashboard = document.getElementById('dashboard');
    
    if (loginForm) {
        loginForm.classList.add('active');
        loginForm.style.display = 'block';
    }
    if (registerForm) {
        registerForm.classList.remove('active');
        registerForm.style.display = 'none';
    }
    if (dashboard) {
        dashboard.style.display = 'none';
    }
}

// Show register form
function showRegisterForm() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const dashboard = document.getElementById('dashboard');
    
    if (loginForm) {
        loginForm.classList.remove('active');
        loginForm.style.display = 'none';
    }
    if (registerForm) {
        registerForm.classList.add('active');
        registerForm.style.display = 'block';
    }
    if (dashboard) {
        dashboard.style.display = 'none';
    }
}

// Show dashboard
function showDashboard() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const dashboard = document.getElementById('dashboard');
    
    if (loginForm) {
        loginForm.classList.remove('active');
        loginForm.style.display = 'none';
    }
    if (registerForm) {
        registerForm.classList.remove('active');
        registerForm.style.display = 'none';
    }
    if (dashboard) {
        dashboard.style.display = 'block';
    }
    
    loadDevices();
    loadStatistics();
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Set initial form display
    showLoginForm();
    
    // Check auth status
    checkAuth();
    
    // Setup event listeners
    setupEventListeners();
});

// Setup all event listeners
function setupEventListeners() {
    // Login/Register button handlers
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginForm();
        });
    }
    
    if (registerBtn) {
        registerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showRegisterForm();
        });
    }
    
    // Add device button handler
    const addDeviceBtn = document.getElementById('addDeviceBtn');
    if (addDeviceBtn) {
        addDeviceBtn.addEventListener('click', () => {
            // Will be implemented in device.js
        });
    }
}

// Error handling
function showError(message) {
    alert(message);
}

// Initialize the application
checkAuth(); 