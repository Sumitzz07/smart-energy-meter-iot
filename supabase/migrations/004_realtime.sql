-- ==========================================
-- 004_realtime.sql
-- Configure Supabase Realtime replication for key tables
-- ==========================================

-- Check if supabase_realtime publication exists, create if missing,
-- then safely add our tables without raising duplicate table errors.
DO $$
BEGIN
    -- Ensure the publication exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- 1. Add public.energy_readings if not already in publication
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_rel pr
        JOIN pg_class c ON pr.prrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
          AND n.nspname = 'public'
          AND c.relname = 'energy_readings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.energy_readings;
    END IF;

    -- 2. Add public.device_status if not already in publication
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_rel pr
        JOIN pg_class c ON pr.prrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
          AND n.nspname = 'public'
          AND c.relname = 'device_status'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.device_status;
    END IF;

    -- 3. Add public.alerts if not already in publication
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_rel pr
        JOIN pg_class c ON pr.prrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
          AND n.nspname = 'public'
          AND c.relname = 'alerts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
    END IF;

    -- 4. Add public.meter_settings if not already in publication
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_rel pr
        JOIN pg_class c ON pr.prrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
          AND n.nspname = 'public'
          AND c.relname = 'meter_settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.meter_settings;
    END IF;

END
$$;
