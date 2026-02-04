# Chat Feature Troubleshooting Guide

## Error: "Error sending message: Failed to send message"

### Root Causes & Solutions

#### 1. **Chat Messages Table Not Created**

**Symptom:** Messages don't send at all, error appears immediately

**Solution:**

1. Go to your Supabase dashboard
2. Click on "SQL Editor" in the sidebar
3. Create a new query
4. Paste the SQL from `supabase_migrations/create_chat_messages_table.sql`
5. Click "Run"
6. Verify no errors appear

#### 2. **User Not Authorized (403 Error)**

**Symptom:** "Not authorized to chat on this document" in error logs

**Possible Causes:**

- User sending message is neither the document admin nor a recipient
- Email addresses don't match exactly (case sensitivity issue)

**Solution:**

1. Verify the user is in the recipients list for the document
2. Check that the email addresses match exactly (including case)
3. If admin: ensure the document's `admin_id` matches the authenticated user's ID

**Debug:**

- Check browser console for detailed error message
- Check Supabase logs for validation errors

#### 3. **Document Not Found (404 Error)**

**Symptom:** "Document not found" error

**Solution:**

1. Verify the document ID is correct
2. Check that the document exists in Supabase
3. Ensure you're accessing a valid document ID

#### 4. **Storage Bucket Not Found**

**Symptom:** File uploads fail, even without sending the message

**Solution:**

1. Go to Supabase Storage
2. Check if "documents" bucket exists
3. If not, create it:
   - Click "New Bucket"
   - Name: `documents`
   - Make Public: YES
   - Click "Create Bucket"

#### 5. **RLS Policies Not Set**

**Symptom:** Permission denied errors when trying to fetch messages

**Solution:**

1. Go to Supabase SQL Editor
2. Run the RLS policy creation commands from the migration file
3. Verify policies appear in Table Editor → chat_messages → RLS Policies

### Common Error Messages & Meanings

| Error                     | Cause                         | Fix                         |
| ------------------------- | ----------------------------- | --------------------------- |
| "Invalid documentId"      | Bad document ID format        | Use valid UUID              |
| "Missing required fields" | Empty message, email, or name | Check input validation      |
| "Document not found"      | Document doesn't exist        | Verify document ID          |
| "Not authorized to chat"  | User not admin or recipient   | Add user as recipient       |
| "Failed to send message"  | Database error                | Check RLS policies          |
| "File upload failed"      | Storage issue                 | Check storage bucket exists |

## Verification Checklist

Before testing, verify:

- [ ] `chat_messages` table exists in Supabase
- [ ] Table has all required columns: id, document_id, sender_email, sender_name, message, attachment_url, attachment_name, created_at
- [ ] RLS is enabled on the table
- [ ] All 3 RLS policies are created (read, insert, delete)
- [ ] "documents" storage bucket exists and is public
- [ ] Document status is "completed"
- [ ] User sending message is document admin or recipient
- [ ] Email addresses match exactly (case-sensitive)

## Testing Steps

1. **Create a Test Document**
   - Go to Dashboard
   - Create a new document
   - Add yourself as a recipient

2. **Send to Recipient**
   - Click "Send to Recipients"
   - Choose "Send via Email"

3. **Sign the Document**
   - Open the signing link in another browser/window
   - Sign as the recipient
   - Document status should change to "completed"

4. **Test Chat**
   - Go back to the edit page
   - Scroll to the right sidebar
   - You should see a "Discussion" section
   - Type a test message
   - Click "Send"

5. **Verify Message**
   - Message should appear in chat
   - Try uploading a file
   - Verify file link works

## Enable Debug Logging

To see detailed error messages:

1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Look for messages starting with "Error in /api/chat-messages:"
4. These show the actual database errors

## Server-Side Debugging

Check Next.js server logs:

1. Look at terminal where you ran `npm run dev`
2. Search for "Error in /api/chat-messages:"
3. The error message shows what's failing in the API

## Common Scenarios

### Scenario 1: Document is Completed but Chat Doesn't Appear

- Verify `document.status === "completed"`
- Clear browser cache (Ctrl+F5)
- Check browser console for errors
- Verify document has at least 1 recipient

### Scenario 2: Message Sends but Doesn't Appear

- Check Supabase table directly: `SELECT * FROM chat_messages;`
- Verify message was inserted
- Check `created_at` timestamp
- Wait 3 seconds for auto-refresh

### Scenario 3: Can't Upload File

- Verify file size is reasonable (< 100MB)
- Check file format is supported (PDF, DOC, DOCX, TXT, JPG, PNG)
- Verify "documents" bucket exists and is public
- Check browser console for upload errors

### Scenario 4: Other Users Can't See Messages

- Verify they're recipients of the document
- Check email addresses match exactly
- Ensure document status is "completed"
- Check RLS policies include their email

## Getting Help

If you encounter issues:

1. **Check the logs:**
   - Browser console (F12)
   - Next.js server terminal
   - Supabase logs

2. **Verify prerequisites:**
   - Use checklist above
   - Ensure all tables and policies exist

3. **Try a clean test:**
   - Create new document
   - Add recipient
   - Send and sign
   - Test chat

4. **Check Supabase directly:**
   - Go to Table Editor
   - Verify `chat_messages` table exists
   - Check a few test messages were inserted
   - Verify RLS policies in Policy Editor
