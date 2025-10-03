# Authentication Setup Guide

This guide walks through setting up GitHub and Google OAuth for RegIntel.

---

## Quick Start

Choose **one or both** providers to enable:
- **GitHub OAuth** - Best for developer/internal teams (5 minutes)
- **Google OAuth** - Best for broader organizational access (10 minutes)

---

## Option 1: GitHub OAuth Setup

### Step 1: Create GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click **"OAuth Apps"** → **"New OAuth App"**
3. Fill in the form:
   - **Application name**: `RegIntel (Development)`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Click **"Register application"**

### Step 2: Get Credentials

1. You'll see your **Client ID** on the next page
2. Click **"Generate a new client secret"**
3. **Copy both values immediately** (secret is only shown once)

### Step 3: Update Environment Variables

Edit `apps/web/.env.local`:

```env
AUTH_GITHUB_ID="your_github_client_id_here"
AUTH_GITHUB_SECRET="your_github_client_secret_here"
```

### Step 4: Test

```bash
npm run dev
```

Visit http://localhost:3000 and click "Continue with GitHub"

### Optional: Restrict to Organization

To only allow users from your GitHub organization:

1. Edit `apps/web/src/lib/auth.ts`:
```typescript
GitHub({
  clientId: process.env.AUTH_GITHUB_ID,
  clientSecret: process.env.AUTH_GITHUB_SECRET,
  authorization: {
    params: {
      scope: "read:user user:email read:org",
    },
  },
}),
```

2. Add organization check in the `signIn` callback:
```typescript
callbacks: {
  async signIn({ user, account, profile }) {
    if (account?.provider === "github") {
      // Check org membership via GitHub API
      const orgs = await fetch("https://api.github.com/user/orgs", {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
        },
      }).then((res) => res.json());

      const allowedOrg = "your-org-name";
      if (!orgs.some((org: any) => org.login === allowedOrg)) {
        return false; // Access denied
      }
    }
    return true;
  },
  async session({ session, user }) {
    // ... existing code
  },
},
```

---

## Option 2: Google OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to https://console.cloud.google.com/
2. Click **"Select a project"** → **"New Project"**
3. Name: `RegIntel` → Click **"Create"**
4. Wait for project creation (~30 seconds)

### Step 2: Configure OAuth Consent Screen

1. In the sidebar, go to **"APIs & Services"** → **"OAuth consent screen"**
2. Select **"External"** (or "Internal" if using Google Workspace)
3. Fill in required fields:
   - **App name**: `RegIntel`
   - **User support email**: your-email@example.com
   - **Developer contact**: your-email@example.com
4. Click **"Save and Continue"**
5. Skip **"Scopes"** (click Save and Continue)
6. Add test users (your email) if using External
7. Click **"Save and Continue"** → **"Back to Dashboard"**

### Step 3: Create OAuth Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. Application type: **"Web application"**
4. Name: `RegIntel Dev`
5. **Authorized redirect URIs**: Click **"Add URI"**
   - Add: `http://localhost:3000/api/auth/callback/google`
6. Click **"Create"**

### Step 4: Get Credentials

1. A modal will show your **Client ID** and **Client secret**
2. **Copy both values**
3. Click **"OK"**

### Step 5: Update Environment Variables

Edit `apps/web/.env.local`:

```env
AUTH_GOOGLE_ID="your_google_client_id_here.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="your_google_client_secret_here"
```

### Step 6: Test

```bash
npm run dev
```

Visit http://localhost:3000 and click "Continue with Google"

### Optional: Restrict to Google Workspace Domain

To only allow users from your company domain:

Edit `apps/web/src/lib/auth.ts`:

```typescript
Google({
  clientId: process.env.AUTH_GOOGLE_ID,
  clientSecret: process.env.AUTH_GOOGLE_SECRET,
  authorization: {
    params: {
      hd: "yourcompany.com", // Only users from yourcompany.com
    },
  },
}),
```

---

## Production Setup

When deploying to production (e.g., Vercel):

### GitHub OAuth

1. Create a **new** OAuth app (or edit existing):
   - Homepage URL: `https://your-domain.com`
   - Callback URL: `https://your-domain.com/api/auth/callback/github`
2. Add credentials to Vercel environment variables:
   - `AUTH_GITHUB_ID`
   - `AUTH_GITHUB_SECRET`

### Google OAuth

1. In Google Cloud Console, edit your OAuth client:
   - Add authorized redirect URI: `https://your-domain.com/api/auth/callback/google`
2. If using "External" user type, publish your app:
   - Go to **OAuth consent screen** → Click **"Publish App"**
