-- Create tenants table
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies for tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants are viewable by authenticated users" 
ON public.tenants FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Tenants are insertable by admins" 
ON public.tenants FOR INSERT 
TO authenticated 
WITH CHECK (auth.jwt() ? 'role' AND auth.jwt()->>'role' = 'admin');

CREATE POLICY "Tenants are updatable by admins" 
ON public.tenants FOR UPDATE 
TO authenticated 
USING (auth.jwt() ? 'role' AND auth.jwt()->>'role' = 'admin');

-- Create or update user profiles table with tenant_id and role
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'user',
    tenant_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- Add tenant_id to devices table
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS tenant_id TEXT;

-- Create devices table
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    device_id TEXT UNIQUE NOT NULL,
    name TEXT,
    location TEXT,
    status TEXT DEFAULT 'offline',
    last_reading DECIMAL(10,2) DEFAULT 0,
    calibration_factor FLOAT DEFAULT 1000.0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS policies for devices
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Create index on user_id
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id);

-- Create index on tenant_id
CREATE INDEX IF NOT EXISTS idx_devices_tenant_id ON public.devices(tenant_id);

-- Kebijakan RLS untuk devices
CREATE POLICY "Users can view their own devices" 
ON public.devices FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own devices" 
ON public.devices FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices" 
ON public.devices FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own devices" 
ON public.devices FOR DELETE 
USING (auth.uid() = user_id);

-- Create readings table
CREATE TABLE IF NOT EXISTS public.readings (
    id BIGSERIAL PRIMARY KEY,
    device_id TEXT REFERENCES public.devices(device_id),
    kwh_value FLOAT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- Add RLS policies for readings
ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;

-- Create index on device_id
CREATE INDEX IF NOT EXISTS idx_readings_device_id ON public.readings(device_id);

-- Create index on timestamp
CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON public.readings(timestamp);

-- Kebijakan RLS untuk readings
CREATE POLICY "Users can view readings of their devices" 
ON public.readings FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.devices 
    WHERE devices.device_id = readings.device_id 
    AND devices.user_id = auth.uid()
));

CREATE POLICY "Allow insert with anon key" 
ON public.readings FOR INSERT 
WITH CHECK (true);

-- Create alerts table
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id TEXT REFERENCES public.devices(device_id),
    type TEXT NOT NULL, -- 'info', 'warning', 'danger'
    message TEXT NOT NULL,
    status TEXT DEFAULT 'active', -- 'active', 'dismissed'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS policies for alerts
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Kebijakan RLS untuk alerts
CREATE POLICY "Users can view alerts of their devices" 
ON public.alerts FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.devices 
    WHERE devices.device_id = alerts.device_id 
    AND devices.user_id = auth.uid()
));

CREATE POLICY "Users can create alerts for their devices" 
ON public.alerts FOR INSERT 
WITH CHECK (EXISTS (
    SELECT 1 FROM public.devices 
    WHERE devices.device_id = alerts.device_id 
    AND devices.user_id = auth.uid()
));

-- Sample data: Create demo tenants
INSERT INTO public.tenants (name, description)
VALUES 
    ('Company A', 'Main office building'),
    ('Company B', 'Manufacturing facility'),
    ('Company C', 'Retail locations')
ON CONFLICT DO NOTHING;

-- Function to update role and tenant claims in JWT token
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to update JWT with role and tenant info
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb 
    LANGUAGE sql STABLE 
    AS $$
    SELECT
        coalesce(
            nullif(current_setting('request.jwt.claim', true), ''),
            '{}'
        )::jsonb
$$;

-- Create readings table
CREATE TABLE IF NOT EXISTS public.readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id TEXT NOT NULL REFERENCES public.devices(device_id),
    kwh_value DECIMAL NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies for readings
ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Readings are viewable by tenant users and admins" 
ON public.readings FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.devices d
        JOIN public.profiles p ON p.tenant_id = d.tenant_id
        WHERE d.device_id = readings.device_id
        AND p.id = auth.uid()
    )
    OR
    auth.jwt() ? 'role' AND auth.jwt()->>'role' = 'admin'
);

CREATE POLICY "Readings are insertable by tenant users and admins" 
ON public.readings FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.devices d
        JOIN public.profiles p ON p.tenant_id = d.tenant_id
        WHERE d.device_id = readings.device_id
        AND p.id = auth.uid()
    )
    OR
    auth.jwt() ? 'role' AND auth.jwt()->>'role' = 'admin'
); 