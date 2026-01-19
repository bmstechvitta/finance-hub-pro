-- ============================================================================
-- LIST ALL USERS - Helper Script
-- ============================================================================
-- Run this to see all users in your database
-- ============================================================================

SELECT 
  id as user_uuid,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;
