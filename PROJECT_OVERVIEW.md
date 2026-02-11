## Finance Hub Pro – Project Overview & Flow Guide

This document explains the **full architecture, major modules, and end‑to‑end flows** in the Finance Hub Pro project so you (or any new developer) can quickly understand and extend the system.

---

## 1. Tech Stack & High‑Level Architecture

- **Frontend**
  - **Vite + React + TypeScript** (`vite.config.ts`, `src/main.tsx`, `src/App.tsx`)
  - **UI**: shadcn‑ui + Radix UI primitives + Tailwind CSS (see `tailwind.config.ts`, `src/components/ui/*`)
  - **State / Data fetching**: @tanstack/react‑query for all async data + caching
  - **Routing**: `react-router-dom` with protected routes and role‑based access
- **Backend / Data**
  - **Supabase Postgres** with Row Level Security
  - **Typed client**: `@supabase/supabase-js` with generated types in `src/integrations/supabase/types.ts` and client wrapper in `src/integrations/supabase/client.ts`
  - **Database schema & seeds**: SQL migrations under `supabase/migrations/*`
  - **Auth**: Supabase email/password auth, plus `profiles` and `user_roles` tables
- **Edge Functions (serverless)**
  - Deployed as **Supabase Edge Functions** under `supabase/functions/*`
  - Used for **emails, receipt OCR, anomaly scans, and policy notifications**

The React app talks **directly** to Supabase via the typed client, and to Edge Functions using `supabase.functions.invoke(...)`. There is no separate custom API server.

---

## 2. Application Shell, Routing & Layout

### 2.1 Entry point

- `src/main.tsx`
  - Mounts React and renders `App`:
    - Imports global Tailwind styles from `src/index.css`
    - Uses `createRoot(document.getElementById("root")!).render(<App />);`

### 2.2 Global app providers and router

- `src/App.tsx`
  - Wraps the app with:
    - `QueryClientProvider` (react‑query client)
    - `TooltipProvider`
    - Global toast systems (`<Toaster />`, `<Sonner />`)
    - `BrowserRouter` for client‑side routes
    - `AuthProvider` to provide authenticated user, profile, and roles
    - `NotificationListener` to sync real‑time notification updates
  - Defines all **routes** using `<Routes>` and `<Route>`:
    - Public:
      - `/auth` → `Auth` (login / signup)
    - Protected root (requires auth via `ProtectedRoute`):
      - `/` → `Dashboard`
      - `/receipts` → `Receipts`
      - `/invoices` → `Invoices` (finance roles only)
      - `/expenses` → `Expenses`
      - `/payroll` → `Payroll` (finance + HR)
      - `/statement` → `Statement` (bank statement upload/analysis)
      - `/employees` → `Employees` (admin + HR)
      - `/reports` → `Reports` (finance + auditor)
      - `/audit-logs` → `AuditLogs` (admin + auditor)
      - `/users` → `Users` (admin only)
      - `/settings` → `Settings` (admin only)
      - `/notifications` → `Notifications` (finance roles)
    - Fallback:
      - `*` → `NotFound`
  - `ProtectedRoute` enforces:
    - User must be logged in
    - Optional `requiredRoles` array for role‑based access

### 2.3 Layout

- `DashboardLayout` (under `src/components/layout/DashboardLayout.tsx`)
  - Shared **sidebar + topbar** layout for all authenticated pages
  - Handles navigation menu, current section highlighting, user avatar, dark mode, etc.
  - All pages like `Dashboard`, `Invoices`, `Expenses`, etc. render **inside** this layout.

---

## 3. Authentication, Profiles & Roles Flow

### 3.1 Supabase client

- `src/integrations/supabase/client.ts`
  - Creates a typed Supabase client:
    - Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
    - Persists auth session in `localStorage`
  - Imported throughout as:
    - `import { supabase } from "@/integrations/supabase/client";`

### 3.2 Auth context & roles

