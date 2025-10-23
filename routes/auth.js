const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// Mock database for now - replace with real Supabase when configured
const userDatabase = new Map();
const userApiKeys = new Map();
const userAnalytics = new Map();

// Database functions
async function saveUserToDatabase(user) {
    // Store user data
    userDatabase.set(user.id, {
        ...user,
        updated_at: new Date().toISOString()
    });
    
    // Initialize user analytics if not exists
    if (!userAnalytics.has(user.id)) {
        userAnalytics.set(user.id, {
            totalVerifications: Math.floor(Math.random() * 1000) + 100,
            successfulVerifications: Math.floor(Math.random() * 800) + 80,
            blockedAttempts: Math.floor(Math.random() * 50) + 10,
            apiKeysCount: Math.floor(Math.random() * 3) + 1,
            websitesCount: Math.floor(Math.random() * 5) + 1,
            lastActivity: new Date().toISOString(),
            monthlyStats: generateMonthlyStats()
        });
    }
    
    // Create default API key if user doesn't have one
    if (!userApiKeys.has(user.id)) {
        const apiKey = generateApiKey();
        userApiKeys.set(user.id, [{
            id: crypto.randomUUID(),
            name: 'Default API Key',
            key_value: apiKey,
            environment: 'development',
            domain: 'localhost',
            is_active: true,
            usage_count: Math.floor(Math.random() * 100),
            created_at: new Date().toISOString()
        }]);
    }
    
    return user;
}

function generateApiKey() {
    return 'da_live_' + crypto.randomBytes(24).toString('base64url');
}

function generateMonthlyStats() {
    const stats = [];
    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        stats.push({
            date: date.toISOString().split('T')[0],
            verifications: Math.floor(Math.random() * 50) + 10,
            blocked: Math.floor(Math.random() * 10) + 1
        });
    }
    return stats;
}

async function getUserData(userId) {
    return userDatabase.get(parseInt(userId));
}

async function getUserAnalytics(userId) {
    return userAnalytics.get(parseInt(userId)) || {
        totalVerifications: 0,
        successfulVerifications: 0,
        blockedAttempts: 0,
        apiKeysCount: 0,
        websitesCount: 0,
        lastActivity: new Date().toISOString(),
        monthlyStats: []
    };
}

async function getUserApiKeys(userId) {
    return userApiKeys.get(parseInt(userId)) || [];
}

// GitHub OAuth configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/auth/github/callback';

// Temporary storage for OAuth states (in production, use Redis or database)
const oauthStates = new Map();

// GitHub login route
router.get('/github', (req, res) => {
    if (!GITHUB_CLIENT_ID) {
        return res.status(500).json({
            error: 'GitHub OAuth not configured',
            message: 'Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables'
        });
    }

    // Generate state parameter for security
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state with expiration (5 minutes)
    oauthStates.set(state, {
        created: Date.now(),
        redirectUrl: req.query.redirect || '/dashboard'
    });

    // Clean up expired states
    cleanupExpiredStates();

    // Build GitHub OAuth URL
    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
    githubAuthUrl.searchParams.set('redirect_uri', GITHUB_REDIRECT_URI);
    githubAuthUrl.searchParams.set('scope', 'user:email');
    githubAuthUrl.searchParams.set('state', state);

    res.redirect(githubAuthUrl.toString());
});

