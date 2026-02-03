import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  ) {
    return res.status(500).json({ error: "Supabase configuration missing" });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
  );

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: docs, error: fetchError } = await supabaseAdmin
    .from("documents")
    .select("id, admin_id, file_name, is_uploaded, status, updated_at")
    .eq("status", "completed")
    .lt("updated_at", cutoff);

  if (fetchError) {
    return res.status(500).json({ error: fetchError.message });
  }

  if (!docs || docs.length === 0) {
    return res.status(200).json({ deleted: 0 });
  }

  // Delete related data
  const docIds = docs.map((d) => d.id);
  await supabaseAdmin.from("recipients").delete().in("document_id", docIds);
  await supabaseAdmin.from("audit_logs").delete().in("document_id", docIds);

  // Delete storage files for uploaded docs
  const filesToDelete = docs
    .filter((d) => d.is_uploaded && d.file_name)
    .map((d) => `${d.admin_id}/${d.file_name}`);

  if (filesToDelete.length > 0) {
    await supabaseAdmin.storage.from("documents").remove(filesToDelete);
  }

  // Delete documents
  const { error: deleteError } = await supabaseAdmin
    .from("documents")
    .delete()
    .in("id", docIds);

  if (deleteError) {
    return res.status(500).json({ error: deleteError.message });
  }

  return res.status(200).json({ deleted: docIds.length });
}
