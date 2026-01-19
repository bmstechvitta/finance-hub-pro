-- ============================================================================
-- FIX TRIGGER FUNCTION AND RE-ENABLE IT
-- ============================================================================
-- Run this AFTER you've created the admin user and company
-- This will update the trigger to automatically assign new users to the company
-- ============================================================================

-- Update the trigger function to use the actual company
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
  company_uuid UUID;
BEGIN
  -- Get the first (or only) company
  SELECT id INTO company_uuid FROM public.companies ORDER BY created_at ASC LIMIT 1;
  
  -- Count existing users
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  
  -- Insert profile with company_id (only if company exists)
  IF company_uuid IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name, company_id)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
      company_uuid
    );
    
    -- If first user, make them super_admin; otherwise, employee
    IF user_count = 0 THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'super_admin');
    ELSE
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'employee');
    END IF;
  ELSE
    -- If no company exists, create profile without company_id (shouldn't happen in normal flow)
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1))
    );
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'employee');
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail user creation
  RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Re-enable the trigger
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Trigger function updated and re-enabled!';
  RAISE NOTICE 'New users will now be automatically assigned to your company.';
END $$;
