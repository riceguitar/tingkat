import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publishToWordPress } from "@/lib/api/wordpress";
import { decrypt } from "@/lib/encryption";

export async function POST(req: NextRequest, { params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;
  const supabase = await createClient();

  const { data: article, error: articleError } = await supabase
    .from("articles")
    .select("*")
    .eq("id", articleId)
    .single();

  if (articleError || !article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const { data: connection, error: connError } = await supabase
    .from("cms_connections")
    .select("*")
    .eq("project_id", article.project_id)
    .single();

  if (connError || !connection) {
    return NextResponse.json({ error: "No WordPress connection found for this project" }, { status: 400 });
  }

  // Update status to publishing
  await supabase.from("articles").update({ status: "publishing" }).eq("id", articleId);

  const decryptedPassword = decrypt(
    connection.encrypted_password,
    connection.iv,
    connection.auth_tag
  );

  const result = await publishToWordPress(
    { siteUrl: connection.site_url, username: connection.username, password: decryptedPassword },
    article
  );

  if (result.success) {
    await supabase.from("articles").update({
      status: "published",
      published_at: new Date().toISOString(),
      wordpress_post_id: result.postId ?? null,
      wordpress_post_url: result.postUrl ?? null,
    }).eq("id", articleId);
  } else {
    await supabase.from("articles").update({
      status: "failed",
      last_publish_error: result.error ?? "Unknown error",
      publish_attempts: (article.publish_attempts ?? 0) + 1,
    }).eq("id", articleId);
  }

  return NextResponse.json(result);
}
