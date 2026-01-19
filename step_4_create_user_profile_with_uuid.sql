-- ============================================================================
-- STEP 4: CREATE USER PROFILE AND ASSIGN ROLE (WITH UUID)
-- ============================================================================
-- This script uses the provided UUID directly
-- ============================================================================

DO $$
DECLARE
  company_uuid UUID;
  user_uuid UUID := '16ef1687-f362-4295-a7a7-547332814019';
  user_email TEXT := 'info@ncharudhsolutions.com';
BEGIN
  -- Get company ID
  SELECT id INTO company_uuid FROM public.companies WHERE name = 'Ncharudhsolutions' LIMIT 1;

  IF company_uuid IS NULL THEN
    RAISE EXCEPTION 'Company not found. Please run reset_database_minimal.sql first.';
  END IF;

  -- Verify user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_uuid) THEN
    RAISE EXCEPTION 'User not found with UUID: %. Please verify the user exists in Supabase Dashboard.', user_uuid;
  END IF;

  -- Get the actual email from auth.users
  SELECT email INTO user_email FROM auth.users WHERE id = user_uuid;

  RAISE NOTICE 'Found user: % (UUID: %)', user_email, user_uuid;

  -- Create or update profile (trigger may have already created it)
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    company_id,
    created_at,
    updated_at
  ) VALUES (
    user_uuid,
    user_email,
    'Super Admin',
    company_uuid,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = user_email,
    full_name = 'Super Admin',
    company_id = company_uuid,
    updated_at = now();

  -- Remove any existing roles first
  DELETE FROM public.user_roles WHERE user_id = user_uuid;

  -- Assign super_admin role
  INSERT INTO public.user_roles (
    user_id,
    role,
    created_at
  ) VALUES (
    user_uuid,
    'super_admin',
    now()
  );

  -- Success message
  RAISE NOTICE '';
  RAISE NOTICE '✅ Setup complete!';
  RAISE NOTICE 'Company ID: %', company_uuid;
  RAISE NOTICE 'User ID: %', user_uuid;
  RAISE NOTICE 'Email: %', user_email;
  RAISE NOTICE 'Role: super_admin';
  RAISE NOTICE '';
  RAISE NOTICE 'You can now login with your credentials!';
END $$;
