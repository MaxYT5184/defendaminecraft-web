// Supabase Configuration
// Make sure to set these environment variables in your .env file

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-key';

// Client for frontend operations (with RLS)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for backend operations (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// GitHub OAuth configuration
const githubConfig = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    redirectUri: process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/auth/github/callback'
};

module.exports = {
    supabase,
    supabaseAdmin,
    githubConfig
};

// Helper functions for database operations
class DatabaseService {
    // User operations
    static async createUser(userData) {
        const { data, error } = await supabaseAdmin
            .from('users')
            .insert([userData])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    static async getUserById(userId) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) throw error;
        return data;
    }

    static async updateUser(userId, updates) {
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    // API Key operations
    static async createApiKey(userId, keyData) {
        const apiKey = {
            ...keyData,
            user_id: userId,
            key_value: await this.generateApiKey()
        };

        const { data, error } = await supabase
            .from('api_keys')
            .insert([apiKey])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    static async getUserApiKeys(userId) {
        const { data, error } = await supabase
            .from('api_keys')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    }

    static async updateApiKey(keyId, updates) {
        const { data, error } = await supabase
            .from('api_keys')
            .update(updates)
            .eq('id', keyId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    static async deleteApiKey(keyId) {
        const { data, error } = await supabase
            .from('api_keys')
            .update({ is_active: false })
            .eq('id', keyId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    static async validateApiKey(keyValue) {
        const { data, error } = await supabaseAdmin
            .from('api_keys')
            .select('*')
            .eq('key_value', keyValue)
            .eq('is_active', true)
            .single();
        
        if (error) return null;
        return data;
    }

    // Verification logging
    static async logVerification(logData) {
        const { data, error } = await supabaseAdmin
            .from('verification_logs')
            .insert([logData])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    // Analytics
    static async getUserAnalytics(userId, days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data, error } = await supabase
            .from('verification_logs')
            .select(`
                *,
                api_keys!inner(user_id)
            `)
            .eq('api_keys.user_id', userId)
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    }

    static async getDashboardStats(userId) {
        // Get today's stats
        const today = new Date().toISOString().split('T')[0];
        
        const { data: todayStats, error: todayError } = await supabase
            .rpc('get_user_daily_stats', { 
                user_id: userId, 
                target_date: today 
            });

        if (todayError) throw todayError;

        // Get total API keys count
        const { count: apiKeysCount, error: keysError } = await supabase
            .from('api_keys')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_active', true);

        if (keysError) throw keysError;

        // Get active websites count
        const { count: websitesCount, error: sitesError } = await supabase
            .from('websites')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_active', true);

        if (sitesError) throw sitesError;

        return {
            todayVerifications: todayStats?.total_verifications || 0,
            todayBlocked: todayStats?.blocked_attempts || 0,
            apiKeysCount: apiKeysCount || 0,
            websitesCount: websitesCount || 0
        };
    }

    // Security events
    static async logSecurityEvent(userId, eventData) {
        const event = {
            ...eventData,
            user_id: userId
        };

        const { data, error } = await supabaseAdmin
            .from('security_events')
            .insert([event])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    // Session management
    static async createUserSession(userId, sessionData) {
        const session = {
            ...sessionData,
            user_id: userId,
            session_token: this.generateSessionToken(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        };

        const { data, error } = await supabase
            .from('user_sessions')
            .insert([session])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    static async updateUserSession(sessionToken, updates) {
        const { data, error } = await supabase
            .from('user_sessions')
            .update(updates)
            .eq('session_token', sessionToken)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    // Utility functions
    static async generateApiKey() {
        const crypto = require('crypto');
        return 'da_live_' + crypto.randomBytes(24).toString('base64url');
    }

    static generateSessionToken() {
        const crypto = require('crypto');
        return crypto.randomBytes(32).toString('base64url');
    }
}

module.exports.DatabaseService = DatabaseService;
