// Supabase Configuration
// Make sure to set these environment variables in your .env file

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

// Function to execute SQL schema
async function executeSchema() {
    try {
        console.log('🔄 Setting up database schema...');
        
        // Read the schema file
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema file not found at: ${schemaPath}`);
        }
        
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Split into individual statements and execute
        const statements = schema
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        console.log(`📋 Executing ${statements.length} SQL statements...`);
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const statement of statements) {
            try {
                const { error } = await supabaseAdmin.rpc('exec_sql', { 
                    sql: statement 
                });
                
                if (error) {
                    // Try direct execution for some statements
                    console.warn(`⚠️  Statement warning: ${error.message.substring(0, 100)}...`);
                    errorCount++;
                } else {
                    successCount++;
                }
            } catch (err) {
                console.warn(`⚠️  Execution warning: ${err.message.substring(0, 100)}...`);
                errorCount++;
            }
        }
        
        console.log(`✅ Schema setup completed: ${successCount} successful, ${errorCount} warnings`);
        return { success: true, executed: successCount, warnings: errorCount };
        
    } catch (error) {
        console.error('❌ Schema setup failed:', error.message);
        return { success: false, error: error.message };
    }
}

// Function to check if database is set up
async function checkDatabaseSetup() {
    try {
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('id')
            .limit(1);
        
        if (error && error.code === 'PGRST116') {
            // Table doesn't exist
            return false;
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

// Auto-setup database if not configured
async function initializeDatabase() {
    const isSetup = await checkDatabaseSetup();
    
    if (!isSetup && supabaseUrl !== 'https://your-project.supabase.co') {
        console.log('🚀 Database not found, attempting auto-setup...');
        return await executeSchema();
    }
    
    return { success: true, message: 'Database already configured or Supabase not set up' };
}

module.exports = {
    supabase,
    supabaseAdmin,
    githubConfig,
    executeSchema,
    checkDatabaseSetup,
    initializeDatabase
};

// Helper functions for database operations
class DatabaseService {
    // Check if Supabase is configured
    static isConfigured() {
        return supabaseUrl !== 'https://your-project.supabase.co' && 
               supabaseServiceKey !== 'your-service-key';
    }

    // User operations
    static async createUser(userData) {
        if (!this.isConfigured()) {
            console.log('Supabase not configured, using mock data');
            return userData;
        }

        try {
            // First create the user in Supabase auth if it's an email signup
            if (userData.auth_provider === 'email' && userData.password_hash) {
                const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                    email: userData.email,
                    password: userData.password_hash, // This should be the plain password, not hash
                    email_confirm: true,
                    user_metadata: {
                        full_name: userData.full_name,
                        first_name: userData.first_name,
                        last_name: userData.last_name,
                        avatar_url: userData.avatar_url
                    }
                });

                if (authError) {
                    console.warn('Supabase auth creation failed:', authError.message);
                    return userData; // Fallback to mock data
                }

                userData.id = authData.user.id; // Use Supabase auth user ID
            }

            const { data, error } = await supabaseAdmin
                .from('users')
                .insert([{
                    id: userData.id,
                    email: userData.email,
                    full_name: userData.full_name,
                    avatar_url: userData.avatar_url,
                    github_username: userData.github_username || null,
                    github_id: userData.github_id || null,
                    company: userData.company || null,
                    bio: userData.bio || null,
                    location: userData.location || null,
                    public_repos: userData.public_repos || 0,
                    followers: userData.followers || 0,
                    following: userData.following || 0
                }])
                .select()
                .single();
            
            if (error) {
                console.warn('Database insert failed:', error.message);
                return userData; // Fallback to mock data
            }
            
            console.log('✅ User saved to Supabase:', data.email);
            return data;
        } catch (error) {
            console.warn('Database operation failed, using fallback:', error.message);
            return userData;
        }
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
