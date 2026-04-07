import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { publishToWordPress } from "@/lib/api/wordpress";
import { decrypt } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: articles } = await supabase
    .from("articles")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .lt("publish_attempts", 3);

  if (!articles?.length) return NextResponse.json({ processed: 0 });

  const results = await Promise.allSettled(
    articles.map(async (article) => {
      const { data: connection } = await supabase
        .from("cms_connections")
        .select("*")
        .eq("project_id", article.project_id)
        .single();

      if (!connection) throw new Error("No WordPress connection");

      await supabase.from("articles").update({ status: "publishing" }).eq("id", article.id);

      const decryptedPassword = decrypt(connection.encrypted_password, connection.iv, connection.auth_tag);
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
        }).eq("id", article.id);
      } else {
        await supabase.from("articles").update({
          status: "failed",
          last_publish_error: result.error,
          publish_attempts: (article.publish_attempts ?? 0) + 1,
        }).eq("id", article.id);
      }

      return result;
    })
  );

  return NextResponse.json({ processed: results.length });
}
