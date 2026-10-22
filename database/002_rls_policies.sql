-- ==========================================
-- 002_rls_policies.sql
-- Enable Row Level Security (RLS) and define access rules
-- ==========================================


-- Enable Row Level Security on all tables
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.energy_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meter_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PHASE 1: DEVELOPMENT POLICIES (OPEN ACCESS WITH ANON KEY)
-- Allows the ESP32 simulator and dashboard to interact without login.
-- ==========================================

-- 1. public.devices
CREATE POLICY "Dev - Allow anyone to read devices"
ON public.devices FOR SELECT USING (true);

CREATE POLICY "Dev - Allow anyone to insert devices"
ON public.devices FOR INSERT WITH CHECK (true);

-- 2. public.energy_readings
CREATE POLICY "Dev - Allow anyone to read energy readings"
ON public.energy_readings FOR SELECT USING (true);

CREATE POLICY "Dev - Allow anyone to insert energy readings"
ON public.energy_readings FOR INSERT WITH CHECK (true);

-- 3. public.meter_settings
CREATE POLICY "Dev - Allow anyone to read settings"
ON public.meter_settings FOR SELECT USING (true);

CREATE POLICY "Dev - Allow anyone to update settings"
ON public.meter_settings FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Dev - Allow anyone to insert settings"
ON public.meter_settings FOR INSERT WITH CHECK (true);

-- 4. public.device_status
CREATE POLICY "Dev - Allow anyone to read device status"
ON public.device_status FOR SELECT USING (true);

CREATE POLICY "Dev - Allow anyone to insert device status"
ON public.device_status FOR INSERT WITH CHECK (true);

CREATE POLICY "Dev - Allow anyone to update device status"
ON public.device_status FOR UPDATE USING (true) WITH CHECK (true);

-- 5. public.alerts
CREATE POLICY "Dev - Allow anyone to read alerts"
ON public.alerts FOR SELECT USING (true);

CREATE POLICY "Dev - Allow anyone to insert alerts"
ON public.alerts FOR INSERT WITH CHECK (true);

CREATE POLICY "Dev - Allow anyone to update alerts"
ON public.alerts FOR UPDATE USING (true) WITH CHECK (true);

-- 6. public.user_devices
CREATE POLICY "Dev - Allow anyone to read user devices mapping"
ON public.user_devices FOR SELECT USING (true);


-- ==========================================
-- PHASE 2: PRODUCTION POLICIES (AUTHENTICATED & RESTRICTED ACCESS)
-- [COMMENTED OUT FOR DEVELOPMENT]
-- To enable production mode, drop the "Dev - " policies above and
-- uncomment/run the policies below.
-- ==========================================

/*
-- 1. public.devices
CREATE POLICY "Prod - Users can view devices they own or view"
ON public.devices FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_devices ud
        WHERE ud.device_id = devices.device_id AND ud.user_id = auth.uid()
    )
);

-- 2. public.energy_readings
CREATE POLICY "Prod - Users can view readings of their devices"
ON public.energy_readings FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_devices ud
        WHERE ud.device_id = energy_readings.device_id AND ud.user_id = auth.uid()
    )
);

-- Device can insert readings using the anon key with a policy that allows writes 
-- for known devices (or if using service role / custom authenticated ESP32 profiles)
CREATE POLICY "Prod - Allow anonymous device insertion of readings"
ON public.energy_readings FOR INSERT
TO anon, authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.devices d
        WHERE d.device_id = energy_readings.device_id
    )
);

-- 3. public.meter_settings
CREATE POLICY "Prod - Users can view settings of their devices"
ON public.meter_settings FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_devices ud
        WHERE ud.device_id = meter_settings.device_id AND ud.user_id = auth.uid()
    )
);

CREATE POLICY "Prod - Only owners can update device settings"
ON public.meter_settings FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_devices ud
        WHERE ud.device_id = meter_settings.device_id 
        AND ud.user_id = auth.uid() 
        AND ud.role = 'owner'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_devices ud
        WHERE ud.device_id = meter_settings.device_id 
        AND ud.user_id = auth.uid() 
        AND ud.role = 'owner'
    )
);

-- 4. public.device_status
CREATE POLICY "Prod - Users can view status of their devices"
ON public.device_status FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_devices ud
        WHERE ud.device_id = device_status.device_id AND ud.user_id = auth.uid()
    )
);

CREATE POLICY "Prod - Allow device status upsert"
ON public.device_status FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 5. public.alerts
CREATE POLICY "Prod - Users can view alerts for their devices"
ON public.alerts FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_devices ud
        WHERE ud.device_id = alerts.device_id AND ud.user_id = auth.uid()
    )
);

CREATE POLICY "Prod - Users can acknowledge alerts"
ON public.alerts FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_devices ud
        WHERE ud.device_id = alerts.device_id AND ud.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_devices ud
        WHERE ud.device_id = alerts.device_id AND ud.user_id = auth.uid()
    )
);

CREATE POLICY "Prod - Allow devices to post alerts"
ON public.alerts FOR INSERT
TO anon, authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.devices d
        WHERE d.device_id = alerts.device_id
    )
);

-- 6. public.user_devices
CREATE POLICY "Prod - Users can view their own device mappings"
ON public.user_devices FOR SELECT
TO authenticated
USING (user_id = auth.uid());
*/