3. Add credentials to Vercel environment variables:
   - `AUTH_GOOGLE_ID`
   - `AUTH_GOOGLE_SECRET`

### Update NextAuth URL

In production environment variables:

```env
NEXTAUTH_URL="https://your-domain.com"
AUTH_SECRET="<generate-new-secret-for-production>"
```

Generate new secret:
```bash
openssl rand -base64 32
```

---

## Creating Your First Admin User

### Method 1: Database Direct Insert (Recommended)

After first sign-in via OAuth:

```bash
npm run db:studio
```

1. Open the **users** table
2. Find your user (just created via OAuth)
3. Click **Edit**
4. Change `role` from `VIEWER` to `ADMIN`
5. Click **Save**
6. Refresh your browser

### Method 2: SQL Query

```bash
psql regintel
```

```sql
-- Find your user ID
SELECT id, email, role FROM users;

-- Update to ADMIN
UPDATE users SET role = 'ADMIN' WHERE email = 'your-email@example.com';

-- Verify
SELECT id, email, role FROM users;
```

---

## Troubleshooting

### "OAuth account not linked" Error

**Cause**: Email already exists with a different provider (e.g., signed in with GitHub, now trying Google)

**Solution**: Sign in with the original provider, or manually link accounts in database

### "Access denied" Error

**Possible causes:**
1. Organization/domain restriction is enabled and you're not a member
2. OAuth app is in development mode and you're not a test user

**Solutions:**
1. Check organization membership
2. Add yourself as a test user in OAuth consent screen
3. Temporarily disable restrictions for testing

### Callback URL Mismatch

**Error**: `redirect_uri_mismatch`

**Solution**: Ensure callback URL in OAuth app matches **exactly**:
- GitHub: `http://localhost:3000/api/auth/callback/github`
- Google: `http://localhost:3000/api/auth/callback/google`

### Database Connection Issues

**Error**: Prisma can't connect to database during auth

**Solution**:
1. Verify `DATABASE_URL` in `apps/web/.env.local`
2. Ensure PostgreSQL is running: `brew services list | grep postgresql`
3. Test connection: `psql regintel -c "SELECT 1"`

---

## Role-Based Access Control (RBAC)

### Roles

- **VIEWER** - Default role for new users
  - Access to published weekly digest
  - Read-only

- **REVIEWER** - Content reviewers
  - All VIEWER permissions
  - Access to `/review` page
  - Can approve/reject source items

- **ADMIN** - Administrators
  - All REVIEWER permissions
  - Access to `/admin` pages
  - User management
  - Source configuration
  - Audit log access

### Assigning Roles

Roles are managed in the database:

```sql
-- Promote user to REVIEWER
UPDATE users SET role = 'REVIEWER' WHERE email = 'reviewer@example.com';

-- Promote user to ADMIN
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

Or via Prisma Studio: `npm run db:studio`

---

## Security Best Practices

### Development

- ✅ Use separate OAuth apps for dev/staging/prod
- ✅ Never commit `.env.local` to git (.gitignore already configured)
- ✅ Rotate secrets if accidentally exposed

### Production

- ✅ Use strong secrets (32+ characters random)
- ✅ Enable HTTPS only (Vercel does this automatically)
- ✅ Set up domain restrictions (Google `hd` param, GitHub org check)
- ✅ Monitor audit logs for suspicious activity
- ✅ Use managed secret storage (Vercel environment variables)

---

## Testing the Flow

### 1. Start the Development Server

```bash
npm run dev
```

### 2. Test Sign-In

1. Visit http://localhost:3000
2. Click **"Sign in"** in the header
3. Choose a provider (GitHub or Google)
4. Authorize the application
5. You should be redirected to the homepage, signed in

### 3. Verify Session

- Your name/email should appear in the header
- Role should show as "VIEWER" initially
- Sign out button should be visible

### 4. Test RBAC

```bash
# Promote yourself to ADMIN
npm run db:studio
# Edit your user role to ADMIN
```

Refresh the page - you should now see:
- "Review" link in navigation (REVIEWER + ADMIN)
- "Admin" link in navigation (ADMIN only)

---

## Next Steps

After authentication is working:

1. **Customize sign-in page** - Add company branding to `apps/web/src/app/auth/signin/page.tsx`
2. **Set up email notifications** - Configure SMTP for audit trail alerts
3. **Add more providers** - Microsoft/Azure AD for enterprise SSO
4. **Implement invite system** - Auto-assign roles based on email domain

---

## Additional Resources

- [NextAuth.js Documentation](https://authjs.dev)
- [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Prisma Adapter](https://authjs.dev/reference/adapter/prisma)
