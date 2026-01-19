-- Create storage bucket for company assets (logos, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-assets',
  'company-assets',
  true, -- Public bucket so logos can be accessed without auth
  5242880, -- 5MB limit for logos
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Allow admins and finance managers to upload company assets
CREATE POLICY "Admins and finance can upload company assets"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'company-assets' 
  AND auth.uid() IS NOT NULL
  AND (
    public.is_admin(auth.uid())
    OR public.has_finance_access(auth.uid())
  )
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' -- Ensure first folder is a UUID (company_id)
);

-- Allow everyone to view company assets (public bucket)
CREATE POLICY "Anyone can view company assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'company-assets');

-- Allow admins and finance managers to update company assets
CREATE POLICY "Admins and finance can update company assets"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'company-assets' 
  AND (
    public.is_admin(auth.uid())
    OR public.has_finance_access(auth.uid())
  )
);

-- Allow admins to delete company assets
CREATE POLICY "Admins can delete company assets"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'company-assets' 
  AND public.is_admin(auth.uid())
);