// GitHub callback route
router.get('/github/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        return res.redirect(`/login?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
        return res.redirect('/login?error=missing_parameters');
    }

    // Verify state parameter
    const stateData = oauthStates.get(state);
    if (!stateData) {
        return res.redirect('/login?error=invalid_state');
    }

    // Remove used state
    oauthStates.delete(state);

    try {
        // Exchange code for access token
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code: code,
                redirect_uri: GITHUB_REDIRECT_URI
            })
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            throw new Error(tokenData.error_description || tokenData.error);
        }

        // Get user information from GitHub
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'DefendAMinecraft/1.0'
            }
        });

        const userData = await userResponse.json();

        if (!userResponse.ok) {
            throw new Error(userData.message || 'Failed to fetch user data');
        }

        // Get user email (if not public)
        let userEmail = userData.email;
        if (!userEmail) {
            const emailResponse = await fetch('https://api.github.com/user/emails', {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'DefendAMinecraft/1.0'
                }
            });

            const emails = await emailResponse.json();
            const primaryEmail = emails.find(email => email.primary && email.verified);
            userEmail = primaryEmail ? primaryEmail.email : emails[0]?.email;
        }

        // Create user object
        const user = {
            id: userData.id,
            login: userData.login,
            name: userData.name || userData.login,
            email: userEmail,
            avatar_url: userData.avatar_url,
            github_id: userData.id,
            bio: userData.bio,
            company: userData.company,
            location: userData.location,
            public_repos: userData.public_repos,
            followers: userData.followers,
            following: userData.following,
            created_at: new Date().toISOString(),
            github_created_at: userData.created_at
        };

        // Store user in session
        req.session.user = user;
        req.session.isAuthenticated = true;
        req.session.accessToken = tokenData.access_token;

        // Save user to database (create or update)
        try {
            await saveUserToDatabase(user);
            console.log('User saved to database:', user.login);
        } catch (dbError) {
            console.warn('Database save failed, continuing with session only:', dbError.message);
        }

        // Redirect to dashboard or intended page
        const redirectUrl = stateData.redirectUrl || '/dashboard';
        res.redirect(redirectUrl);

    } catch (error) {
        console.error('GitHub OAuth error:', error);
        res.redirect(`/login?error=${encodeURIComponent('Authentication failed: ' + error.message)}`);
    }
});

// Logout route
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.clearCookie('connect.sid'); // Clear session cookie
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Get current user route
router.get('/user', (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({
        success: true,
        user: req.session.user
    });
});

// Get user dashboard data
router.get('/dashboard-data', async (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const userId = req.session.user.id;
        const analytics = await getUserAnalytics(userId);
        const apiKeys = await getUserApiKeys(userId);
        
        res.json({
            success: true,
            data: {
                user: req.session.user,
                analytics: analytics,
                apiKeys: apiKeys,
                stats: {
                    totalVerifications: analytics.totalVerifications,
                    successfulVerifications: analytics.successfulVerifications,
                    blockedAttempts: analytics.blockedAttempts,
                    successRate: analytics.totalVerifications > 0 
                        ? ((analytics.successfulVerifications / analytics.totalVerifications) * 100).toFixed(1)
                        : 0,
                    apiKeysCount: apiKeys.length,
                    websitesCount: analytics.websitesCount
                }
            }
        });
    } catch (error) {
        console.error('Dashboard data error:', error);
        res.status(500).json({ error: 'Failed to load dashboard data' });
    }
});

// Create new API key
router.post('/api-keys', async (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const userId = req.session.user.id;
        const { name, environment, domain } = req.body;
        
        const newApiKey = {
            id: crypto.randomUUID(),
            name: name || 'New API Key',
            key_value: generateApiKey(),
            environment: environment || 'development',
            domain: domain || 'localhost',
            is_active: true,
            usage_count: 0,
            created_at: new Date().toISOString()
        };
        
        const userKeys = userApiKeys.get(userId) || [];
        userKeys.push(newApiKey);
        userApiKeys.set(userId, userKeys);
        
        res.json({
            success: true,
            apiKey: newApiKey
        });
    } catch (error) {
        console.error('API key creation error:', error);
        res.status(500).json({ error: 'Failed to create API key' });
    }
});

// Delete API key
router.delete('/api-keys/:keyId', async (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const userId = req.session.user.id;
        const keyId = req.params.keyId;
        
        const userKeys = userApiKeys.get(userId) || [];
        const updatedKeys = userKeys.filter(key => key.id !== keyId);
        userApiKeys.set(userId, updatedKeys);
        
        res.json({
            success: true,
            message: 'API key deleted successfully'
        });
    } catch (error) {
        console.error('API key deletion error:', error);
        res.status(500).json({ error: 'Failed to delete API key' });
    }
});

// Middleware to check authentication
function requireAuth(req, res, next) {
    if (!req.session.isAuthenticated) {
        return res.redirect('/login');
    }
    next();
}

// Clean up expired OAuth states
function cleanupExpiredStates() {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    for (const [state, data] of oauthStates.entries()) {
        if (now - data.created > fiveMinutes) {
            oauthStates.delete(state);
        }
    }
}

// Export middleware
router.requireAuth = requireAuth;

module.exports = router;
