# 🚀 START HERE - eHandShake Setup Guide

Welcome! Your complete eSignature platform is ready. Follow these steps to get it running.

## ⏱️ Total Time: ~15 minutes

## Step 1: Create Supabase Account (2 minutes)

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub or email
4. Create a new project
5. Choose a region close to you
6. Wait for the project to be created

## Step 2: Get Your API Keys (2 minutes)

1. In Supabase dashboard, go to **Settings** (gear icon)
2. Click **API** in left sidebar
3. You'll see:
   - `Project URL` → Copy to `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → Copy to `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Scroll down for `service_role` secret → Copy to `SUPABASE_SERVICE_ROLE_KEY`

## Step 3: Update Environment Variables (2 minutes)

Open `.env.local` in the project root and update:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

*Replace the values with your actual Supabase credentials*

## Step 4: Setup Database (3 minutes)

1. In Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New Query"** button
3. Open this file: `lib/schema.sql`
4. Copy ALL the content
5. Paste it into the SQL editor in Supabase
6. Click **"Run"** button
7. Wait for it to complete ✓

This creates:
- 5 database tables
- All necessary indexes
- Row-Level Security policies
- All relationships

## Step 5: Run Locally (1 minute)

```bash
cd /Users/wakassharif/Projects/ehandshake
npm run dev
```

The server will start. Open your browser:
```
http://localhost:3000
```

You should be redirected to login page ✓

## Step 6: Create Your First Account (2 minutes)

1. Click "Sign up"
2. Fill in:
   - Full Name: Your name
   - Company Name: Your company
   - Email: any email
   - Password: any password
3. Click "Create account"
4. You'll be redirected to login
5. Sign in with your credentials ✓

## Step 7: Test the Platform (3 minutes)

### Create a Document
1. Click "Create Document"
2. Title: "Test Agreement"
3. Content: Paste some text
4. Click "Create Document"

### Add a Recipient
1. On the right, click "+ Add"
2. Email: Use your own email
3. Role: Select "Signer"
4. Click "Add Recipient"

### Send the Document
1. Click "Send to Recipients"
2. Confirm the action
3. Check the terminal (npm run dev) for the signing link

### Sign the Document
1. Copy the signing link from terminal
2. Open in new browser tab
3. Review the document
4. Enter your name for signature
5. Choose a font style
6. Click "Sign Document"
7. You'll see "Thank you!" page ✓

### View Results
1. Go back to dashboard
2. Click "View" on the document
3. You'll see:
   - Your signature
   - Recipient status
   - Complete audit log ✓

## ✅ You Did It!

Your eHandShake platform is working! 🎉

## 📚 Next Steps

### Learn More
- Read [README.md](README.md) for overview
- Check [QUICKSTART.md](QUICKSTART.md) for quick reference
- See [IMPLEMENTATION.md](IMPLEMENTATION.md) for technical details

### Configure Email (Optional)
Currently emails just log to console. To send real emails:

1. Sign up at https://resend.com (free tier)
2. Get your API key
3. Add to `.env.local`:
   ```env
   RESEND_API_KEY=re_your_key_here
   SENDER_EMAIL=noreply@yourdomain.com
   ```
4. Edit `pages/api/send-signing-links.ts`
5. Uncomment the Resend fetch code

### Deploy to Production
1. Push code to GitHub
2. Connect to Vercel
3. Add environment variables
4. Deploy in 2 minutes!

## 🆘 Troubleshooting

### "Supabase URL is required"
- Check `.env.local` has the correct `NEXT_PUBLIC_SUPABASE_URL`
- Make sure you copied it correctly from Supabase Settings

### "Can't sign up"
- Check email format (must be valid email)
- Password must be at least 6 characters
- Check Supabase is running (test in browser developer tools)

### "Documents not showing"
- Make sure you executed the `lib/schema.sql` in Supabase SQL Editor
- Tables weren't created if SQL didn't run successfully

### "Signing link doesn't work"
- Make sure `NEXT_PUBLIC_APP_URL=http://localhost:3000` in `.env.local`
- The signing link should be: `http://localhost:3000/sign/[document-id]?email=...`

### "Emails not sending"
- That's normal! Currently they just log to console
- Configure email service (see Optional steps above)

## 📖 Documentation Files

| File | Purpose |
|------|---------|
| START_HERE.md | This file - setup guide |
| README.md | Project overview |
| QUICKSTART.md | Quick reference |
| SETUP.md | Detailed setup |
| IMPLEMENTATION.md | Technical guide |
| PROJECT_SUMMARY.md | Executive summary |
| FILE_LIST.md | All files created |
| BUILD_COMPLETE.md | Build verification |

## 🎯 Key Features Available Now

✅ Create documents from scratch
✅ Use templates
✅ Add multiple recipients
✅ Assign roles (Signer/Viewer)
✅ Sign with typed text
✅ Choose signature fonts
✅ Track all activity
✅ Download PDFs
✅ Complete audit trail

## 💡 Pro Tips

1. **Test with multiple recipients** - Add different emails to test the workflow
2. **Use your email twice** - Add yourself as both recipient and admin to test fully
3. **Check browser console** - Press F12, go to Console tab for debugging
4. **Watch terminal logs** - npm run dev terminal shows all backend activity
5. **Inspect the code** - All TypeScript, well-commented, easy to understand

## 🚀 You're All Set!

Your eHandShake platform is:
✅ Built
✅ Tested
✅ Running
✅ Ready to use

**Time to start signing documents! 📝**

---

**Questions?** Check the documentation files.
**Need help?** Review the troubleshooting section above.
**Ready to deploy?** Follow the deployment guide in IMPLEMENTATION.md

Built with ❤️ using Next.js, React, TypeScript, and Supabase