- `src/contexts/AuthContext.tsx`
  - Maintains:
    - `user`: Supabase auth user
    - `session`: auth session
    - `profile`: row from `profiles` table
    - `roles`: `user_roles.role[]` (values like `"super_admin" | "admin" | "finance_manager" | "accountant" | "hr" | "employee" | "auditor"`)
    - `loading`: global auth loading flag
  - On startup:
    - `supabase.auth.onAuthStateChange` subscribes to auth changes
    - `supabase.auth.getSession()` checks existing session
    - When a user is present, `fetchUserData(user.id)`:
      - Loads `profiles` row for basic info & `company_id`
      - Loads `user_roles` rows to build the roles array
  - Exposes helper methods:
    - `signIn(email, password)`
    - `signUp(email, password, fullName)` (uses `emailRedirectTo` back to `/`)
    - `signOut()`
    - Role utilities:
      - `hasRole(role)`
      - `isAdmin()` → `super_admin` or `admin`
      - `hasFinanceAccess()` → super_admin/admin/finance_manager/accountant

**Auth flow for the UI**
1. User hits `/auth` and signs in via Supabase.
2. On success, `AuthContext` receives new `session` + `user`, then:
   - Loads `profiles` & `user_roles` from DB.
3. `ProtectedRoute` checks:
   - If not `user` → redirect to `/auth`.
   - If `requiredRoles` is provided → check `hasRole` / `isAdmin` / `hasFinanceAccess`.
4. Once passed, the appropriate page (e.g. `Dashboard`) renders.

### 3.3 Database reset & initial super admin

- `supabase/migrations/20251231000000_reset_database_and_create_admin.sql`
  - Script to **wipe all data** and seed a fresh company:
    - Deletes data from all business tables (invoices, expenses, receipts, policies, notifications, etc.)
    - Deletes `auth.users` and `public.companies`, `public.profiles`, `public.user_roles`
  - Recreates a company: `Ncharudhsolutions` with base details.
  - Includes instructions to:
    - Manually create a Supabase auth user `info@ncharudhsolutions.com`
    - Plug the created user UUID into a `DO $$ ... $$` block to:
      - Create a matching `profiles` row
      - Assign `super_admin` role in `user_roles`

---

## 4. Data Access Pattern (React Query + Supabase)

All business entities (invoices, expenses, receipts, etc.) follow a **standard pattern**:

- A dedicated `useXxx` hook file under `src/hooks/`:
  - `useReceipts.ts`, `useInvoices.ts`, `useExpenses.ts`, `useUsers.ts`, `useDashboardStats.ts`, etc.
- Each hook:
  - Uses `useQuery` for reads (with stable `queryKey`s)
  - Uses `useMutation` for writes (insert/update/delete/approve/reject)
  - Calls Supabase tables with the typed client
  - On success:
    - Invalidates related queries for instant UI refresh
    - Shows a toast via `toast(...)` from `src/hooks/use-toast.ts`

**Pattern when adding a new flow/entity**
1. Define the table in Supabase (migration).
2. Generate types (or extend `Database` types).
3. Create `src/hooks/useNewEntity.ts`:
   - `useNewEntities`, `useCreateNewEntity`, `useUpdateNewEntity`, `useDeleteNewEntity`, etc.
4. Use these hooks in the corresponding page and components.

---

## 5. Key Business Flows

This section walks through **end‑to‑end flows** for the main features.

### 5.1 Dashboard overview

- `src/pages/Dashboard.tsx`
  - Uses:
    - `useAuth()` to greet the logged‑in user by `profile.full_name`
    - `useDashboardStats()` to fetch aggregated metrics
    - `useCompany()` to determine the active currency (default `INR`)
  - Shows:
    - **Stat cards** for:
      - Total Receipts
      - Total Expenses
      - Pending Invoices
      - Monthly Profit
    - Alerts:
      - Overdue invoices summary with link to `/invoices`
    - Charts:
      - `CashFlowChart` and `ExpenseBreakdown`
    - Lists:
      - `InvoiceList` and `RecentActivity`

**Flow**
1. User logs in and lands on `/`.
2. React Query loads dashboard stats from Supabase.
3. Dashboard components derive KPIs and charts from this data and render a bird’s‑eye view of company finances.

---

### 5.2 Receipts & OCR Flow

