require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for production deployment (Vercel, etc.)
app.set('trust proxy', true);

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // Use HTTPS in production
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
}));

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'https://defendaminecraft.online'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global variables for all views
app.use((req, res, next) => {
    // Set default title
    res.locals.title = 'DefendAMinecraft';
    // Set current page for active navigation
    res.locals.currentPage = req.path === '/' ? 'home' : req.path.replace(/^\//, '').split('/')[0];
    // Pass user data to all views
    res.locals.user = req.session?.user || null;
    res.locals.isAuthenticated = req.session?.isAuthenticated || false;
    next();
});

// API Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Auth Routes
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

// Routes
app.get('/', (req, res) => {
    res.render('index', { 
        title: 'DefendAMinecraft | Next-Generation reCAPTCHA Service'
    });
});

// Features page
app.get('/features', (req, res) => {
    res.render('pages/features', { 
        title: 'Features | DefendAMinecraft'
    });
});

// Settings page (for navbar customization)
app.get('/settings', (req, res) => {
    res.render('pages/settings', { 
        title: 'Settings | DefendAMinecraft'
    });
});

// API Documentation page
app.get('/docs', (req, res) => {
    res.render('pages/docs', { 
        title: 'API Documentation | DefendAMinecraft'
    });
});

// Live Demo page
app.get('/demo', (req, res) => {
    res.render('pages/demo', { 
        title: 'Live Demo | DefendAMinecraft',
        challenge: generateChallenge()
    });
});

// About page
app.get('/about', (req, res) => {
    res.render('pages/about', { 
        title: 'About | DefendAMinecraft'
    });
});

// Contact page
app.get('/contact', (req, res) => {
    res.render('pages/contact', { 
        title: 'Contact | DefendAMinecraft'
    });
});

// Login page
app.get('/login', (req, res) => {
    res.render('pages/login', { 
        title: 'Sign In | DefendAMinecraft',
        error: req.query.error || null
    });
});

// Signup page
app.get('/signup', (req, res) => {
    res.render('pages/signup', { 
        title: 'Sign Up | DefendAMinecraft',
        error: req.query.error || null
    });
});

// Dashboard page (protected)
app.get('/dashboard', authRoutes.requireAuth, (req, res) => {
    res.render('pages/dashboard', { 
        title: 'Dashboard | DefendAMinecraft',
        user: req.session.user
    });
});

// Integration Guide
app.get('/integration', (req, res) => {
    res.render('pages/integration', { 
        title: 'Integration Guide | DefendAMinecraft'
    });
});

// Service Status
app.get('/status', (req, res) => {
    res.render('pages/status', { 
        title: 'Service Status | DefendAMinecraft'
    });
});

// Privacy Policy
app.get('/privacy', (req, res) => {
    res.render('pages/privacy', { 
        title: 'Privacy Policy | DefendAMinecraft'
    });
});

// Terms of Service
app.get('/terms', (req, res) => {
    res.render('pages/terms', { 
        title: 'Terms of Service | DefendAMinecraft'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('pages/404', {
        title: 'Page Not Found | DefendAMinecraft'
    });
});

app.post('/verify', (req, res) => {
    const { challenge, response } = req.body;
    // In a real implementation, verify the response against the challenge
    const isValid = verifyChallenge(challenge, response);
    
    res.json({ 
        success: isValid,
        message: isValid ? 'Verification successful!' : 'Verification failed. Please try again.'
    });
});

// Challenge generation and verification
function generateChallenge() {
    // Generate a simple challenge (in a real app, this would be more complex)
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    return {
        question: `What is ${a} + ${b}?`,
        answer: (a + b).toString()
    };
}

function verifyChallenge(challenge, response) {
    // In a real implementation, verify the challenge response
    // This is a simplified version
    try {
        const { answer } = JSON.parse(challenge);
        return response === answer;
    } catch (e) {
        return false;
    }
}

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
