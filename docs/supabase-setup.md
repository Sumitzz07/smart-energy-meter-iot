# Supabase Setup Guide

This guide walks you through setting up a Supabase project from scratch for the Smart Energy Meter. Follow these steps to configure your cloud database, security policies, realtime replication, and authentication.

---

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up with **GitHub** (recommended) or email.
2. Once logged in, click **New Project** in your dashboard.
3. Configure your project:
   - **Organization**: Choose your default organization.
   - **Project Name**: `smart-energy-meter`
   - **Database Password**: Set a strong password (e.g. `StrongEnergyMeterPassword2026!`). **Write it down**; you will need it if you connect to the database directly via external tools.
   - **Region**: Choose a region close to your physical location (e.g., `South Asia (Mumbai)` if you are in India).
   - **Pricing Plan**: Select the **Free Tier**.
4. Click **Create new project** and wait 1–3 minutes for the database to provision.

---

## 2. Obtain Project Credentials

Once the project is ready, navigate to the **Project Settings** (gear icon at the bottom of the left sidebar) and select **API**.

Locate the following values:

1. **Project URL**: Found under the "Project URL" section.
   - Example: `https://yourprojectid.supabase.co`
2. **Anon Key (Public / Publishable Key)**: Found under "Project API keys" labeled as `anon` and `public`.
   - Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key-here...`
3. **Service Role Key (Secret Key)**: Found under "Project API keys" labeled as `service_role` and `secret`.
   - **🔴 CRITICAL SECURITY RULE**: Never share this key or include it in client-side code, ESP32 firmware, or public repositories. It bypasses RLS and allows unrestricted access.
   - Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-service-role-key-here...`

---

## 3. Configure Local Environment Variables

Create the following files in your project directory (placeholders will be filled when we create the dashboard and simulator directories):

### For Next.js Web Dashboard (`/dashboard/.env.local`)
Create a file named `.env.local` inside your `dashboard` directory:
```env
# Public keys (safe to expose to browser, prefixed with NEXT_PUBLIC_)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Secret keys (server-side ONLY, no prefix!)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### For Standalone Simulator (`/simulator/.env`)
Create a file named `.env` inside your `simulator` directory:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### For ESP32 Firmware (`/firmware/src/config.h`)
The ESP32 uses the **anon key** only, never the service role key. Add these to your firmware config:
```cpp
#define SUPABASE_URL "https://your-project-id.supabase.co"
#define SUPABASE_KEY "your-anon-key-here"
```

---

## 4. Manual Dashboard Configurations

While most configurations are handled by running the SQL scripts, you must configure a few settings manually in the Supabase Dashboard:

### A. Turn Off Email Confirmation (For Development)
To allow immediate test accounts without waiting for confirmation emails:
1. Go to **Authentication** (user icon in the left menu).
2. Click on **Provider Settings** (or **Settings** -> **Email Provider** depending on Supabase UI updates).
3. Under the **Email** provider configuration, locate **Confirm email** and toggle it **OFF**.
4. Click **Save**.

### B. Enable Realtime Replication
We must enable the Postgres replication publication to broadcast database changes in real-time.
1. Go to the **Database** section (database icon in the left menu).
2. Click on **Replication** (under the "Database" submenu).
3. Click on **1 table** (or the button to edit the `supabase_realtime` publication). If it doesn't exist or is empty, select the `supabase_realtime` publication.
4. We will configure this programmatically via SQL, but you can verify it in the dashboard. You should see `energy_readings`, `device_status`, `alerts`, and `meter_settings` checked in the list of source tables once the SQL migrations have run.

---

## 5. Division of Work: Manual vs SQL

| Action | How to Apply | Where to Do It |
|---|---|---|
| Create Project | Manual | Supabase Website |
| Get Keys / URLs | Manual | Settings -> API |
| Turn off Email Auth confirmation | Manual | Authentication -> Providers -> Email |
| Create Tables & Indexes | SQL | SQL Editor -> Run `001_schema.sql` |
| Configure Row Level Security (RLS) | SQL | SQL Editor -> Run `002_rls_policies.sql` |
| Database Functions & Aggregations | SQL | SQL Editor -> Run `003_functions.sql` |
| Configure Realtime Replication | SQL | SQL Editor -> Run `004_realtime.sql` |
| Seed Default Device & Settings | SQL | SQL Editor -> Run `005_seed.sql` |
