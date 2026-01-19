# Quick Start Guide - Database Reset

## Step 1: Run Reset Script

**File:** `reset_database_minimal.sql`

1. Open Supabase Dashboard > SQL Editor
2. Copy the ENTIRE contents of `reset_database_minimal.sql`
3. Paste into SQL Editor
4. Click "Run" (or press Cmd/Ctrl + Enter)
5. Wait for success message

**What it does:**
- Disables the trigger (prevents errors when creating user)
- Deletes all data
- Creates your company: Ncharudhsolutions

---

## Step 2: Create User via Dashboard

1. Go to: **Supabase Dashboard > Authentication > Users**
2. Click: **"Add User"** > **"Create new user"**
3. Fill in:
   - **Email:** `info@ncharudhsolutions.com`
   - **Password:** `Chakri@2555`
   - ✅ Check: **"Auto Confirm User"**
4. Click: **"Create User"**
5. **Copy the User UID** (looks like: `12345678-1234-1234-1234-123456789abc`)

---

## Step 3: Create Profile and Role

**File:** `step_4_create_user_profile.sql`

1. Open the file
2. Find this line (around line 22):
   ```sql
   user_uuid_text := 'PASTE_YOUR_USER_UUID_HERE';
   ```
3. Replace `'PASTE_YOUR_USER_UUID_HERE'` with your actual UUID (keep the quotes!)
   ```sql
   user_uuid_text := '12345678-1234-1234-1234-123456789abc';
   ```
4. Copy the ENTIRE script
5. Paste into Supabase SQL Editor
6. Click "Run"

**What it does:**
- Creates user profile
- Assigns super_admin role
- Links user to company

---

## Step 4: (Optional) Fix Trigger for Future Users

**File:** `fix_trigger_and_re_enable.sql`

Run this if you want new users to be automatically assigned to your company.

---

## Troubleshooting

### Error: "String must contain at least 1 character(s)"
- Make sure you're copying the ENTIRE script, not just comments
- Use `reset_database_minimal.sql` instead of `reset_database.sql`
- Don't select only empty lines or comments

### Error: "Invalid UUID format"
- Make sure you replaced the placeholder in step_4 script
- UUID should look like: `12345678-1234-1234-1234-123456789abc`
- Keep the single quotes around the UUID

### Error: "User not found"
- Make sure you created the user in Step 2 first
- Double-check the UUID is correct (copy-paste it)

### Error: "Company not found"
- Make sure Step 1 completed successfully
- Check that company was created in `public.companies` table
