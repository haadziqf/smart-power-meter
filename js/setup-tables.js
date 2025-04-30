/**
 * Script setup-tables.js
 * Digunakan untuk membuat tabel-tabel yang diperlukan di Supabase
 * Jalankan script ini satu kali untuk setup database
 * 
 * CARA PENGGUNAAN:
 * 1. Buka konsol browser di halaman login/index
 * 2. Copy paste isi script ini ke konsol
 * 3. Ikuti instruksi yang muncul
 */

async function setupSupabaseTables() {
    // Pastikan Supabase client tersedia (dari login.html atau index.html)
    const supabaseClient = window.supabase || window.supabaseClient;

    if (!supabaseClient) {
        console.error("Supabase client not found. Run this script on login.html or index.html page.");
        return false;
    }

    console.log("Starting Supabase table setup...");

    try {
        // 1. Buat tabel profiles jika belum ada
        console.log("Setting up profiles table...");
        
        const { error: createProfilesError } = await supabaseClient.rpc('create_table_if_not_exists', {
            table_name: 'profiles',
            create_statement: `
                CREATE TABLE IF NOT EXISTS profiles (
                    id UUID PRIMARY KEY REFERENCES auth.users(id),
                    email TEXT,
                    full_name TEXT,
                    role TEXT DEFAULT 'user',
                    tenant_id TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE
                );
            `
        });

        if (createProfilesError) {
            // Gunakan metode alternatif jika tidak bisa pakai RPC
            console.log("Using alternative method to create profiles table...");
            
            // Cek apakah tabel profiles sudah ada
            const { data: profilesExist, error: checkProfileError } = await supabaseClient
                .from('profiles')
                .select('id')
                .limit(1);
                
            if (checkProfileError && checkProfileError.code === '42P01') {
                console.log("Profiles table doesn't exist, creating manually...");
                alert("Pastikan sudah membuat tabel 'profiles' di Supabase dengan kolom: id (UUID, PRIMARY KEY), email (TEXT), full_name (TEXT), role (TEXT), tenant_id (TEXT), created_at (TIMESTAMP), updated_at (TIMESTAMP)");
            } else {
                console.log("Profiles table already exists or check failed:", checkProfileError);
            }
        } else {
            console.log("Profiles table created successfully!");
        }

        // 2. Buat tabel devices jika belum ada
        console.log("Setting up devices table...");
        
        const { error: createDevicesError } = await supabaseClient.rpc('create_table_if_not_exists', {
            table_name: 'devices',
            create_statement: `
                CREATE TABLE IF NOT EXISTS devices (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    device_id TEXT UNIQUE NOT NULL,
                    name TEXT,
                    location TEXT,
                    tenant_id TEXT,
                    status TEXT DEFAULT 'offline',
                    last_reading DECIMAL DEFAULT 0,
                    calibration_factor INTEGER DEFAULT 1000,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    created_by UUID REFERENCES auth.users(id),
                    updated_at TIMESTAMP WITH TIME ZONE
                );
            `
        });

        if (createDevicesError) {
            console.log("Using alternative method to create devices table...");
            
            const { data: devicesExist, error: checkDevicesError } = await supabaseClient
                .from('devices')
                .select('id')
                .limit(1);
                
            if (checkDevicesError && checkDevicesError.code === '42P01') {
                console.log("Devices table doesn't exist, creating manually...");
                alert("Pastikan sudah membuat tabel 'devices' di Supabase dengan kolom: id (UUID, PRIMARY KEY), device_id (TEXT, UNIQUE), name (TEXT), location (TEXT), tenant_id (TEXT), status (TEXT), last_reading (DECIMAL), calibration_factor (INTEGER), created_at (TIMESTAMP), created_by (UUID), updated_at (TIMESTAMP)");
            } else {
                console.log("Devices table already exists or check failed:", checkDevicesError);
            }
        } else {
            console.log("Devices table created successfully!");
        }

        // 3. Buat tabel readings jika belum ada
        console.log("Setting up readings table...");
        
        const { error: createReadingsError } = await supabaseClient.rpc('create_table_if_not_exists', {
            table_name: 'readings',
            create_statement: `
                CREATE TABLE IF NOT EXISTS readings (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    device_id TEXT NOT NULL REFERENCES devices(device_id),
                    kwh_value DECIMAL NOT NULL,
                    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            `
        });

        if (createReadingsError) {
            console.log("Using alternative method to create readings table...");
            
            const { data: readingsExist, error: checkReadingsError } = await supabaseClient
                .from('readings')
                .select('id')
                .limit(1);
                
            if (checkReadingsError && checkReadingsError.code === '42P01') {
                console.log("Readings table doesn't exist, creating manually...");
                alert("Pastikan sudah membuat tabel 'readings' di Supabase dengan kolom: id (UUID, PRIMARY KEY), device_id (TEXT, REFERENCES devices(device_id)), kwh_value (DECIMAL), timestamp (TIMESTAMP)");
            } else {
                console.log("Readings table already exists or check failed:", checkReadingsError);
            }
        } else {
            console.log("Readings table created successfully!");
        }

        // Tambahkan data contoh jika tidak ada data
        await addSampleData(supabaseClient);

        console.log("Supabase table setup completed successfully!");
        alert("Setup selesai! Silakan refresh halaman untuk melihat perubahan.");
        
        return true;
    } catch (error) {
        console.error("Error setting up tables:", error);
        alert("Error setting up tables: " + error.message);
        return false;
    }
}

