import { remark } from "remark";
import remarkHtml from "remark-html";
import type { Article } from "@/types/database";

export interface WpConnectionConfig {
  siteUrl: string;
  username: string;
  password: string;
}

function getCredentials(config: WpConnectionConfig): string {
  return Buffer.from(`${config.username}:${config.password}`).toString("base64");
}

export async function testWordPressConnection(
  config: WpConnectionConfig
): Promise<{ success: boolean; siteTitle?: string; wpUserLogin?: string; error?: string }> {
  try {
    const credentials = getCredentials(config);
    const baseUrl = config.siteUrl.replace(/\/$/, "");

    const [siteRes, userRes] = await Promise.all([
      fetch(`${baseUrl}/wp-json/wp/v2/settings`, {
        headers: { Authorization: `Basic ${credentials}` },
      }),
      fetch(`${baseUrl}/wp-json/wp/v2/users/me`, {
        headers: { Authorization: `Basic ${credentials}` },
      }),
    ]);

    if (!siteRes.ok || !userRes.ok) {
      return { success: false, error: "Authentication failed. Check URL and credentials." };
    }

    const [site, user] = await Promise.all([siteRes.json(), userRes.json()]);

    return {
      success: true,
      siteTitle: site.title,
      wpUserLogin: user.slug,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Connection failed" };
  }
}

export async function getWpCategories(
  config: WpConnectionConfig
): Promise<Array<{ id: number; name: string; slug: string }>> {
  const credentials = getCredentials(config);
  const baseUrl = config.siteUrl.replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/wp-json/wp/v2/categories?per_page=100`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  return res.json();
}

async function markdownToHtml(markdown: string): Promise<string> {
  const result = await remark().use(remarkHtml).process(markdown);
  return result.toString();
}

export async function publishToWordPress(
  config: WpConnectionConfig,
  article: Article,
  status: "publish" | "draft" = "publish"
): Promise<{ success: boolean; postId?: number; postUrl?: string; error?: string }> {
  try {
    const credentials = getCredentials(config);
    const baseUrl = config.siteUrl.replace(/\/$/, "");
    const htmlContent = await markdownToHtml(article.content ?? "");

    let featuredMediaId: number | undefined;
    if (article.featured_image_url) {
      featuredMediaId = await uploadFeaturedImage(config, article.featured_image_url);
    }

    const body: Record<string, unknown> = {
      title: article.title,
      content: htmlContent,
      slug: article.slug,
      excerpt: article.meta_description,
      status,
    };

    if (article.wp_categories?.length) body.categories = article.wp_categories;
    if (featuredMediaId) body.featured_media = featuredMediaId;

    const res = await fetch(`${baseUrl}/wp-json/wp/v2/posts`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err.message ?? "Publish failed" };
    }

    const post = await res.json();
    return { success: true, postId: post.id, postUrl: post.link };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Publish failed" };
  }
}

async function uploadFeaturedImage(
  config: WpConnectionConfig,
  imageUrl: string
): Promise<number | undefined> {
  try {
    const credentials = getCredentials(config);
    const baseUrl = config.siteUrl.replace(/\/$/, "");

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return undefined;

    const blob = await imgRes.blob();
    const filename = imageUrl.split("/").pop() ?? "featured-image.jpg";

    const res = await fetch(`${baseUrl}/wp-json/wp/v2/media`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": blob.type || "image/jpeg",
      },
      body: blob,
    });

    if (!res.ok) return undefined;
    const media = await res.json();
    return media.id;
  } catch {
    return undefined;
  }
}
