# GitHub OAuth Setup Guide

Follow these steps to set up GitHub authentication for DefendAMinecraft.

## 1. Create GitHub OAuth App

1. Go to your GitHub account settings: https://github.com/settings/developers
2. Click "OAuth Apps" in the left sidebar
3. Click "New OAuth App"
4. Fill in the application details:

### Application Details
```
Application name: DefendAMinecraft
Homepage URL: http://localhost:3000
Application description: Advanced reCAPTCHA service for bot protection
Authorization callback URL: http://localhost:3000/auth/github/callback
```

### For Production
```
Homepage URL: https://your-domain.com
Authorization callback URL: https://your-domain.com/auth/github/callback
```

## 2. Get Your Credentials

After creating the app, you'll see:
- **Client ID**: Copy this value
- **Client Secret**: Click "Generate a new client secret" and copy it

## 3. Configure Environment Variables

Create a `.env` file in your project root (copy from `.env.example`):

```bash
# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
GITHUB_REDIRECT_URI=http://localhost:3000/auth/github/callback

# Other required variables
SESSION_SECRET=your_random_session_secret_here
```

## 4. Test the Setup

1. Start your server: `npm start`
2. Go to: http://localhost:3000/login
3. Click "Continue with GitHub"
4. You should be redirected to GitHub for authorization
5. After accepting, you'll be redirected back to your dashboard

## 5. Production Setup

For production deployment:

1. Update your GitHub OAuth app settings:
   - Homepage URL: `https://your-domain.com`
   - Callback URL: `https://your-domain.com/auth/github/callback`

2. Update your environment variables:
   ```bash
   GITHUB_REDIRECT_URI=https://your-domain.com/auth/github/callback
   ```

## 6. Security Notes

- ✅ Keep your Client Secret secure and never commit it to version control
- ✅ Use HTTPS in production
- ✅ Set secure session cookies in production
- ✅ Consider implementing rate limiting for auth endpoints
- ✅ Add CSRF protection for additional security

## 7. Troubleshooting

### Common Issues:

**"Application not found" error:**
- Check that your Client ID is correct
- Ensure the OAuth app exists in your GitHub account

**"Redirect URI mismatch" error:**
- Verify the callback URL in your GitHub app matches your environment variable
- Check for typos in the URL

**"Invalid client" error:**
- Verify your Client Secret is correct
- Make sure you're using the right credentials for the right environment

**Session issues:**
- Ensure SESSION_SECRET is set
- Check that cookies are being set properly
- Verify session middleware is configured correctly

## 8. Testing Locally

You can test the OAuth flow locally:

1. Make sure your `.env` file has the correct values
2. Start the server: `npm run dev`
3. Visit: http://localhost:3000/login
4. Click the GitHub login button
5. Complete the OAuth flow

The user data will be logged to the console and stored in the session.
