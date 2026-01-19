# Notification Hardcoded Content Analysis

## Summary
**YES, notifications contain hardcoded content** in multiple places. Here's what's hardcoded:

---

## 1. Email "From" Addresses (Hardcoded)

All Edge Functions use hardcoded sender addresses:

| Function | Hardcoded "From" Address |
|----------|-------------------------|
| `send-invoice-email` | Uses company email OR fallback: `onboarding@resend.dev` |
| `send-expense-notification` | `"Expenses <onboarding@resend.dev>"` |
| `send-receipt-notification` | `"Receipts <onboarding@resend.dev>"` |
| `send-payment-reminder` | `${companyName} <onboarding@resend.dev>` |
| `send-anomaly-alert` | `"Expense Alerts <onboarding@resend.dev>"` |
| `send-policy-violation-notification` | `"Expenses <onboarding@resend.dev>"` |
| `scheduled-anomaly-scan` | `"Expense Alerts <onboarding@resend.dev>"` |

**Issue**: All use `onboarding@resend.dev` which is Resend's default test domain. Should use company email settings.

---

## 2. Email Template Content (Hardcoded HTML)

### Expense Notifications (`send-expense-notification/index.ts`)
- **Line 125**: `"Hi ${submitterProfile.full_name || "there"},"` - Greeting template
- **Line 129-132**: Approval/rejection messages:
  - `"Great news! Your expense request has been approved by ${approverName}."`
  - `"Your expense request has been reviewed and unfortunately was not approved by ${approverName}."`
- **Line 171**: `"If you believe this was a mistake or have additional information to provide, please contact your manager or resubmit the expense with the necessary documentation."`
- **Line 175**: `"The reimbursement will be processed according to your company's payment schedule."`
- **Line 181**: `"This is an automated notification from your expense management system."`

### Invoice Email (`send-invoice-email/index.ts`)
- **Line 265**: Subject template: `"Invoice ${invoice.invoice_number} - ${formatCurrency(invoice.total)} due ${formatDate(invoice.due_date)}"`
- **Line 279**: Title: `"Invoice ${invoice.invoice_number} sent"`
- Email HTML template is dynamically generated but uses hardcoded styling and structure

### Payment Reminder (`send-payment-reminder/index.ts`)
- **Line 159**: Subject: `"Payment Reminder: Invoice ${invoice.invoice_number} is ${daysOverdue} Days Overdue"`
- **Line 172**: Title: `"Payment reminder: Invoice ${invoice.invoice_number}"`
- **Line 173**: Message: `${daysOverdue} days overdue - ${formatCurrency(invoice.total)}`

### Receipt Notification (`send-receipt-notification/index.ts`)
- **Line 134**: `"This is an automated notification from your expense management system."`
- **Line 151**: Subject: `"Receipt ${receipt.receipt_number} has been ${statusText.toLowerCase()}"`

### Anomaly Alert (`send-anomaly-alert/index.ts`)
- **Line 237**: Subject: `"🚨 Alert: ${anomalies.length} High-Severity Expense Anomal${anomalies.length > 1 ? "ies" : "y"} Detected"`
- **Line 251**: Title: `"High-Severity Anomalies Detected"`
- **Line 252**: Message: `${anomalies.length} expense${anomalies.length > 1 ? "s have" : " has"} been flagged for immediate review`
- **Line 212**: `"Please log in to your expense management system to review these flagged expenses and take appropriate action."`
- **Line 217**: `"This is an automated alert from your expense anomaly detection system."`

---

## 3. Notification Titles & Messages (Partially Hardcoded)

Notification titles and messages are constructed dynamically but use hardcoded templates:

### Expense Notifications
- **Title**: `"Expense ${statusText}: ${expense.description}"` (Line 206)
- **Message**: 
  - Approved: `"Your expense of ${formatCurrency(expense.amount)} has been approved"`
  - Rejected: `"Your expense of ${formatCurrency(expense.amount)} has been rejected"`

### Invoice Notifications
- **Title**: `"Invoice ${invoice.invoice_number} sent"` (Line 279)
- **Message**: `"Invoice for ${formatCurrency(invoice.total)} sent to ${invoice.client_name}"`

### Payment Reminders
- **Title**: `"Payment reminder: Invoice ${invoice.invoice_number}"` (Line 172)
- **Message**: `${daysOverdue} days overdue - ${formatCurrency(invoice.total)}`

### Anomaly Alerts
- **Title**: `"High-Severity Anomalies Detected"` (Line 251)
- **Message**: `${anomalies.length} expense${anomalies.length > 1 ? "s have" : " has"} been flagged for immediate review`

---

## 4. Email Styling & HTML Structure (Hardcoded)

All email templates use hardcoded:
- CSS styles (inline)
- HTML structure
- Color schemes
- Font families
- Layout templates

---

## Recommendations

### 1. **Use Company Email Settings**
- Replace `onboarding@resend.dev` with company email settings from `companies` table
- Use `email_sender_name` and `email_reply_to` fields

### 2. **Make Templates Configurable**
- Store email templates in database or config
- Allow companies to customize notification messages
- Create a `notification_templates` table

### 3. **Create Template System**
- Move hardcoded HTML to template files
- Use template variables for dynamic content
- Allow company branding customization

### 4. **Localization Support**
- Extract all hardcoded strings
- Support multiple languages
- Store translations in database

---

## Files to Update

1. `supabase/functions/send-invoice-email/index.ts` ✅ (Already uses company email settings)
2. `supabase/functions/send-expense-notification/index.ts` ❌
3. `supabase/functions/send-receipt-notification/index.ts` ❌
4. `supabase/functions/send-payment-reminder/index.ts` ❌
5. `supabase/functions/send-anomaly-alert/index.ts` ❌
6. `supabase/functions/send-policy-violation-notification/index.ts` ❌
7. `supabase/functions/scheduled-anomaly-scan/index.ts` ❌

---

## Current Status

- ✅ **Invoice emails**: Use company email settings (partially configurable)
- ❌ **All other notifications**: Use hardcoded `onboarding@resend.dev`
- ❌ **All email templates**: Hardcoded HTML and messages
- ❌ **Notification titles/messages**: Hardcoded templates
