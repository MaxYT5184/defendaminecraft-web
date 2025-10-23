-- DefendAMinecraft Database Schema for Supabase
-- This file contains all the SQL commands to set up the database

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    github_username TEXT,
    github_id INTEGER,
    company TEXT,
    website TEXT,
    bio TEXT,
    navbar_preference TEXT DEFAULT 'top' CHECK (navbar_preference IN ('top', 'sidebar', 'bottom')),
    theme_preference TEXT DEFAULT 'dark' CHECK (theme_preference IN ('dark', 'light')),
    email_notifications BOOLEAN DEFAULT true,
    marketing_emails BOOLEAN DEFAULT false,
    security_alerts BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Keys table
CREATE TABLE public.api_keys (
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
CREATE TABLE public.websites (
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
CREATE TABLE public.verification_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE NOT NULL,
    website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    result TEXT NOT NULL CHECK (result IN ('success', 'failed', 'blocked', 'suspicious')),
    verification_time DECIMAL(8,3), -- in milliseconds
    challenge_type TEXT DEFAULT 'checkbox',
    country_code TEXT,
    city TEXT,
    is_bot BOOLEAN DEFAULT false,
    confidence_score DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security Events table
CREATE TABLE public.security_events (
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

-- User Sessions table (for tracking navbar preferences and other session data)
CREATE TABLE public.user_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    navbar_style TEXT DEFAULT 'top',
    theme TEXT DEFAULT 'dark',
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics Summary table (for dashboard stats)
CREATE TABLE public.analytics_summary (
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

-- Indexes for better performance
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_github_id ON public.users(github_id);
CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX idx_api_keys_key_value ON public.api_keys(key_value);
CREATE INDEX idx_api_keys_active ON public.api_keys(is_active);
CREATE INDEX idx_websites_user_id ON public.websites(user_id);
CREATE INDEX idx_websites_domain ON public.websites(domain);
CREATE INDEX idx_verification_logs_api_key ON public.verification_logs(api_key_id);
CREATE INDEX idx_verification_logs_created_at ON public.verification_logs(created_at);
CREATE INDEX idx_verification_logs_result ON public.verification_logs(result);
CREATE INDEX idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX idx_security_events_created_at ON public.security_events(created_at);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON public.user_sessions(session_token);
CREATE INDEX idx_analytics_summary_user_date ON public.analytics_summary(user_id, date);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_websites_updated_at BEFORE UPDATE ON public.websites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate API keys
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
BEGIN
    RETURN 'da_live_' || encode(gen_random_bytes(24), 'base64')::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to update website stats
CREATE OR REPLACE FUNCTION update_website_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.websites 
        SET 
            verification_count = verification_count + 1,
            blocked_attempts = CASE 
                WHEN NEW.result IN ('blocked', 'failed') THEN blocked_attempts + 1 
                ELSE blocked_attempts 
            END,
            success_rate = (
                SELECT ROUND(
                    (COUNT(*) FILTER (WHERE result = 'success')::DECIMAL / COUNT(*)) * 100, 2
                )
                FROM public.verification_logs 
                WHERE website_id = NEW.website_id
            )
        WHERE id = NEW.website_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update website stats
CREATE TRIGGER update_website_stats_trigger
    AFTER INSERT ON public.verification_logs
    FOR EACH ROW EXECUTE FUNCTION update_website_stats();

-- Function to clean up old verification logs (keep only 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM public.verification_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_summary ENABLE ROW LEVEL SECURITY;

-- Users can only see and modify their own data
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- API Keys policies
CREATE POLICY "Users can view own API keys" ON public.api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own API keys" ON public.api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own API keys" ON public.api_keys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own API keys" ON public.api_keys FOR DELETE USING (auth.uid() = user_id);

-- Websites policies
CREATE POLICY "Users can view own websites" ON public.websites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own websites" ON public.websites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own websites" ON public.websites FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own websites" ON public.websites FOR DELETE USING (auth.uid() = user_id);

-- Verification logs policies (users can only see logs for their API keys)
CREATE POLICY "Users can view own verification logs" ON public.verification_logs FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.api_keys 
        WHERE api_keys.id = verification_logs.api_key_id 
        AND api_keys.user_id = auth.uid()
    )
);

-- Security events policies
CREATE POLICY "Users can view own security events" ON public.security_events FOR SELECT USING (auth.uid() = user_id);

-- User sessions policies
CREATE POLICY "Users can view own sessions" ON public.user_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own sessions" ON public.user_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.user_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON public.user_sessions FOR DELETE USING (auth.uid() = user_id);

-- Analytics summary policies
CREATE POLICY "Users can view own analytics" ON public.analytics_summary FOR SELECT USING (auth.uid() = user_id);

-- Function to handle new user registration
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
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create a scheduled job to clean up old logs (if using pg_cron extension)
-- SELECT cron.schedule('cleanup-old-logs', '0 2 * * *', 'SELECT cleanup_old_logs();');

-- Insert some sample data for development
INSERT INTO public.users (id, email, full_name, avatar_url, github_username) VALUES 
('550e8400-e29b-41d4-a716-446655440000', 'demo@example.com', 'Demo User', 'https://github.com/octocat.png', 'octocat')
ON CONFLICT (id) DO NOTHING;

-- Sample API key
INSERT INTO public.api_keys (user_id, name, key_value, environment, domain) VALUES 
('550e8400-e29b-41d4-a716-446655440000', 'Demo Website', 'da_live_demo123456789abcdef', 'development', 'localhost')
ON CONFLICT (key_value) DO NOTHING;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant limited permissions to anonymous users (for API verification)
GRANT SELECT ON public.api_keys TO anon;
GRANT INSERT ON public.verification_logs TO anon;

COMMENT ON TABLE public.users IS 'User profiles and preferences';
COMMENT ON TABLE public.api_keys IS 'API keys for reCAPTCHA service access';
COMMENT ON TABLE public.websites IS 'Websites protected by the reCAPTCHA service';
COMMENT ON TABLE public.verification_logs IS 'Log of all verification attempts';
COMMENT ON TABLE public.security_events IS 'Security-related events and alerts';
COMMENT ON TABLE public.user_sessions IS 'User session data including UI preferences';
COMMENT ON TABLE public.analytics_summary IS 'Daily analytics summary for dashboard';
