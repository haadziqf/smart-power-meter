// Import Supabase client library
const { createClient } = require('@supabase/supabase-js');

// Ambil kredensial Supabase dari environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// --- Inisialisasi Supabase Client ---
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Vercel Serverless Function Handler ---
module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Handle GET request (Health Check)
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      message: 'IoT API Endpoint is running. Use POST to send data like { "device_id": "YOUR_TEXT_ID", "kwh_value": 1.23 }'
    });
  }

  // Handle POST request
  if (req.method === 'POST') {
    try {
      // 1. Dapatkan data dari Wemos (ID teks)
      const { device_id, kwh_value } = req.body;
      console.log(`Received data: device_id=${device_id}, kwh_value=${kwh_value}`);

      // 2. Validasi Input Dasar
      if (!device_id || typeof kwh_value !== 'number') {
        console.log('Validation failed: Missing device_id or invalid kwh_value');
        return res.status(400).json({ error: 'device_id (text) and kwh_value (number) are required' });
      }

      // 3. Cari Device di Tabel 'devices' berdasarkan device_id (teks)
      console.log(`Looking up device with text ID: ${device_id}`);
      const { data: deviceData, error: deviceError } = await supabase
        .from('devices')
        .select('id')
        .eq('device_id', device_id)
        .single();

      if (deviceError) {
        if (deviceError.code === 'PGRST116') {
          console.warn(`Device not found for text ID: ${device_id}`);
          return res.status(404).json({ error: `Device with ID '${device_id}' not found` });
        }
        throw deviceError;
      }

      if (!deviceData?.id) {
        console.warn(`Device lookup returned no data for text ID: ${device_id}`);
        return res.status(404).json({ error: `Device data missing for ID '${device_id}'` });
      }

      // 4. Insert Data ke Tabel 'readings'
      const deviceUuid = deviceData.id;
      console.log(`Device found. Internal UUID: ${deviceUuid}`);
      
      const readingTimestamp = new Date().toISOString();
      const { error: readingError } = await supabase
        .from('readings')
        .insert({
          device_id: deviceUuid,
          kwh_value: kwh_value,
          timestamp: readingTimestamp
        });

      if (readingError) {
        throw readingError;
      }

      // 5. Update 'last_reading' di Tabel 'devices'
      const { error: updateError } = await supabase
        .from('devices')
        .update({ last_reading: readingTimestamp })
        .eq('id', deviceUuid);

      if (updateError) {
        console.warn(`Failed to update last_reading: ${updateError.message}`);
      }

      return res.status(201).json({ 
        success: true, 
        message: 'Reading stored successfully',
        timestamp: readingTimestamp
      });

    } catch (error) {
      console.error('Error processing IoT data:', error);
      return res.status(500).json({ 
        error: 'Internal server error processing data', 
        details: error.message 
      });
    }
  }

  // Handle unsupported methods
  return res.status(405).json({ error: 'Method not allowed' });
}; 