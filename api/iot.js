const express = require('express');
// Import Supabase client library
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // Untuk local development

const app = express();
app.use(express.json());

// Ambil kredensial Supabase dari environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// --- Validasi Kredensial ---
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.');
} else {
   console.log('Supabase URL:', SUPABASE_URL);
   console.log('Supabase Service Key Loaded:', SUPABASE_SERVICE_KEY ? 'Yes' : 'NO!');
}

// --- Inisialisasi Supabase Client ---
// Gunakan Service Role Key karena API ini adalah backend terpercaya
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- Endpoint POST /iot ---
app.post('/iot', async (req, res) => {
  // 1. Dapatkan data dari Wemos (ID teks)
  const { device_id, kwh_value } = req.body;
  console.log(`Received data: device_id=${device_id}, kwh_value=${kwh_value}`);

  // 2. Validasi Input Dasar
  if (!device_id || typeof kwh_value !== 'number') {
    console.log('Validation failed: Missing device_id or invalid kwh_value');
    return res.status(400).json({ error: 'device_id (text) and kwh_value (number) are required' });
  }

  if (!supabase) {
      console.error('Supabase client not initialized!');
      return res.status(500).json({ error: 'Internal server error: Supabase client not available' });
  }

  try {
    // 3. **[PERBAIKAN UTAMA]** Cari Device di Tabel 'devices' berdasarkan device_id (teks)
    console.log(`Looking up device with text ID: ${device_id}`);
    const { data: deviceData, error: deviceError } = await supabase
      .from('devices')
      .select('id') // Hanya perlu UUID internalnya (kolom 'id')
      .eq('device_id', device_id) // Cari berdasarkan kolom 'device_id' (teks) yang dikirim Wemos
      .single(); // Harapkan hanya satu device

    // Handle jika device tidak ditemukan atau ada error saat lookup
    if (deviceError) {
      if (deviceError.code === 'PGRST116') { // Kode PostgREST untuk 'Row not found'
        console.warn(`Device not found for text ID: ${device_id}`);
        return res.status(404).json({ error: `Device with ID '${device_id}' not found` });
      } else {
        console.error('Error looking up device:', deviceError);
        throw deviceError;
      }
    }

    if (!deviceData || !deviceData.id) {
         console.warn(`Device lookup returned no data for text ID: ${device_id}`);
         return res.status(404).json({ error: `Device data missing for ID '${device_id}'` });
    }

    // Dapatkan UUID internal device dari kolom 'id'
    const deviceUuid = deviceData.id;
    console.log(`Device found. Internal UUID: ${deviceUuid}`);

    // 4. **[PERBAIKAN UTAMA]** Insert Data ke Tabel 'readings' menggunakan UUID Internal
    console.log(`Inserting reading for device UUID: ${deviceUuid}`);
    const readingTimestamp = new Date().toISOString();
    const { error: readingError } = await supabase
      .from('readings')
      .insert({
        device_id: deviceUuid, // **Gunakan UUID internal di sini!**
        kwh_value: kwh_value,
        timestamp: readingTimestamp
      });

    if (readingError) {
      console.error('Error inserting reading:', readingError);
      throw readingError;
    }

    console.log(`Reading inserted successfully for device UUID: ${deviceUuid}`);

    // 5. (Opsional) Update 'last_reading' di Tabel 'devices'
    console.log(`Attempting to update last_reading for device UUID: ${deviceUuid}`);
    const { error: updateError } = await supabase
        .from('devices')
        .update({ last_reading: readingTimestamp })
        .eq('id', deviceUuid); // Update berdasarkan UUID internal ('id')

    if (updateError) {
        console.warn(`Failed to update last_reading for device UUID ${deviceUuid}:`, updateError.message);
    } else {
        console.log(`Successfully updated last_reading for device UUID: ${deviceUuid}`);
    }

    // 6. Kirim Respon Sukses
    return res.status(201).json({ success: true, message: 'Reading stored successfully' });

  } catch (error) {
    console.error('Error processing IoT data:', error);
    return res.status(500).json({ error: 'Internal server error processing data', details: error.message });
  }
});

// --- Endpoint GET /iot (Health Check/Info) ---
app.get('/iot', (req, res) => {
  res.send('IoT API Endpoint is running. Use POST to send data like { "device_id": "YOUR_TEXT_ID", "kwh_value": 1.23 }');
});

// --- Menjalankan Server untuk Local Development ---
if (require.main === module) {
  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => console.log(`IoT API server running locally on http://localhost:${PORT}`));
}

// --- Export app untuk Vercel Serverless Function ---
module.exports = app; 