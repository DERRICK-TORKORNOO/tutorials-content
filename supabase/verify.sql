-- Run after setup.sql. The seed should show 12 products, 4 categories and 4 featured products.
SELECT count(*) AS products, count(*) FILTER (WHERE featured) AS featured FROM public.products;
SELECT count(*) AS categories FROM public.categories;
SELECT catalog_version, slow_mode FROM public.settings WHERE id=1;
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'
 AND tablename IN ('products','categories','settings','orders','request_log','uploaded_images');
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id='product-images';
SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at;
