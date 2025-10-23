const express = require('express');
const rateLimit = require('express-rate-limit');
// For now, we'll create a mock DatabaseService until Supabase is properly configured
const DatabaseService = {
    validateApiKey: async (key) => {
        // Mock validation - in production this would check Supabase
        if (key === 'da_live_demo123456789abcdef' || key.startsWith('da_live_')) {
            return {
                id: 'demo-key-id',
                user_id: 'demo-user-id',
                usage_count: 0,
                last_used_at: null
            };
        }
        return null;
    },
    updateApiKey: async (id, updates) => {
        // Mock update
        return { success: true };
    },
    logVerification: async (logData) => {
        // Mock logging
        console.log('Verification logged:', logData);
        return { success: true };
    },
    getUserAnalytics: async (userId, days) => {
        // Mock analytics data
        return Array.from({ length: 10 }, (_, i) => ({
            created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
            result: Math.random() > 0.1 ? 'success' : 'blocked',
            verification_time: 200 + Math.random() * 300,
            country_code: ['US', 'CA', 'GB', 'DE', 'FR'][Math.floor(Math.random() * 5)],
            city: 'Demo City'
        }));
    }
};
const crypto = require('crypto');
const geoip = require('geoip-lite');
const useragent = require('useragent');

const router = express.Router();

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Verification rate limiting (more strict)
const verifyLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 verifications per minute
    message: {
        error: 'Rate limit exceeded',
        message: 'Too many verification attempts. Please slow down.'
    }
});

// Apply rate limiting to all API routes
router.use(apiLimiter);

// Middleware to validate API key
async function validateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.body.apiKey || req.query.apiKey;
    
    if (!apiKey) {
        return res.status(401).json({
            success: false,
            error: 'API key required',
            message: 'Please provide a valid API key in the X-API-Key header'
        });
    }

    try {
        const keyData = await DatabaseService.validateApiKey(apiKey);
        
        if (!keyData) {
            return res.status(401).json({
                success: false,
                error: 'Invalid API key',
                message: 'The provided API key is invalid or inactive'
            });
        }

        // Update last used timestamp
        await DatabaseService.updateApiKey(keyData.id, {
            last_used_at: new Date().toISOString(),
            usage_count: keyData.usage_count + 1
        });

        req.apiKey = keyData;
        next();
    } catch (error) {
        console.error('API key validation error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Failed to validate API key'
        });
    }
}

// Generate challenge endpoint
router.post('/v1/challenge', validateApiKey, async (req, res) => {
    try {
        const challenge = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            difficulty: req.body.difficulty || 'medium',
            type: req.body.type || 'checkbox'
        };

        // Create challenge token
        const token = Buffer.from(JSON.stringify(challenge)).toString('base64url');

        res.json({
            success: true,
            challenge: {
                token,
                type: challenge.type,
                expires_in: 300 // 5 minutes
            }
        });
    } catch (error) {
        console.error('Challenge generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate challenge'
        });
    }
});

// Verify challenge endpoint
router.post('/v1/verify', verifyLimiter, validateApiKey, async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { token, response, userAgent, ipAddress } = req.body;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Missing token',
                message: 'Challenge token is required'
            });
        }

        // Decode and validate challenge
        let challenge;
        try {
            challenge = JSON.parse(Buffer.from(token, 'base64url').toString());
        } catch (e) {
            return res.status(400).json({
                success: false,
                error: 'Invalid token',
                message: 'Challenge token is malformed'
            });
        }

        // Check if challenge has expired
        if (Date.now() - challenge.timestamp > 300000) { // 5 minutes
            return res.status(400).json({
                success: false,
                error: 'Token expired',
                message: 'Challenge token has expired'
            });
        }

        // Perform verification logic
        const verificationResult = await performVerification({
            challenge,
            response,
            userAgent: userAgent || req.headers['user-agent'],
            ipAddress: ipAddress || req.ip,
            apiKey: req.apiKey
        });

        const verificationTime = Date.now() - startTime;

        // Log verification attempt
        const clientIp = ipAddress || req.ip;
        const geo = geoip.lookup(clientIp);
        
        await DatabaseService.logVerification({
            api_key_id: req.apiKey.id,
            ip_address: clientIp,
            user_agent: userAgent || req.headers['user-agent'],
            result: verificationResult.success ? 'success' : 'failed',
            verification_time: verificationTime,
            challenge_type: challenge.type,
            country_code: geo?.country || null,
            city: geo?.city || null,
            is_bot: verificationResult.isBot,
            confidence_score: verificationResult.confidence
        });

        res.json({
            success: verificationResult.success,
            score: verificationResult.confidence,
            action: verificationResult.action,
            challenge_ts: new Date().toISOString(),
            hostname: req.hostname,
            verification_time: verificationTime
        });

    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Verification failed',
            message: 'Internal server error during verification'
        });
    }
});