- Hooks: `src/hooks/useReceipts.ts`
  - `useReceipts()` → list receipts ordered by `created_at DESC`.
  - `useReceiptStats()` → counts & sums for receipts, including this month and pending.
  - `useCreateReceipt()`:
    - Requires current auth user; inserts into `receipts` with `created_by`.
    - Invalidates `["receipts"]` and `["receipt-stats"]` and shows success toast.
  - `useVerifyReceipt()`:
    - Updates status to `"verified"` or `"rejected"`, sets `verified_by` and `verified_at`.
    - Fire‑and‑forget call to `supabase.functions.invoke("send-receipt-notification", ...)`.
  - `useDeleteReceipt()`:
    - Deletes and invalidates queries.

- OCR Edge Function: `supabase/functions/extract-receipt-data/index.ts`
  - Expects `{ imageUrl }` in request JSON.
  - Calls Lovable AI gateway (Gemini model) to:
    - Extract `vendor`, `amount`, `date`, `category` from the receipt image.
  - Returns `{ success: true, data }` with structured fields.

**End‑to‑end flow**
1. User uploads a receipt image on the `Receipts` page.
2. Frontend calls the **OCR Edge Function** with the uploaded image URL.
3. The function returns structured data (vendor, amount, date, category).
4. The `ReceiptDialog` pre‑fills fields using this data.
5. On submit, `useCreateReceipt()` inserts the receipt row.
6. Finance user later verifies/rejects via `useVerifyReceipt()`:
   - Triggers `send-receipt-notification` to email the submitter.

---

### 5.3 Invoices Flow

- Page: `src/pages/Invoices.tsx`
  - Uses:
    - `useInvoices()` and `useInvoiceStats()` for data & stats
    - `useCompany()` for currency and branding
    - Mutations:
      - `useDeleteInvoice()`
      - `useMarkInvoicePaid()`
      - `useSendInvoice()`
    - Supabase client directly for:
      - Fetching `invoice_items` for PDF generation
      - Fetching fresh `company` row to ensure latest logo & bank details
  - Features:
    - Search invoices by number or client name
    - Filter by status: Draft / Sent / Paid / Overdue
    - Status chips with icons
    - Actions per invoice:
      - Edit (opens `InvoiceDialog`)
      - Download PDF (uses `InvoicePDF.generateInvoicePDF` and `downloadPDF`)
      - Email to client (opens `SendInvoiceDialog`)
      - Mark as Sent / Paid
      - Send payment reminder (calls `supabase.functions.invoke("send-payment-reminder", ...)`)
      - Delete

- Hooks: `src/hooks/useInvoices.ts`
  - `useInvoices()`:
    - Loads from `invoices` table and normalizes `status` to `"overdue"` when due date has passed.
  - `useInvoiceStats()`:
    - Computes `totalRevenue`, `paidAmount`, `pendingAmount`, `overdueAmount`.
  - `useCreateInvoice()`:
    - Requires auth user.
    - Calculates `subtotal`, `tax_amount`, `total`.
    - Inserts invoice, then invoice items.
  - `useUpdateInvoice()`:
    - Updates invoice and, if items provided, replaces all items.
  - `useDeleteInvoice()`:
    - Deletes items, then invoice.
  - `useMarkInvoicePaid()`:
    - Sets status to `"paid"` and stamps `paid_date`.
  - `useSendInvoice()`:
    - Sets status to `"sent"`.

- Email Edge Function: `supabase/functions/send-invoice-email/index.ts`
  - Input: `{ invoiceId, recipientEmail, message? }`.
  - Loads invoice and `invoice_items` using Supabase service role key.
  - Fetches company email settings:
    - `email_sender_name`, `email_reply_to`, `resend_api_key`, etc.
  - Builds a styled HTML email with:
    - Summary (issue date, due date, amount due)
    - Itemized line items
    - Totals and notes.
  - Sends email via **Resend API** using either:
    - Company‑specific API key, or
    - Global `RESEND_API_KEY`.
  - Logs an entry into `notifications` table for audit and UI display.
  - If invoice was `draft`, updates to `sent`.

