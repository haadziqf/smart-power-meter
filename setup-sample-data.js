// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

async function setupSampleData() {
    try {
        console.log("Setting up sample data...");

        // 1. Add sample device
        const sampleDevice = {
            device_id: 'DEV001',
            name: 'Smart Power Meter',
            location: 'Living Room',
            status: 'online',
            last_reading: 0,
            calibration_factor: 1000
        };

        // Insert device
        const { data: device, error: deviceError } = await supabase
            .from('devices')
            .insert(sampleDevice)
            .select();

        if (deviceError) {
            console.error("Error inserting device:", deviceError);
            return;
        }

        console.log("Sample device added successfully");

        // 2. Add sample readings
        const now = new Date();
        const readings = [];

        // Generate readings for the last 24 hours
        for (let i = 0; i < 24; i++) {
            const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000));
            
            // Generate random kWh value between 0.1 and 5.0
            const kwhValue = (Math.random() * 4.9 + 0.1).toFixed(2);
            
            readings.push({
                device_id: sampleDevice.device_id,
                kwh_value: parseFloat(kwhValue),
                timestamp: timestamp.toISOString()
            });
        }

        // Insert readings
        const { data: readingsData, error: readingsError } = await supabase
            .from('readings')
            .insert(readings)
            .select();

        if (readingsError) {
            console.error("Error inserting readings:", readingsError);
            return;
        }

        console.log("Sample readings added successfully");
        console.log("Setup completed!");

    } catch (error) {
        console.error("Error setting up sample data:", error);
    }
}

// Run the setup
setupSampleData(); 