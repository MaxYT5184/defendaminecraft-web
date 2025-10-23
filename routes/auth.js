const express = require('express');
const crypto = require('crypto');
const router = express.Router();

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

        // Create user session
        const user = {
            id: userData.id,
            login: userData.login,
            name: userData.name || userData.login,
            email: userEmail,
            avatar_url: userData.avatar_url,
            github_id: userData.id,
            created_at: new Date().toISOString()
        };

        // Store user in session
        req.session.user = user;
        req.session.isAuthenticated = true;
        req.session.accessToken = tokenData.access_token;

        // In production, you would save this to your database
        console.log('User authenticated:', {
            id: user.id,
            login: user.login,
            email: user.email
        });

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
