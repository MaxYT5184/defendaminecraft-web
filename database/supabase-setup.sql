-- DefendAMinecraft Supabase Database Setup
-- Copy and paste this entire code into Supabase SQL Editor and run it

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    github_username TEXT,
    github_id INTEGER UNIQUE,
    company TEXT,
    website TEXT,
    bio TEXT,
    location TEXT,
    public_repos INTEGER DEFAULT 0,
    followers INTEGER DEFAULT 0,
    following INTEGER DEFAULT 0,
    navbar_preference TEXT DEFAULT 'top' CHECK (navbar_preference IN ('top', 'sidebar', 'bottom')),
    theme_preference TEXT DEFAULT 'dark' CHECK (theme_preference IN ('dark', 'light')),
    email_notifications BOOLEAN DEFAULT true,
    marketing_emails BOOLEAN DEFAULT false,
    security_alerts BOOLEAN DEFAULT true,
    github_created_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    key_value TEXT UNIQUE NOT NULL,
    environment TEXT NOT NULL CHECK (environment IN ('production', 'development', 'testing')),
    domain TEXT,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0,
    rate_limit INTEGER DEFAULT 1000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Websites table
CREATE TABLE IF NOT EXISTS public.websites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE NOT NULL,
    domain TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    verification_count INTEGER DEFAULT 0,
    blocked_attempts INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, domain)
);

-- Verification Logs table
CREATE TABLE IF NOT EXISTS public.verification_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE NOT NULL,
    website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    result TEXT NOT NULL CHECK (result IN ('success', 'failed', 'blocked', 'suspicious')),
    verification_time DECIMAL(8,3),
    challenge_type TEXT DEFAULT 'checkbox',
    country_code TEXT,
    city TEXT,
    is_bot BOOLEAN DEFAULT false,
    confidence_score DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security Events table
CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('api_key_created', 'api_key_regenerated', 'api_key_deleted', 'suspicious_activity', 'rate_limit_exceeded', 'login', 'logout')),
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics Summary table
CREATE TABLE IF NOT EXISTS public.analytics_summary (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    total_verifications INTEGER DEFAULT 0,
    successful_verifications INTEGER DEFAULT 0,
    blocked_attempts INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    average_response_time DECIMAL(8,3),
    top_countries JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_github_id ON public.users(github_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_value ON public.api_keys(key_value);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON public.api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_websites_user_id ON public.websites(user_id);
CREATE INDEX IF NOT EXISTS idx_websites_domain ON public.websites(domain);
CREATE INDEX IF NOT EXISTS idx_verification_logs_api_key ON public.verification_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_verification_logs_created_at ON public.verification_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_verification_logs_result ON public.verification_logs(result);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_summary_user_date ON public.analytics_summary(user_id, date);

-- Function for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON public.users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_keys_updated_at ON public.api_keys;
CREATE TRIGGER update_api_keys_updated_at 
    BEFORE UPDATE ON public.api_keys 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_websites_updated_at ON public.websites;
CREATE TRIGGER update_websites_updated_at 
    BEFORE UPDATE ON public.websites 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate API keys
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
BEGIN
    RETURN 'da_live_' || encode(gen_random_bytes(24), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user registration from GitHub OAuth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, avatar_url, github_username, github_id)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'user_name',
        (NEW.raw_user_meta_data->>'provider_id')::INTEGER
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        github_username = EXCLUDED.github_username,
        github_id = EXCLUDED.github_id,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users 
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users 
    FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for api_keys table
DROP POLICY IF EXISTS "Users can view own API keys" ON public.api_keys;
CREATE POLICY "Users can view own API keys" ON public.api_keys 
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own API keys" ON public.api_keys;
CREATE POLICY "Users can create own API keys" ON public.api_keys 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own API keys" ON public.api_keys;
CREATE POLICY "Users can update own API keys" ON public.api_keys 
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own API keys" ON public.api_keys;
CREATE POLICY "Users can delete own API keys" ON public.api_keys 
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for websites table
DROP POLICY IF EXISTS "Users can view own websites" ON public.websites;
CREATE POLICY "Users can view own websites" ON public.websites 
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own websites" ON public.websites;
CREATE POLICY "Users can create own websites" ON public.websites 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own websites" ON public.websites;
CREATE POLICY "Users can update own websites" ON public.websites 
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own websites" ON public.websites;
CREATE POLICY "Users can delete own websites" ON public.websites 
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for verification_logs table
DROP POLICY IF EXISTS "Users can view own verification logs" ON public.verification_logs;
CREATE POLICY "Users can view own verification logs" ON public.verification_logs 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.api_keys 
            WHERE api_keys.id = verification_logs.api_key_id 
            AND api_keys.user_id = auth.uid()
        )
    );

-- RLS Policies for security_events table
DROP POLICY IF EXISTS "Users can view own security events" ON public.security_events;
CREATE POLICY "Users can view own security events" ON public.security_events 
    FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for analytics_summary table
DROP POLICY IF EXISTS "Users can view own analytics" ON public.analytics_summary;
CREATE POLICY "Users can view own analytics" ON public.analytics_summary 
    FOR SELECT USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant limited permissions to anonymous users (for API verification)
GRANT SELECT ON public.api_keys TO anon;
GRANT INSERT ON public.verification_logs TO anon;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '🎉 DefendAMinecraft database setup completed successfully!';
    RAISE NOTICE '✅ All tables, indexes, triggers, and RLS policies have been created.';
    RAISE NOTICE '🔐 Row Level Security is enabled for data protection.';
    RAISE NOTICE '🚀 Your database is ready for DefendAMinecraft!';
END $$;
