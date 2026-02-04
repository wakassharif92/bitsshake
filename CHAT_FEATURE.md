# Chat Feature Implementation

This document explains the chat feature that allows signers and viewers to communicate on completed documents.

## Overview

When a document status is **"completed"**, a chat panel appears on the right side of the document view, allowing:

- Document creator (admin) to chat with signers/viewers
- Signers and viewers to chat with each other and the admin
- File attachments (PDF, DOC, DOCX, TXT, JPG, PNG)
- Real-time message updates (every 3 seconds)

## Setup Instructions

### 1. Create the Database Table

Run the following SQL in your Supabase SQL Editor:

```sql
-- Create chat_messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  sender_email TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  attachment_url TEXT,
  attachment_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on document_id for faster queries
CREATE INDEX idx_chat_messages_document_id ON chat_messages(document_id);

-- Create index on created_at for sorting
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow recipients to read chat messages for their documents
CREATE POLICY "recipients_can_read_chat_messages" ON chat_messages
  FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM documents
      WHERE admin_id = auth.uid()
    )
    OR
    document_id IN (
      SELECT document_id FROM recipients
      WHERE email = auth.jwt() ->> 'email'
    )
  );

-- RLS Policy: Allow recipients to insert chat messages
CREATE POLICY "recipients_can_insert_chat_messages" ON chat_messages
  FOR INSERT
  WITH CHECK (
    document_id IN (
      SELECT id FROM documents
      WHERE admin_id = auth.uid()
    )
    OR
    document_id IN (
      SELECT document_id FROM recipients
      WHERE email = auth.jwt() ->> 'email'
    )
  );

-- RLS Policy: Admin can delete messages
CREATE POLICY "admin_can_delete_chat_messages" ON chat_messages
  FOR DELETE
  USING (
    document_id IN (
      SELECT id FROM documents
      WHERE admin_id = auth.uid()
    )
  );
```

### 2. Verify Storage Bucket

Make sure you have a Supabase Storage bucket named **"documents"** with public access enabled. This is used for file attachments.

If you don't have it yet, create it in Supabase Storage:

1. Go to Storage in your Supabase dashboard
2. Create a new bucket named "documents"
3. Make it public (or use signed URLs)

## Features

### Chat Panel UI

- **Location**: Right sidebar of the document edit/view page
- **Visibility**: Only appears when `document.status === "completed"`
- **Replaces**: The Recipients list sidebar when document is completed

### Message Features

- Text messages
- File attachments (up to any size supported by Supabase)
- Sender identification (you vs. other users)
- Timestamp for each message
- Auto-scroll to latest message
- Real-time updates every 3 seconds

### File Attachments

Supported formats:

- PDF (.pdf)
- Word (.doc, .docx)
- Text (.txt)
- Images (.jpg, .png)

Files are stored in Supabase Storage at: `documents/{documentId}/{timestamp}_{fileName}`

### Access Control

- Only document admin and recipients can send/view messages
- Messages are scoped to the specific document
- Row Level Security (RLS) policies enforce access control

## Implementation Details

### Files Modified/Created

1. **lib/types.ts** - Added `ChatMessage` interface
2. **components/ChatPanel.tsx** - Chat UI component
3. **pages/api/chat-messages.ts** - API endpoint for messages
4. **pages/documents/[id]/edit.tsx** - Integrated chat panel
5. **pages/documents/[id]/view.tsx** - Integrated chat panel for public view
6. **supabase_migrations/create_chat_messages_table.sql** - Database schema

### API Endpoints

#### GET /api/chat-messages?documentId={id}

Fetches all messages for a document, ordered by creation time.

**Response:**

```json
{
  "messages": [
    {
      "id": "uuid",
      "document_id": "uuid",
      "sender_email": "user@example.com",
      "sender_name": "John Doe",
      "message": "Hello!",
      "attachment_url": "https://...",
      "attachment_name": "document.pdf",
      "created_at": "2024-01-01T12:00:00Z"
    }
  ]
}
```

#### POST /api/chat-messages

Sends a new message.

**Request Body:**

```json
{
  "documentId": "uuid",
  "message": "Hello!",
  "senderEmail": "user@example.com",
  "senderName": "John Doe",
  "attachmentUrl": "https://...",
  "attachmentName": "document.pdf"
}
```

**Response:**

```json
{
  "message": {
    /* created message object */
  }
}
```

## Testing

To test the chat feature:

1. Create a document and add recipients
2. Send the document to recipients
3. Have signers sign the document
4. Once all required signatures are collected, the document status changes to "completed"
5. The chat panel will appear on the right side
6. Send messages and upload files to test functionality

## Troubleshooting

### Chat not appearing

- Check that `document.status === "completed"`
- Verify the document has at least one recipient
- Check browser console for errors

### Messages not sending

- Verify the `chat_messages` table exists in Supabase
- Check RLS policies are correctly set up
- Ensure the user is authenticated or accessing via public link with email
- Check browser console and network tab for API errors

### File uploads failing

- Verify the "documents" storage bucket exists
- Check bucket permissions allow public access or signed URLs
- Ensure file size is within Supabase limits

## Future Enhancements

Potential improvements:

- Real-time updates using Supabase Realtime subscriptions
- Read receipts
- Typing indicators
- Message editing/deletion
- Emoji reactions
- Push notifications for new messages
- Search/filter messages
- Message threading