// Get API key statistics
router.get('/v1/stats', validateApiKey, async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        const days = parseInt(period.replace('d', '')) || 30;
        
        const analytics = await DatabaseService.getUserAnalytics(req.apiKey.user_id, days);
        
        // Process analytics data
        const stats = processAnalytics(analytics);
        
        res.json({
            success: true,
            data: {
                period: `${days} days`,
                total_verifications: stats.totalVerifications,
                successful_verifications: stats.successfulVerifications,
                blocked_attempts: stats.blockedAttempts,
                success_rate: stats.successRate,
                average_response_time: stats.averageResponseTime,
                top_countries: stats.topCountries,
                daily_breakdown: stats.dailyBreakdown
            }
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics'
        });
    }
});

// Health check endpoint
router.get('/v1/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// API documentation endpoint
router.get('/v1/docs', (req, res) => {
    res.json({
        name: 'DefendAMinecraft reCAPTCHA API',
        version: '1.0.0',
        description: 'Advanced reCAPTCHA verification service',
        endpoints: {
            'POST /api/v1/challenge': 'Generate a new verification challenge',
            'POST /api/v1/verify': 'Verify a challenge response',
            'GET /api/v1/stats': 'Get API usage statistics',
            'GET /api/v1/health': 'API health check'
        },
        authentication: 'API Key required in X-API-Key header',
        rate_limits: {
            general: '1000 requests per 15 minutes',
            verification: '100 requests per minute'
        }
    });
});

// Advanced verification logic
async function performVerification({ challenge, response, userAgent, ipAddress, apiKey }) {
    const agent = useragent.parse(userAgent);
    const geo = geoip.lookup(ipAddress);
    
    let confidence = 0.5; // Base confidence
    let isBot = false;
    let action = 'allow';
    
    // Bot detection heuristics
    const botIndicators = [
        // User agent analysis
        !userAgent || userAgent.length < 10,
        userAgent.toLowerCase().includes('bot'),
        userAgent.toLowerCase().includes('crawler'),
        userAgent.toLowerCase().includes('spider'),
        
        // Suspicious patterns
        agent.family === 'Other',
        !agent.os.family || agent.os.family === 'Other',
        
        // Geographic anomalies (basic check)
        geo && ['CN', 'RU', 'KP'].includes(geo.country) && Math.random() > 0.7
    ];
    
    const botScore = botIndicators.filter(Boolean).length / botIndicators.length;
    
    if (botScore > 0.6) {
        isBot = true;
        confidence = 0.1;
        action = 'block';
    } else if (botScore > 0.3) {
        confidence = 0.3;
        action = 'challenge';
    } else {
        confidence = Math.min(0.9, 0.5 + (Math.random() * 0.4));
        action = 'allow';
    }
    
    // For demo purposes, simulate some verification logic
    if (challenge.type === 'checkbox') {
        // Simple checkbox verification
        const success = !isBot && Math.random() > 0.05; // 95% success rate for humans
        return {
            success,
            confidence: success ? confidence : 0.1,
            isBot,
            action: success ? 'allow' : 'block'
        };
    }
    
    return {
        success: !isBot,
        confidence,
        isBot,
        action
    };
}

// Process analytics data
function processAnalytics(rawData) {
    const totalVerifications = rawData.length;
    const successfulVerifications = rawData.filter(log => log.result === 'success').length;
    const blockedAttempts = rawData.filter(log => log.result === 'blocked').length;
    const successRate = totalVerifications > 0 ? (successfulVerifications / totalVerifications * 100).toFixed(2) : 0;
    
    const responseTimes = rawData.filter(log => log.verification_time).map(log => log.verification_time);
    const averageResponseTime = responseTimes.length > 0 
        ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2)
        : 0;
    
    // Top countries
    const countries = {};
    rawData.forEach(log => {
        if (log.country_code) {
            countries[log.country_code] = (countries[log.country_code] || 0) + 1;
        }
    });
    
    const topCountries = Object.entries(countries)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([country, count]) => ({ country, count }));
    
    // Daily breakdown
    const dailyData = {};
    rawData.forEach(log => {
        const date = new Date(log.created_at).toISOString().split('T')[0];
        if (!dailyData[date]) {
            dailyData[date] = { total: 0, successful: 0, blocked: 0 };
        }
        dailyData[date].total++;
        if (log.result === 'success') dailyData[date].successful++;
        if (log.result === 'blocked') dailyData[date].blocked++;
    });
    
    const dailyBreakdown = Object.entries(dailyData)
        .sort(([a], [b]) => new Date(a) - new Date(b))
        .map(([date, data]) => ({ date, ...data }));
    
    return {
        totalVerifications,
        successfulVerifications,
        blockedAttempts,
        successRate: parseFloat(successRate),
        averageResponseTime: parseFloat(averageResponseTime),
        topCountries,
        dailyBreakdown
    };
}

module.exports = router;