**End‑to‑end flow**
1. Finance user navigates to `/invoices`.
2. They create/edit an invoice using `InvoiceDialog` (which uses `useCreateInvoice` / `useUpdateInvoice`).
3. To send to the client:
   - Frontend either:
     - Marks as sent directly with `useSendInvoice()`, or
     - Calls the `send-invoice-email` Edge Function via `SendInvoiceDialog`.
4. Email is sent and a `notifications` record is stored.
5. When payment is received, finance user clicks **Mark as Paid**:
   - `useMarkInvoicePaid()` updates the DB.
6. Dashboard and Reports reflect updated invoice stats.

---

### 5.4 Expenses, Policies, Delegations & Anomalies

- Page: `src/pages/Expenses.tsx`
  - Tabs:
    - **Expenses**: main list of individual expenses.
    - **Recurring**: `RecurringExpenseManager` for scheduled/recurring expenses.
    - **Delegations**: `DelegationManager` to handle delegated approval authority.
    - **Analytics**: `ExpenseAnalytics` for trend analysis.
    - **Reports**: `ExpenseReportGenerator` for exports/summary reports.
    - **Budgets**: `DepartmentBudgetManager` per department budgets.
    - **Anomalies**: `AnomalyDetection` for unusual spend detection.
    - **Violations**: `ViolationsDashboard` for policy breach review.
    - **Policies**: `PolicyManager` to define and manage policies.
  - Uses:
    - `useExpenses()` and `useExpenseStats()` hooks
    - `useHasDelegatedAuthority()` to determine if the user can approve on someone else’s behalf
    - `useAuth()` for `hasFinanceAccess()` and `isAdmin()` → builds `canApprove`
    - Components:
      - `ExpenseDialog`, `RejectExpenseDialog`, `ExpenseActions`, `PolicyViolationBadge`, etc.

- Hooks: `src/hooks/useExpenses.ts`
  - `useExpenses()`:
    - Loads `expenses` with joined `expense_categories`.
    - Fetches creator `profiles` (full_name, avatar_url) in a second query and merges.
  - `useExpenseStats()`:
    - Totals for amount, approved, pending, this month count.
  - `useExpenseCategories()` & `useCreateExpenseCategory()`:
    - Company‑scoped categories with deduplication and auto‑creation of an `"Other"` category.
  - `useCreateExpense()`:
    - Requires auth user.
    - Calls `checkExpenseAgainstPolicies(...)` from `useExpensePolicies.ts`:
      - Returns list of policy violations for that expense.
      - If any policy has `action = "auto_reject"`, mutation throws error.
    - Inserts into `expenses` with `status = "pending"` and `created_by`.
    - Inserts corresponding `expense_policy_violations` rows.
    - If there are violations:
      - Fire‑and‑forget call to `supabase.functions.invoke("send-policy-violation-notification", ...)`.
    - On success:
      - Invalidates `["expenses"]`, `["expense-stats"]`, and `["policy-violations"]`.
      - Shows either **submitted** or **submitted with policy flags** toast.
  - `useUpdateExpense()`: basic update.
  - `useApproveExpense()`:
    - Requires auth user.
    - Checks for unresolved violations in `expense_policy_violations`.
    - If unresolved violations exist → throws error.
    - Otherwise sets `status = "approved"`, sets `approved_by` and `approved_at`.
    - Fire‑and‑forget call to `send-expense-notification` with `action: "approved"`.
  - `useRejectExpense()`:
    - Sets `status = "rejected"`, record notes, and notifies via `send-expense-notification` with `action: "rejected"`.
  - `useDeleteExpense()`:
    - Deletes record and invalidates cached queries.

- Related Edge Functions
  - `send-expense-notification`: emails submitter about approval or rejection.
  - `send-policy-violation-notification`: notifies finance managers of flagged expenses.
  - `scheduled-anomaly-scan`: periodically analyzes expense data for anomalies and writes `anomaly_reviews` / notifications.

**End‑to‑end flow (single expense)**
1. Employee submits an expense via `ExpenseDialog`:
   - `useCreateExpense()` checks against policies.
   - Violations are recorded and, if necessary, notifications are sent.
2. Finance manager or delegated approver reviews:
   - Policy badges and violation dashboards show red flags.
