const express = require('express');
const { executeSchema, checkDatabaseSetup, initializeDatabase } = require('../config/supabase');
const router = express.Router();

// Database setup page
router.get('/', async (req, res) => {
    try {
        const isSetup = await checkDatabaseSetup();
        
        res.render('pages/setup', {
            title: 'Database Setup | DefendAMinecraft',
            isSetup: isSetup,
            supabaseConfigured: process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://your-project.supabase.co'
        });
    } catch (error) {
        res.render('pages/setup', {
            title: 'Database Setup | DefendAMinecraft',
            isSetup: false,
            supabaseConfigured: false,
            error: error.message
        });
    }
});

// Execute database setup
router.post('/execute', async (req, res) => {
    try {
        console.log('🚀 Starting database setup...');
        
        const result = await executeSchema();
        
        res.json({
            success: result.success,
            message: result.success 
                ? `Database setup completed! Executed ${result.executed} statements with ${result.warnings} warnings.`
                : `Database setup failed: ${result.error}`,
            details: result
        });
    } catch (error) {
        console.error('Setup route error:', error);
        res.status(500).json({
            success: false,
            message: 'Database setup failed: ' + error.message,
            error: error.message
        });
    }
});

// Check database status
router.get('/status', async (req, res) => {
    try {
        const isSetup = await checkDatabaseSetup();
        
        res.json({
            success: true,
            isSetup: isSetup,
            supabaseConfigured: process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://your-project.supabase.co',
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        res.json({
            success: false,
            isSetup: false,
            supabaseConfigured: false,
            error: error.message
        });
    }
});

// Auto-initialize database
router.post('/auto-init', async (req, res) => {
    try {
        const result = await initializeDatabase();
        
        res.json({
            success: result.success,
            message: result.message || 'Database initialization completed',
            details: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Auto-initialization failed: ' + error.message
        });
    }
});

module.exports = router;
