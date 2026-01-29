# eHandShake - Quick Start Guide

## 🚀 Get Running in 5 Minutes

### Step 1: Set Up Supabase (2 minutes)

1. Go to [supabase.com](https://supabase.com) → Sign in
2. Create new project
3. Go to **Settings > API**
4. Copy these 3 values to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 2: Set Up Database (2 minutes)

1. In Supabase, go to **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Open file: `lib/schema.sql`
4. Copy all content and paste into SQL Editor
5. Click **"Run"**

Done! All tables are created.

### Step 3: Start Developing (1 minute)

```bash
npm run dev
```

Go to http://localhost:3000 → You'll be redirected to login

## 📝 First Time User - Full Walkthrough

### Create Admin Account

1. Click **"Sign up"**
2. Enter details:
   - Full Name: Your name
   - Company Name: Your company
   - Email: your@email.com
   - Password: any password
3. Click **"Create account"** → Sign in

### Create & Send Document

**Step 1: Create Document**

- Click **"Create Document"**
- Title: `Service Agreement`
- Content: Paste your document text
- Click **"Create Document"**

**Step 2: Add Recipients**

- On the right panel, click **"+ Add"**
- Email: `client@company.com`
- Role: **Signer**
- Click **"Add Recipient"**

**Step 3: Send**

- Click **"Send to Recipients"**
- Confirm
- (In production, email will be sent - currently logs to console)

### Sign Document (As Recipient)

1. Copy the signing link from console output
2. Open in new tab
3. Review document
4. Enter your name in signature box
5. Choose font style
6. Click **"Sign Document"**
7. Done! ✓

## 🎯 Main Features

| Feature              | How To                                      |
| -------------------- | ------------------------------------------- |
| **Create Doc**       | Dashboard → Create Document                 |
| **Use Template**     | While creating, select template in dropdown |
| **Manage Templates** | Dashboard → Manage Templates                |
| **View Progress**    | Dashboard → Click "View" on document        |
| **Download PDF**     | View document → Download PDF button         |

## 🔗 Important URLs (When Running Locally)

- Dashboard: `http://localhost:3000/dashboard`
- Create Doc: `http://localhost:3000/documents/create`
- Templates: `http://localhost:3000/templates`
- Sign (replace IDs): `http://localhost:3000/sign/[doc-id]?email=[recipient-email]`

## ⚙️ Configuration

### Email Service (Optional)

Currently emails log to console. To send real emails:

**Option A: Resend (Recommended)**

```env
RESEND_API_KEY=your_key_here
SENDER_EMAIL=noreply@yourdomain.com
```

**Option B: SendGrid**

```env
SENDGRID_API_KEY=your_key_here
SENDER_EMAIL=noreply@yourdomain.com
```

Then update: `pages/api/send-signing-links.ts`

## 🐛 Common Issues

| Issue                  | Solution                                   |
| ---------------------- | ------------------------------------------ |
| Blank page on load     | Clear cookies, try incognito mode          |
| Can't sign up          | Check email format, try different password |
| Supabase errors        | Verify `.env.local` has correct URLs       |
| Database table missing | Re-run the `schema.sql` in SQL Editor      |
| Email not sending      | Configure email service (see above)        |

## 📊 Database Tables

- **users** - Admin accounts
- **documents** - Created documents
- **recipients** - People receiving documents
- **templates** - Saved templates
- **audit_logs** - Complete activity history

## 🔐 Security

- Each admin only sees their own documents
- Recipients get secure email links
- All actions are logged with IP addresses
- Documents lock after sending (can't edit)

## 🚢 Ready to Deploy?

When deploying to production:

1. Update `NEXT_PUBLIC_APP_URL` in `.env` to your domain
2. Set up email service (Resend/SendGrid)
3. Update Supabase URL to production project
4. Enable email domain verification
5. Consider adding custom email templates
6. Set up SSL certificate

---

**Questions?** Check `SETUP.md` for detailed documentation.