async function addSampleData(supabaseClient) {
    try {
        // Cek apakah sudah ada data di devices
        const { data: existingDevices, error: devicesError } = await supabaseClient
            .from('devices')
            .select('id')
            .limit(1);
            
        if (devicesError) {
            console.error("Error checking existing devices:", devicesError);
            return;
        }
        
        // Jika tidak ada data, tambahkan data contoh
        if (!existingDevices || existingDevices.length === 0) {
            console.log("No devices found, adding sample data...");
            
            // Ambil user saat ini jika sudah login
            const { data: userData } = await supabaseClient.auth.getUser();
            const userId = userData?.user?.id;
            
            // Buat device contoh
            const sampleDevices = [
                {
                    device_id: 'SAMPLE001',
                    name: 'Living Room Meter',
                    location: 'Living Room',
                    tenant_id: 'tenant1',
                    status: 'online',
                    last_reading: 25.5,
                    calibration_factor: 1000,
                    created_at: new Date().toISOString(),
                    created_by: userId
                },
                {
                    device_id: 'SAMPLE002',
                    name: 'Kitchen Meter',
                    location: 'Kitchen',
                    tenant_id: 'tenant1',
                    status: 'online',
                    last_reading: 15.2,
                    calibration_factor: 1000,
                    created_at: new Date().toISOString(),
                    created_by: userId
                },
                {
                    device_id: 'SAMPLE003',
                    name: 'Office Meter',
                    location: 'Office',
                    tenant_id: 'tenant2',
                    status: 'offline',
                    last_reading: 30.8,
                    calibration_factor: 1000,
                    created_at: new Date().toISOString(),
                    created_by: userId
                }
            ];
            
            // Insert sample devices
            const { error: insertDevicesError } = await supabaseClient
                .from('devices')
                .insert(sampleDevices);
                
            if (insertDevicesError) {
                console.error("Error inserting sample devices:", insertDevicesError);
                return;
            }
            
            console.log("Sample devices added successfully!");
            
            // Buat readings contoh untuk tiap device
            const now = new Date();
            const sampleReadings = [];
            
            // Buat data untuk 7 hari terakhir
            for (let device of sampleDevices) {
                for (let i = 0; i < 7; i++) {
                    const readingDate = new Date(now);
                    readingDate.setDate(now.getDate() - i);
                    
                    // 3 readings per hari
                    for (let j = 0; j < 3; j++) {
                        const hour = j * 8;
                        readingDate.setHours(hour, 0, 0, 0);
                        
                        sampleReadings.push({
                            device_id: device.device_id,
                            kwh_value: parseFloat((Math.random() * 2 + 0.5).toFixed(2)),
                            timestamp: readingDate.toISOString()
                        });
                    }
                }
            }
            
            // Batch insert readings (mengelompokkan 50 per batch)
            const chunkSize = 50;
            for (let i = 0; i < sampleReadings.length; i += chunkSize) {
                const chunk = sampleReadings.slice(i, i + chunkSize);
                const { error: insertReadingsError } = await supabaseClient
                    .from('readings')
                    .insert(chunk);
                    
                if (insertReadingsError) {
                    console.error("Error inserting sample readings (chunk " + i + "):", insertReadingsError);
                }
            }
            
            console.log("Sample readings added successfully!");
        } else {
            console.log("Sample data already exists, skipping...");
        }
    } catch (error) {
        console.error("Error adding sample data:", error);
    }
}

// Jalankan setup
console.log("To setup Supabase tables, run: setupSupabaseTables()"); 