import { SupabaseWriter } from './supabase-writer';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(__dirname, '..', '.env');
const content = readFileSync(envPath, 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';
for (const line of content.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('SUPABASE_URL=')) {
    supabaseUrl = trimmed.split('=')[1].replace(/['"]/g, '').trim();
  }
  if (trimmed.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    supabaseKey = trimmed.split('=')[1].replace(/['"]/g, '').trim();
  }
}

const writer = new SupabaseWriter(supabaseUrl, supabaseKey);

async function check() {
  const client = writer.getClient();
  const { data: status } = await client.from('device_status').select('*').eq('device_id', 'esp32-meter-001').single();
  const { data: alerts } = await client.from('alerts').select('*').order('timestamp', { ascending: false }).limit(5);
  const { data: readings } = await client.from('energy_readings').select('*').order('timestamp', { ascending: false }).limit(3);
  const { data: settings } = await client.from('meter_settings').select('*').eq('device_id', 'esp32-meter-001').single();
  
  console.log('METER SETTINGS:', settings);
  console.log('DEVICE STATUS:', status);
  console.log('LATEST READING:', readings?.[0]);
  console.log('LATEST ALERT:', alerts?.[0]);
}

check();
