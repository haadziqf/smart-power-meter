// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

async function checkData() {
    try {
        console.log("Checking existing data...");

        // Check devices
        const { data: devices, error: devicesError } = await supabase
            .from('devices')
            .select('*');

        if (devicesError) {
            console.error("Error fetching devices:", devicesError);
            return;
        }

        console.log("\nDevices:", devices);

        // Check readings for each device
        for (const device of devices) {
            const { data: readings, error: readingsError } = await supabase
                .from('readings')
                .select('*')
                .eq('device_id', device.device_id)
                .order('timestamp', { ascending: false })
                .limit(24);

            if (readingsError) {
                console.error(`Error fetching readings for device ${device.device_id}:`, readingsError);
                continue;
            }

            console.log(`\nReadings for device ${device.device_id}:`, readings);
        }

    } catch (error) {
        console.error("Error checking data:", error);
    }
}

// Run the check
checkData(); 