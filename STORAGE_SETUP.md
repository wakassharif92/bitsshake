# Supabase Storage Bucket Setup

## Create Documents Storage Bucket

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Create Storage Bucket**
   - Click on **Storage** in the left sidebar
   - Click **"New bucket"** button
   - Enter the following:
     - **Name**: `documents`
     - **Public bucket**: ✅ Check this (so PDFs can be viewed)
   - Click **"Create bucket"**

3. **Set Bucket Policies** (Allow authenticated users to upload/delete)
   - Click on the `documents` bucket
   - Go to **Policies** tab
   - Click **"New policy"**

   **Policy 1: Allow authenticated uploads**

   ```sql
   CREATE POLICY "Allow authenticated uploads"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
   ```

   **Policy 2: Allow users to delete their own files**

   ```sql
   CREATE POLICY "Allow users to delete own files"
   ON storage.objects FOR DELETE
   TO authenticated
   USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
   ```

   **Policy 3: Allow public read access**

   ```sql
   CREATE POLICY "Public read access"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'documents');
   ```

## Alternative: Run SQL Directly

You can also run this SQL in the Supabase SQL Editor:

```sql
-- Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true);

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own files
CREATE POLICY "Allow users to delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'documents');
```

## Verify Setup

After creating the bucket:

1. Go to your app
2. Click **Create Document** → **Upload Document**
3. Upload a test PDF file
4. You should see it in the list
5. Click **View PDF** to open it in a new tab

## File Structure

Files are organized by user ID:

```
documents/
├── user-id-1/
│   ├── 1234567890_document1.pdf
│   └── 1234567891_document2.pdf
├── user-id-2/
│   └── 1234567892_agreement.pdf
```

This ensures users can only delete their own files.
