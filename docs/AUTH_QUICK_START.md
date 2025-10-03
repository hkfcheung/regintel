# Auth Quick Start

## 🚀 5-Minute Setup (GitHub OAuth)

### 1. Create OAuth App
https://github.com/settings/developers → New OAuth App

```
Name: RegIntel Dev
Homepage: http://localhost:3000
Callback: http://localhost:3000/api/auth/callback/github
```

### 2. Add Credentials

Edit `apps/web/.env.local`:
```env
AUTH_GITHUB_ID="Ov23li9DpAczoFGtMw5N"
AUTH_GITHUB_SECRET="2c0fea0700994c5a4dc48ba8af84b2ef09bb08e6"
```

### 3. Start & Test
```bash
npm run dev
# Visit: http://localhost:3000
# Click: Continue with GitHub
```

### 4. Make Yourself Admin
```bash
npm run db:studio
# Edit users table → Change role to ADMIN
```

---

## Google OAuth (Alternative)

### 1. Create Project
https://console.cloud.google.com/ → New Project → "RegIntel"

### 2. OAuth Consent
APIs & Services → OAuth consent screen → External → Fill form

### 3. Create Credentials
Create Credentials → OAuth client ID → Web application
```
Callback: http://localhost:3000/api/auth/callback/google
```

### 4. Add Credentials
Edit `apps/web/.env.local`:
```env
AUTH_GOOGLE_ID="your_id.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="your_secret"
```

---

## Troubleshooting

**"Callback URL mismatch"**
→ Check OAuth app settings match exactly

**"Access denied"**
→ Add yourself as test user in OAuth consent screen

**Database error**
→ Check `DATABASE_URL` in `.env.local`

---

Full guide: `docs/AUTH_SETUP.md`
