# 🚀 Vercel Deployment Guide for DefendAMinecraft

## 📋 Prerequisites

1. **Vercel Account**: Sign up at https://vercel.com
2. **GitHub Account**: Your code repository
3. **Domain**: Your custom domain ready
4. **GitHub OAuth App**: Set up for production URLs

## 🔧 Step 1: Prepare Your Repository

### Option A: Public Repository (Recommended)
```bash
# Initialize git repository
git init
git add .
git commit -m "Initial commit: DefendAMinecraft reCAPTCHA service"

# Create GitHub repository and push
# Go to https://github.com/new
# Create repository named: defendaminecraft-recaptcha
git remote add origin https://github.com/YOUR_USERNAME/defendaminecraft-recaptcha.git
git branch -M main
git push -u origin main
```

### Option B: Private Repository
- Same steps as above, but check "Private" when creating the GitHub repo
- Vercel works with both public and private repos

## 🌐 Step 2: Deploy to Vercel

### Method 1: Vercel Dashboard (Easiest)
1. Go to https://vercel.com/dashboard
2. Click "New Project"
3. Import your GitHub repository
4. Vercel will auto-detect it's a Node.js project
5. Click "Deploy"

### Method 2: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from project directory
vercel

# Follow the prompts:
# ? Set up and deploy? Yes
# ? Which scope? Your account
# ? Link to existing project? No
# ? What's your project's name? defendaminecraft
# ? In which directory is your code located? ./
```

## 🔗 Step 3: Configure Custom Domain

1. **In Vercel Dashboard:**
   - Go to your project → Settings → Domains
   - Add your custom domain: `defendaminecraft.online`
   - Add www subdomain: `www.defendaminecraft.online`

2. **DNS Configuration:**
   - Add these DNS records to your domain provider:
   ```
   Type: A
   Name: @
   Value: 76.76.19.19

   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

## 🔐 Step 4: Environment Variables

In Vercel Dashboard → Project → Settings → Environment Variables, add:

```bash
# GitHub OAuth (Update with production URLs)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=https://defendaminecraft.online/auth/github/callback

# Session Security
SESSION_SECRET=your_super_secret_random_string_here

# API Configuration
API_BASE_URL=https://defendaminecraft.online
NODE_ENV=production

# Optional: Database (when you set up Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
```

## 🔧 Step 5: Update GitHub OAuth App

1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Edit your OAuth app:
   - **Homepage URL**: `https://defendaminecraft.online`
   - **Authorization callback URL**: `https://defendaminecraft.online/auth/github/callback`

## 📦 Step 6: Update Package URLs

Update your npm package and CDN URLs to use your domain:

```javascript
// In your documentation, update:
const API_BASE_URL = 'https://defendaminecraft.online';

// CDN URL becomes:
<script src="https://defendaminecraft.online/js/recaptcha-cdn.js"></script>
```

## 🚀 Step 7: Test Deployment

1. **Visit your site**: https://defendaminecraft.online
2. **Test GitHub login**: https://defendaminecraft.online/login
3. **Test API endpoints**:
   ```bash
   curl -X POST https://defendaminecraft.online/api/v1/challenge \
     -H "Content-Type: application/json" \
     -H "X-API-Key: da_live_demo123456789abcdef" \
     -d '{"type": "checkbox"}'
   ```

## 🔄 Step 8: Auto-Deployment

Vercel automatically deploys when you push to your main branch:

```bash
# Make changes to your code
git add .
git commit -m "Update: Added new feature"
git push origin main

# Vercel will automatically deploy the changes
```

## 📊 Step 9: Monitor & Analytics

- **Vercel Analytics**: Automatically enabled
- **Function Logs**: Available in Vercel dashboard
- **Performance**: Monitor in Vercel dashboard

## 🛠️ Troubleshooting

### Common Issues:

**Build Failures:**
- Check build logs in Vercel dashboard
- Ensure all dependencies are in package.json
- Verify Node.js version compatibility

**Environment Variables:**
- Double-check all environment variables are set
- Redeploy after adding new environment variables

**Domain Issues:**
- DNS propagation can take up to 48 hours
- Use DNS checker tools to verify records

**GitHub OAuth:**
- Ensure callback URL matches exactly
- Check that environment variables are correct

## 🎯 Final Checklist

- ✅ Repository pushed to GitHub
- ✅ Deployed to Vercel
- ✅ Custom domain configured
- ✅ Environment variables set
- ✅ GitHub OAuth app updated
- ✅ SSL certificate active (automatic)
- ✅ All pages loading correctly
- ✅ API endpoints working
- ✅ GitHub login functional

## 🚀 You're Live!

Your DefendAMinecraft reCAPTCHA service is now live at:
- **Main Site**: https://defendaminecraft.online
- **API Base**: https://defendaminecraft.online/api/v1/
- **CDN Library**: https://defendaminecraft.online/js/recaptcha-cdn.js

## 📈 Next Steps

1. **Publish NPM Package** with correct API URLs
2. **Set up Supabase** for production database
3. **Add monitoring** and error tracking
4. **Create documentation** site
5. **Set up CI/CD** for automated testing
