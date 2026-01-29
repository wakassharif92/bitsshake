# eHandShake - Internal eSignature Platform

A complete eSignature solution for internal company usage, built with Next.js, TypeScript, and Supabase.

## Features

✅ **User Management**

- Admin signup and login
- Role-based access control
- User profile management

✅ **Document Management**

- Create documents from scratch or use templates
- Edit documents before sending
- Support for pasting content from Google Docs or Microsoft Word
- Draft, sent, signed, and completed status tracking

✅ **Templates**

- Create and manage document templates
- Reuse templates for recurring documents
- Easy template selection when creating documents

✅ **Recipients & Roles**

- Add multiple recipients to a document
- Assign roles: Signer or Viewer
- Track recipient status (pending, signed, viewed)

✅ **Signature Capture**

- Typed signatures with multiple font styles (Cursive, Script, Formal)
- Draw signature support (coming soon)
- Automatic IP address and user agent logging

✅ **Document Sending**

- Send documents to recipients with signing links via email
- Lock documents once sent (no editing allowed)
- Automatic status updates when all signers complete

✅ **Audit Trail**

- Complete activity logging
- Track all actions with timestamps
- Log IP addresses and user agents for compliance

✅ **PDF Generation**

- Download completed documents as PDF
- Includes signatures and audit trail
- Professional formatting

## Tech Stack

- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **PDF Generation**: jsPDF
- **Email**: Supabase Auth (configurable with Resend, SendGrid, etc.)

## Prerequisites

- Node.js 20+
- npm or yarn
- Supabase account (free tier available)

## Getting Started

### 1. Clone and Install

```bash
cd /Users/wakassharif/Projects/ehandshake
npm install
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to Settings > API to get your credentials:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### 3. Configure Environment Variables

Update `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Set Up Database

1. In Supabase dashboard, go to SQL Editor
2. Copy the entire content of `lib/schema.sql`
3. Paste and execute the SQL to create all tables and policies

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and you'll be redirected to login.

## Project Structure

```
pages/
├── index.tsx                 # Home (redirects to login/dashboard)
├── login.tsx                 # Login page
├── signup.tsx                # Signup page
├── dashboard.tsx             # Admin dashboard
├── templates.tsx             # Template management
├── documents/
│   ├── create.tsx           # Create document
│   └── [id]/
│       ├── edit.tsx         # Edit document
│       └── view.tsx         # View signed document
├── sign/
│   └── [id].tsx             # Signature page for recipients
├── thank-you.tsx            # Thank you after signing
└── api/
    ├── send-signing-links.ts # Email sending
    └── generate-pdf.ts       # PDF generation

lib/
├── supabase.ts              # Supabase client setup
├── types.ts                 # TypeScript interfaces
├── schema.sql               # Database schema
├── email.ts                 # Email utilities
└── pdf.ts                   # PDF generation utilities
```

## Usage

### Admin Workflow

1. **Sign Up**: Create an admin account
2. **Create Document**:
   - Go to Dashboard → "Create Document"
   - Enter title and content
   - Optionally load from a template
3. **Add Recipients**:
   - Click "Add Recipient" on the right panel
   - Enter email address
   - Choose role: Signer or Viewer
4. **Send Document**:
   - Click "Send to Recipients"
   - Signing links will be emailed to recipients
   - Document becomes locked (read-only)
5. **View Results**:
   - Go back to Dashboard
   - Click "View" on the sent document
   - See recipient status, signatures, and audit trail

### Recipient Workflow

1. **Receive Email**: Check inbox for signing link
2. **Open Document**: Click the signing link
3. **Review**: Read the document content
4. **Sign**:
   - Choose signature type (Typed or Draw)
   - If typed: Enter name and select font style
   - Preview signature before submitting
5. **Submit**: Click "Sign Document"
6. **Confirmation**: Redirected to thank you page

## API Endpoints

### POST `/api/send-signing-links`

Sends signing links to all recipients of a document.

**Request:**

```json
{
  "documentId": "uuid"
}
```

### POST `/api/generate-pdf`

Generates a PDF with document content, signatures, and audit trail.

**Request:**

```json
{
  "documentId": "uuid"
}
```

## Email Configuration

Currently, emails are logged to console. To enable actual email sending:

### Option 1: Supabase Email

Configure in Supabase Settings > Auth

### Option 2: Resend

1. Sign up at [resend.com](https://resend.com)
2. Add to `.env.local`:
   ```env
   RESEND_API_KEY=your_key
   SENDER_EMAIL=noreply@yourdomain.com
   ```
3. Uncomment the Resend code in `pages/api/send-signing-links.ts`

### Option 3: SendGrid, Mailgun, etc.

Similar setup with their respective API keys

## Security Features

- ✅ Row-level security (RLS) policies in Supabase
- ✅ User isolation (admins only see their own documents)
- ✅ IP address logging for audits
- ✅ User agent logging for device tracking
- ✅ Recipient verification via email
- ✅ Document locking after sending

## Roadmap / Future Enhancements

- [ ] Draw signature with canvas
- [ ] Multi-party signing with sequential/parallel workflows
- [ ] Document templates with signature fields
- [ ] Bulk document uploading
- [ ] Advanced PDF generation with signature placement
- [ ] SMS/Two-factor authentication
- [ ] Document expiration and reminders
- [ ] Analytics and reporting dashboard
- [ ] Mobile app support
- [ ] SAML/SSO integration

## Troubleshooting

### "Supabase URL is required"

Make sure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` set correctly.

### "User creation failed"

Check that the `users` table has the correct RLS policies. Re-run the schema SQL.

### "Email not sending"

Email sending is currently logged to console. Configure your email service in `pages/api/send-signing-links.ts`.

### "PDF download not working"

Make sure jsPDF is installed: `npm install jspdf`

## Support & Contact

For issues or questions about this internal tool, contact the development team.

## License

Internal use only - Not for redistribution
