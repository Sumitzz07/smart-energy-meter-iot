-- ==========================================
-- 003_functions.sql
-- Database functions, triggers, and aggregated views
-- ==========================================

-- 1. TRIGGER FUNCTION: Update updated_at Timestamp
-- Keeps the updated_at column correct when settings change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_set_meter_settings_updated_at
    BEFORE UPDATE ON public.meter_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();


-- 2. TRIGGER FUNCTION: Calculate Reading Cost on Insert
-- Computes the financial cost automatically before storing the reading.
-- Looks up the device's tariff rate from public.meter_settings.
CREATE OR REPLACE FUNCTION public.calculate_reading_cost()
RETURNS TRIGGER AS $$
DECLARE
    v_cost_per_kwh REAL;
BEGIN
    -- Fetch tariff rate for the device from meter_settings.
    -- Default to 6.0 if no settings found.
    SELECT COALESCE(cost_per_kwh, 6.0)
    INTO v_cost_per_kwh
    FROM public.meter_settings
    WHERE device_id = NEW.device_id;
    
    IF v_cost_per_kwh IS NULL THEN
        v_cost_per_kwh := 6.0;
    END IF;

    -- Calculate cost: Energy (kWh) * Cost per kWh
    -- If cost is not explicitly provided or is zero, we populate it
    IF NEW.cost IS NULL OR NEW.cost = 0 THEN
        NEW.cost := NEW.energy_kwh * v_cost_per_kwh;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_calculate_reading_cost
    BEFORE INSERT ON public.energy_readings
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_reading_cost();


-- 3. VIEW: Daily Energy & Cost Summary
-- Aggregates raw readings into daily summaries.
-- Energy consumption is computed as the difference between the max and min cumulative energy reading for each day.
CREATE OR REPLACE VIEW public.daily_energy_summary AS
SELECT 
    device_id,
    DATE_TRUNC('day', timestamp) AS summary_date,
    ROUND(AVG(voltage)::numeric, 2) AS avg_voltage,
    ROUND(MAX(voltage)::numeric, 2) AS max_voltage,
    ROUND(MIN(voltage)::numeric, 2) AS min_voltage,
    ROUND(MAX(current_amps)::numeric, 3) AS max_current,
    ROUND(AVG(power)::numeric, 2) AS avg_power_watts,
    ROUND((MAX(energy_kwh) - MIN(energy_kwh))::numeric, 4) AS energy_consumed_kwh,
    ROUND((MAX(cost) - MIN(cost))::numeric, 2) AS daily_cost,
    COUNT(id) AS reading_count
FROM 
    public.energy_readings
GROUP BY 
    device_id, 
    DATE_TRUNC('day', timestamp);


-- 4. VIEW: Monthly Energy & Cost Summary
-- Aggregates raw readings into monthly summaries.
CREATE OR REPLACE VIEW public.monthly_energy_summary AS
SELECT 
    device_id,
    DATE_TRUNC('month', timestamp) AS summary_month,
    ROUND(AVG(voltage)::numeric, 2) AS avg_voltage,
    ROUND(MAX(voltage)::numeric, 2) AS max_voltage,
    ROUND(MIN(voltage)::numeric, 2) AS min_voltage,
    ROUND(MAX(current_amps)::numeric, 3) AS max_current,
    ROUND(AVG(power)::numeric, 2) AS avg_power_watts,
    ROUND((MAX(energy_kwh) - MIN(energy_kwh))::numeric, 4) AS energy_consumed_kwh,
    ROUND((MAX(cost) - MIN(cost))::numeric, 2) AS monthly_cost,
    COUNT(id) AS reading_count
FROM 
    public.energy_readings
GROUP BY 
    device_id, 
    DATE_TRUNC('month', timestamp);


-- 5. FUNCTION: Retrieve Realtime Stats for Dashboard
-- Fast lookup of current values and daily aggregates in one query.
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_device_id TEXT)
RETURNS TABLE (
    device_id TEXT,
    voltage REAL,
    current_amps REAL,
    power REAL,
    energy_kwh REAL,
    frequency REAL,
    power_factor REAL,
    cost REAL,
    protection_status TEXT,
    today_energy_kwh NUMERIC,
    today_cost NUMERIC,
    last_seen TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    WITH latest_reading AS (
        SELECT 
            er.device_id,
            er.voltage,
            er.current_amps,
            er.power,
            er.energy_kwh,
            er.frequency,
            er.power_factor,
            er.cost,
            er.protection_status
        FROM public.energy_readings er
        WHERE er.device_id = p_device_id
        ORDER BY er.timestamp DESC
        LIMIT 1
    ),
    today_summary AS (
        SELECT 
            COALESCE(SUM(energy_consumed_kwh), 0) as today_energy,
            COALESCE(SUM(daily_cost), 0) as today_c
        FROM public.daily_energy_summary des
        WHERE des.device_id = p_device_id 
          AND des.summary_date = DATE_TRUNC('day', NOW())
    ),
    status AS (
        SELECT ds.last_seen
        FROM public.device_status ds
        WHERE ds.device_id = p_device_id
    )
    SELECT 
        lr.device_id,
        lr.voltage,
        lr.current_amps,
        lr.power,
        lr.energy_kwh,
        lr.frequency,
        lr.power_factor,
        lr.cost,
        lr.protection_status,
        ts.today_energy,
        ts.today_c,
        st.last_seen
    FROM latest_reading lr
    CROSS JOIN today_summary ts
    LEFT JOIN status st ON st.device_id = lr.device_id;
END;
$$ LANGUAGE plpgsql;
