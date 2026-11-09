-- Use this only if you chose CLI migrations rather than supabase/setup.sql.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('product-images','product-images',false,5242880,ARRAY['image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false, file_size_limit=5242880, allowed_mime_types=ARRAY['image/webp'];
