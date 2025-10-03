# ✅ Authentication Configured

Authentication providers have been configured for RegIntel. Follow the steps below to enable sign-in.

---

## 📋 What Was Set Up

✅ **NextAuth.js v5** with Prisma adapter
✅ **GitHub OAuth** provider (ready to configure)
✅ **Google OAuth** provider (ready to configure)
✅ **Sign-in page** at `/auth/signin`
✅ **Header component** with user session display
✅ **RBAC middleware** (VIEWER, REVIEWER, ADMIN roles)
✅ **Helper script** to promote users to admin

---

## 🚀 Next Steps (Choose One)

### Option A: GitHub OAuth (Fastest - 5 minutes)

1. **Create OAuth App**: https://github.com/settings/developers
   - Click "New OAuth App"
   - Name: `RegIntel Dev`
   - Homepage: `http://localhost:3000`
   - Callback: `http://localhost:3000/api/auth/callback/github`
   - Click "Register application"

2. **Get Credentials**:
   - Copy the **Client ID**
   - Click "Generate a new client secret" and copy it

3. **Update Environment**:

   Edit `apps/web/.env.local`:
   ```env
   AUTH_GITHUB_ID="your_github_client_id"
   AUTH_GITHUB_SECRET="your_github_client_secret"
   ```

4. **Start & Test**:
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000 → Click "Sign in" → "Continue with GitHub"

5. **Make Yourself Admin**:
   ```bash
   ./scripts/make-admin.sh your-github-email@example.com
   ```

---

### Option B: Google OAuth (10 minutes)

1. **Create Google Cloud Project**:
   - Go to https://console.cloud.google.com/
   - New Project → Name: "RegIntel"

2. **Configure OAuth Consent**:
   - APIs & Services → OAuth consent screen
   - External → Fill required fields

3. **Create Credentials**:
   - APIs & Services → Credentials
   - Create Credentials → OAuth client ID
   - Web application
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

4. **Update Environment**:

   Edit `apps/web/.env.local`:
   ```env
   AUTH_GOOGLE_ID="your_id.apps.googleusercontent.com"
   AUTH_GOOGLE_SECRET="your_secret"
   ```

5. **Start & Test**:
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000 → Click "Sign in" → "Continue with Google"

6. **Make Yourself Admin**:
   ```bash
   ./scripts/make-admin.sh your-google-email@example.com
   ```

---

## 📚 Documentation

- **Quick Start**: `docs/AUTH_QUICK_START.md`
- **Full Guide**: `docs/AUTH_SETUP.md` (includes production setup, domain restrictions, troubleshooting)
- **Main README**: `README.md` (updated with auth section)

---

## 🧪 Testing Authentication

After setup, test the flow:

1. **Start dev server**: `npm run dev`
2. **Visit**: http://localhost:3000
3. **Click "Sign in"** in the header
4. **Choose provider** (GitHub or Google)
5. **Authorize** the application
6. **Verify**: Your name/email appears in header with "VIEWER" role

7. **Promote to admin**:
   ```bash
   ./scripts/make-admin.sh your-email@example.com
   ```

8. **Refresh browser**: You should now see:
   - "Review" link (for REVIEWER + ADMIN)
   - "Admin" link (for ADMIN only)

---

## 🔒 Security Notes

- ✅ Separate OAuth apps should be created for production
- ✅ `.env.local` is in `.gitignore` (never commit secrets)
- ✅ Production secrets should be 32+ random characters
- ✅ Consider enabling domain/organization restrictions (see full guide)

---

## 🛠️ Troubleshooting

**"Callback URL mismatch"**
→ Ensure callback URL in OAuth app matches exactly

**"Access denied"**
→ Add yourself as test user in OAuth consent screen (Google)
→ Check organization membership (if restricted)

**Database connection error**
→ Verify `DATABASE_URL` in `apps/web/.env.local`
→ Ensure PostgreSQL is running: `brew services list`

**Provider not showing on sign-in page**
→ Check that environment variables are set (not empty strings)
→ Restart dev server after changing `.env.local`

---

## ✨ What's Next

With authentication working, you can now:

1. **Build the review workflow** (`/review` page)
2. **Implement the ingest pipeline** (fetch FDA sources)
3. **Add LLM summarization** (OpenAI/Anthropic integration)
4. **Create weekly digest generator**
5. **Deploy to production** (Vercel + update OAuth apps)

---

**Need help?** See full documentation in `docs/AUTH_SETUP.md`