3. Approver selects **Approve** or **Reject**:
   - `useApproveExpense()` or `useRejectExpense()` updates DB and triggers email notifications.
4. Dashboard and Reports update totals & charts.

---

### 5.5 Bank Statements & Reconciliation

- Page: `src/pages/Statement.tsx`
  - Restricted to finance roles via `ProtectedRoute`.
  - Typically handles:
    - Upload of bank statements (e.g., CSV, XLSX).
    - Parsing, normalizing, and storing records in `bank_statements` table.
    - Linking statement lines to invoices or expenses for reconciliation.
  - Migrations under `supabase/migrations/20251231020000_create_bank_statements.sql` and related scripts define the schema.

**Typical flow**
1. Finance user uploads a statement file.
2. Frontend parses (or backend processes) the data into uniform statement rows.
3. User matches transactions against invoices/expenses.
4. Reconciliation results may affect dashboards and anomaly detection.

---

### 5.6 Payroll & Employees

- Pages:
  - `src/pages/Employees.tsx` – manage employee master data.
  - `src/pages/Payroll.tsx` – manage payslips and payroll runs.
- Database tables:
  - `employees`, `payslips` (migrations under `supabase/migrations/*`).
- Typical flow:
  1. Admin/HR sets up employees with salaries and bank details.
  2. Payroll cycles create `payslips` records.
  3. Payslips can be exported or emailed (similar pattern to invoices).

---

### 5.7 Reports & Audit Logs

- Reports: `src/pages/Reports.tsx`
  - Restricted to finance roles & auditors.
  - Aggregates:
    - Invoices (revenue)
    - Expenses (spend)
    - Receipts, statements, anomalies
  - Provides filters (date ranges, departments, categories) and export functions.

- Audit Logs: `src/pages/AuditLogs.tsx`
  - Backed by `audit_logs` table.
  - Records important events (logins, role changes, critical updates like approvals).
  - Allows auditors/admins to filter and review change history.

**Typical flow**
1. Each critical action logs an entry in `audit_logs` (performed by Supabase triggers or directly by app code).
2. Auditors use `/audit-logs` to trace who did what and when.

---

### 5.8 Users, Roles & Settings

- Users: `src/pages/Users.tsx`
  - Components under `src/components/users/*`:
    - `UserDialog` – create user profiles.
    - `EditUserDialog` – edit profile details.
    - `ManageRolesDialog` – assign/remove roles per user.
    - `ViewProfileDialog` – read‑only view of user data.
  - Hooks: `useUsers.ts` to list and mutate user data.

- Settings: `src/pages/Settings.tsx`
  - Sections usually include:
    - Company details (name, address, logo, currency).
    - Bank details (for invoices and payouts).
    - Email settings:
      - Sender name
      - Reply‑to address
      - Resend API key per company.
    - Policy defaults (expense limits, categories).

**Flow**
1. Super admin configures global company settings on `/settings`.
2. These settings are used by:
   - Invoices (branding, bank details in PDFs and emails).
   - Notifications (from/reply‑to address).
   - Policy engine defaults for expenses.

---

### 5.9 Notifications

- Page: `src/pages/Notifications.tsx`
  - Lists entries from `notifications` table.
  - Allows finance/admin users to see:
    - Which emails were sent (invoices, expense approvals, policy alerts, reminders).
    - Status (`sent` / `failed`), basic metadata.

- `NotificationListener` (`src/components/notifications/NotificationListener.tsx`)
  - Subscribes (via Supabase real‑time) for new notifications for the current company.
  - Shows toasts or indicators when new notifications arrive.

**Flow**
1. Edge Functions (send‑invoice‑email, send‑expense‑notification, send‑payment-reminder, send-policy-violation-notification, etc.) log entries in `notifications`.
2. Listener sees the new row and can surface a real‑time toast.
3. Users can view the history and statuses in `/notifications`.

---

## 6. Supabase Edge Functions Overview

Located under `supabase/functions/*`. Key functions include:

- **`extract-receipt-data`**
  - Input: `{ imageUrl }`
  - Output: `{ vendor, amount, date, category }`
  - used for receipt OCR and pre‑filling receipt forms.

