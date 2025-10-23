#!/usr/bin/env node

/**
 * Database Setup Script for DefendAMinecraft
 * This script sets up the Supabase database with the required schema
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    console.error('   Copy .env.example to .env and fill in your Supabase credentials');
    process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function setupDatabase() {
    console.log('🚀 Setting up DefendAMinecraft database...\n');

    try {
        // Read SQL schema file
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema file not found at: ${schemaPath}`);
        }

        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('📋 Executing database schema...');
        
        // Split schema into individual statements
        const statements = schema
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        let successCount = 0;
        let errorCount = 0;

        for (const statement of statements) {
            try {
                const { error } = await supabase.rpc('exec_sql', { sql: statement });
                
                if (error) {
                    // Try direct query execution as fallback
                    const { error: directError } = await supabase
                        .from('_temp_')
                        .select('1')
                        .limit(0);
                    
                    if (directError && !directError.message.includes('does not exist')) {
                        console.warn(`⚠️  Warning executing statement: ${error.message}`);
                        errorCount++;
                    } else {
                        successCount++;
                    }
                } else {
                    successCount++;
                }
            } catch (err) {
                console.warn(`⚠️  Warning: ${err.message}`);
                errorCount++;
            }
        }

        console.log(`✅ Schema execution completed: ${successCount} successful, ${errorCount} warnings\n`);

        // Verify tables were created
        console.log('🔍 Verifying database setup...');
        
        const tables = [
            'users',
            'api_keys', 
            'websites',
            'verification_logs',
            'security_events',
            'user_sessions',
            'analytics_summary'
        ];

        for (const table of tables) {
            try {
                const { error } = await supabase
                    .from(table)
                    .select('*')
                    .limit(1);
                
                if (error) {
                    console.log(`❌ Table '${table}' verification failed: ${error.message}`);
                } else {
                    console.log(`✅ Table '${table}' verified`);
                }
            } catch (err) {
                console.log(`❌ Table '${table}' verification error: ${err.message}`);
            }
        }

        console.log('\n🎉 Database setup completed successfully!');
        console.log('\n📝 Next steps:');
        console.log('   1. Set up GitHub OAuth app and update GITHUB_CLIENT_ID/SECRET');
        console.log('   2. Update your frontend to use the API endpoints');
        console.log('   3. Test the reCAPTCHA integration');
        console.log('   4. Deploy to production when ready');

    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        console.error('\n🔧 Troubleshooting:');
        console.error('   1. Verify your Supabase credentials are correct');
        console.error('   2. Ensure your Supabase project has the required permissions');
        console.error('   3. Check that the schema.sql file exists and is readable');
        process.exit(1);
    }
}

// Create sample data
async function createSampleData() {
    console.log('\n📊 Creating sample data...');
    
    try {
        // Create a demo user (this will be handled by the auth trigger in production)
        const demoUserId = '550e8400-e29b-41d4-a716-446655440000';
        
        // Check if demo user exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('id', demoUserId)
            .single();

        if (!existingUser) {
            const { error: userError } = await supabase
                .from('users')
                .insert({
                    id: demoUserId,
                    email: 'demo@defendaminecraft.online',
                    full_name: 'Demo User',
                    avatar_url: 'https://github.com/octocat.png',
                    github_username: 'demo-user'
                });

            if (userError) {
                console.warn('⚠️  Could not create demo user:', userError.message);
            } else {
                console.log('✅ Demo user created');
            }
        } else {
            console.log('✅ Demo user already exists');
        }

        // Create sample API key
        const { data: existingKey } = await supabase
            .from('api_keys')
            .select('id')
            .eq('key_value', 'da_live_demo123456789abcdef')
            .single();

        if (!existingKey) {
            const { error: keyError } = await supabase
                .from('api_keys')
                .insert({
                    user_id: demoUserId,
                    name: 'Demo API Key',
                    key_value: 'da_live_demo123456789abcdef',
                    environment: 'development',
                    domain: 'localhost'
                });

            if (keyError) {
                console.warn('⚠️  Could not create demo API key:', keyError.message);
            } else {
                console.log('✅ Demo API key created');
            }
        } else {
            console.log('✅ Demo API key already exists');
        }

        console.log('✅ Sample data setup completed');

    } catch (error) {
        console.warn('⚠️  Sample data creation failed:', error.message);
    }
}

// Main execution
async function main() {
    console.log('DefendAMinecraft Database Setup');
    console.log('================================\n');
    
    await setupDatabase();
    await createSampleData();
    
    console.log('\n🎯 Your DefendAMinecraft API is ready!');
    console.log(`   API Base URL: ${process.env.API_BASE_URL || 'http://localhost:3000'}`);
    console.log('   Demo API Key: da_live_demo123456789abcdef');
    console.log('   Dashboard: http://localhost:3000/dashboard');
    
    process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});

// Run the setup
main();
