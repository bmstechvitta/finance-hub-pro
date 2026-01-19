# Hardcoded Values Removed - Summary

## ✅ Completed Changes

### 1. Email Settings (All Edge Functions Updated)

**Before:** All functions used hardcoded `onboarding@resend.dev` and `"Expenses"`, `"Receipts"`, etc.

**After:** All functions now use company email settings:
- `email_sender_name` from companies table
- `email_reply_to` from companies table  
- `resend_api_key` from companies table (with fallback to env var)
- Company `email` for "from" address

**Files Updated:**
- ✅ `supabase/functions/send-expense-notification/index.ts`
- ✅ `supabase/functions/send-receipt-notification/index.ts`
- ✅ `supabase/functions/send-payment-reminder/index.ts`
- ✅ `supabase/functions/send-anomaly-alert/index.ts`
- ✅ `supabase/functions/send-policy-violation-notification/index.ts`
- ✅ `supabase/functions/scheduled-anomaly-scan/index.ts`
- ✅ `supabase/functions/send-invoice-email/index.ts` (already was using company settings)

### 2. Number Prefixes (Now Configurable)

**Before:** Hardcoded prefixes:
- Invoice: `"INV-"`
- Receipt: `"RCP-"`
- Quotation: `"QT-"`

**After:** Configurable per company via database:
- Added migration: `20251231010000_add_number_prefixes.sql`
- Added fields: `invoice_prefix`, `receipt_prefix`, `quotation_prefix` to companies table
- Updated generation functions to accept prefix parameter
- Updated Settings page to allow configuration

**Files Updated:**
- ✅ `supabase/migrations/20251231010000_add_number_prefixes.sql` (new)
- ✅ `src/hooks/useInvoices.ts` - `generateInvoiceNumber()` now accepts prefix
- ✅ `src/hooks/useQuotations.ts` - `generateQuotationNumber()` now accepts prefix
- ✅ `src/hooks/useReceipts.ts` - Added `generateReceiptNumber()` function
- ✅ `src/components/invoices/InvoiceDialog.tsx` - Uses company prefix
- ✅ `src/components/receipts/ReceiptForm.tsx` - Uses company prefix
- ✅ `src/components/quotations/QuotationDialog.tsx` - Uses company prefix
- ✅ `src/components/expenses/ExpenseDialog.tsx` - Uses company prefix for receipts
- ✅ `src/pages/Settings.tsx` - Added prefix configuration UI

### 3. Company Name in UI

**Before:** Hardcoded "FinanceHub" in:
- Dashboard sidebar
- Auth page

**After:** 
- Dashboard sidebar: Uses `company.name` from database
- Auth page: Kept as "FinanceHub" (user not logged in yet, can't fetch company)

**Files Updated:**
- ✅ `src/components/layout/DashboardLayout.tsx` - Uses `useCompany()` hook

### 4. PDF Component Defaults

**Before:** Hardcoded `"Your Company"` as default company name

**After:** Removed hardcoded defaults - components now require company name to be passed

**Files Updated:**
- ✅ `src/components/invoices/InvoicePDF.tsx`
- ✅ `src/components/payroll/PayslipPDF.tsx`
- ✅ `src/components/expenses/ExpenseReportPDF.tsx`

### 5. Settings Page Placeholders

**Before:** Hardcoded placeholders:
- `"FinanceHub"` for email sender name
- `"support@financehub.com"` for reply-to email

**After:** Uses company data:
- Email sender name: `company.name` or empty
- Reply-to email: `company.email` or `"support@example.com"`

**Files Updated:**
- ✅ `src/pages/Settings.tsx`

---

## 📋 Remaining Acceptable Defaults

These are **intentional defaults** and are fine to keep:

1. **Currency defaults**: `"INR"` - Falls back to company currency setting
2. **Timezone defaults**: `"UTC"` - Falls back to company timezone setting  
3. **Quotation defaults**: 
   - `validity_days: 15` - Reasonable default
   - `support_period_months: 3` - Reasonable default
4. **Invoice due date**: `30 days` - Standard business practice
5. **API endpoints**: `https://api.resend.com/emails` - This is the actual API URL, not a hardcoded value
6. **Currency options in dropdowns**: USD, INR, etc. - These are currency codes, not hardcoded values

---

## 🎯 Migration Required

**Run this migration to add prefix fields:**
```sql
-- File: supabase/migrations/20251231010000_add_number_prefixes.sql
```

This adds:
- `invoice_prefix TEXT DEFAULT 'INV'`
- `receipt_prefix TEXT DEFAULT 'RCP'`
- `quotation_prefix TEXT DEFAULT 'QT'`

---

## ✨ Benefits

1. **Company Branding**: Each company can customize their email sender name
2. **Flexible Numbering**: Companies can use their own numbering schemes
3. **Multi-tenant Ready**: Different companies can have different configurations
4. **Professional Emails**: Uses company email addresses instead of generic ones
5. **API Key Management**: Each company can use their own Resend API key

---

## 🔄 Next Steps (Optional Future Enhancements)

1. **Email Templates**: Store email templates in database for full customization
2. **Notification Messages**: Make notification titles/messages configurable
3. **Default Tax Rates**: Store in company settings
4. **Default Payment Terms**: Store in company settings
5. **Localization**: Support multiple languages for notifications