- **`send-invoice-email`**
  - Input: `{ invoiceId, recipientEmail, message? }`
  - Steps:
    - Load invoice + items + company email settings.
    - Render HTML email and send via Resend.
    - Log notification, optionally mark invoice as sent.

- **`send-payment-reminder`**
  - Triggered from Invoices page when user clicks *Send Payment Reminder*.
  - Sends gentle reminder email to client for overdue/pending invoice.

- **`send-expense-notification`**
  - Sends approval/rejection email to expense submitter.

- **`send-receipt-notification`**
  - Sends verified/rejected notification for receipts.

- **`send-policy-violation-notification`**
  - Notifies finance managers about flagged policy violations from expenses.

- **`scheduled-anomaly-scan`**
  - Periodic task (called by scheduler) that:
    - Scans expenses and related data for anomalies.
    - Inserts `anomaly_reviews` and possibly `notifications`.

All functions use:
- `serve(...)` from Deno std lib to handle HTTP requests.
- Supabase service role key when they need to bypass RLS for internal operations.

---

## 7. Database Schema Highlights

Defined by migration files in `supabase/migrations/*`. Key tables:

- **Core**
  - `companies`: company metadata, logo, bank, and email settings.
  - `profiles`: user profile linked to `auth.users`.
  - `user_roles`: maps user to roles like `super_admin`, `finance_manager`, etc.
- **Finance**
  - `receipts`, `receipt_categories`
  - `invoices`, `invoice_items`
  - `expenses`, `expense_categories`
  - `department_budgets`
  - `recurring_expenses`
  - `bank_statements`
  - `quotations` and related service/technical scope tables
- **Compliance & Monitoring**
  - `expense_policies`, `expense_policy_violations`
  - `anomaly_detection_settings`, `anomaly_reviews`
  - `approval_chains`, `approval_chain_levels`, `expense_approval_actions`, `expense_approvals`
  - `notifications`
  - `audit_logs`
- **HR / Payroll**
  - `employees`, `payslips`

Each migration file is timestamp‑prefixed to ensure deterministic order of schema creation and evolution.

---

## 8. Local Development & Environment

### 8.1 Prerequisites

- Node.js + npm installed (see `README.md` for basic setup).
- Supabase project with:
  - Database initialized from `supabase/migrations/*`
  - Edge Functions deployed from `supabase/functions/*`

### 8.2 Environment variables

Create `.env.local` (or `.env`) for Vite with:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Supabase project should also define:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `RESEND_API_KEY` (unless per‑company keys are used exclusively)
- `LOVABLE_API_KEY` (for receipt OCR AI gateway)

### 8.3 Running locally

```bash
npm install
npm run dev
```

The app will run on the Vite dev server (usually `http://localhost:5173`).

---

## 9. How to Add a New Flow (Template)

When you add a new feature (e.g. **Vendor Management**, **Projects**, etc.), follow this pattern:

1. **Design database schema**
   - Create a new migration under `supabase/migrations/` to define tables, indexes, and RLS policies.
2. **Generate/extend Supabase types**
   - Update `src/integrations/supabase/types.ts` if needed so your new tables are typed.
3. **Create hooks**
   - Add `src/hooks/useVendors.ts` (or similar) with:
     - `useVendors()`, `useCreateVendor()`, `useUpdateVendor()`, `useDeleteVendor()` using react‑query and Supabase.
4. **Create page & components**
   - Add `src/pages/Vendors.tsx` using `DashboardLayout`.
   - Build components under `src/components/vendors/*` if the flow is non‑trivial.
5. **Wire into router**
   - Add a route in `src/App.tsx` using `ProtectedRoute`.
   - Decide which roles can access the new flow.
6. **(Optional) Edge functions**
   - If the new feature needs emails, scheduled jobs, or external APIs, add a function under `supabase/functions/`.
   - Use the same pattern as existing functions (CORS, error handling, notifications).

By following this pattern, your new flow will be consistent with the rest of Finance Hub Pro and automatically benefit from existing infrastructure (auth, roles, notifications, analytics).

