-- Create public storage bucket for article images
INSERT INTO storage.buckets (id, name, public)
VALUES ('article-images', 'article-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "authenticated can upload images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'article-images');

-- Allow public read of images (articles are public content)
CREATE POLICY "public can read images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'article-images');

-- Allow authenticated users to delete images
CREATE POLICY "authenticated can delete images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'article-images');
