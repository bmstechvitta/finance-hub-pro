-- ============================================================================
-- STEP 4: CREATE USER PROFILE AND ASSIGN ROLE
-- ============================================================================
-- Run this AFTER creating the user in Supabase Dashboard
-- This script will automatically find the user by email address
-- ============================================================================

DO $$
DECLARE
  company_uuid UUID;
  user_uuid UUID;
  user_email TEXT := 'info@ncharudhsolutions.com';
  user_email_lower TEXT;
  found_users_count INTEGER;
BEGIN
  -- Get company ID
  SELECT id INTO company_uuid FROM public.companies WHERE name = 'Ncharudhsolutions' LIMIT 1;

  IF company_uuid IS NULL THEN
    RAISE EXCEPTION 'Company not found. Please run reset_database_minimal.sql first.';
  END IF;

  -- Check how many users exist
  SELECT COUNT(*) INTO found_users_count FROM auth.users;
  
  IF found_users_count = 0 THEN
    RAISE EXCEPTION 'No users found in auth.users. Please create the user first via Supabase Dashboard: Authentication > Users > Add User > Create new user (Email: %, Password: Chakri@2555, Auto Confirm: Yes)', user_email;
  END IF;

  -- Try to find user by exact email match first
  SELECT id INTO user_uuid FROM auth.users WHERE email = user_email LIMIT 1;

  -- If not found, try case-insensitive match
  IF user_uuid IS NULL THEN
    user_email_lower := LOWER(user_email);
    SELECT id INTO user_uuid 
    FROM auth.users 
    WHERE LOWER(email) = user_email_lower 
    LIMIT 1;
  END IF;

  -- If still not found, show available users
  IF user_uuid IS NULL THEN
    RAISE WARNING 'User with email "%" not found. Available users:', user_email;
    
    -- List all available users
    FOR user_uuid IN 
      SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 5
    LOOP
      DECLARE
        user_email_found TEXT;
      BEGIN
        SELECT email INTO user_email_found FROM auth.users WHERE id = user_uuid;
        RAISE WARNING '  - Email: %, UUID: %', user_email_found, user_uuid;
      END;
    END LOOP;
    
    RAISE EXCEPTION 'User with email "%" not found. Please create the user via Supabase Dashboard first (Authentication > Users > Add User). Make sure the email is exactly: %', user_email, user_email;
  END IF;

  RAISE NOTICE 'Found user: % (UUID: %)', (SELECT email FROM auth.users WHERE id = user_uuid), user_uuid;

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
  RAISE NOTICE 'You can now login with:';
  RAISE NOTICE '  Email: %', user_email;
  RAISE NOTICE '  Password: Chakri@2555';
END $$;
