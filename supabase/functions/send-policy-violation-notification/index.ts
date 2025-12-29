import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PolicyViolationRequest {
  expenseId: string;
  violations: Array<{
    policyName: string;
    policyType: string;
    violationDetails: string;
    action: string;
  }>;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Send policy violation notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { expenseId, violations }: PolicyViolationRequest = await req.json();
    console.log(`Sending policy violation notification for expense ${expenseId} with ${violations.length} violations`);

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      throw new Error("Email service not configured");
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch expense details
    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .select(`
        *,
        expense_categories:category_id(name)
      `)
      .eq("id", expenseId)
      .single();

    if (expenseError || !expense) {
      console.error("Error fetching expense:", expenseError);
      throw new Error("Expense not found");
    }

    // Get the expense submitter's name
    let submitterName = "Unknown";
    if (expense.created_by) {
      const { data: submitterProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", expense.created_by)
        .single();
      
      if (submitterProfile?.full_name) {
        submitterName = submitterProfile.full_name;
      }
    }

    // Get all finance managers and admins to notify
    const { data: financeUsers, error: financeError } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["super_admin", "admin", "finance_manager", "accountant"]);

    if (financeError) {
      console.error("Error fetching finance users:", financeError);
      throw new Error("Failed to find notification recipients");
    }

    if (!financeUsers || financeUsers.length === 0) {
      console.log("No finance users found to notify");
      return new Response(JSON.stringify({ success: true, message: "No recipients to notify" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get email addresses for finance users
    const userIds = financeUsers.map(u => u.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);

    if (profilesError || !profiles) {
      console.error("Error fetching profiles:", profilesError);
      throw new Error("Failed to find recipient emails");
    }

    const recipients = profiles.filter(p => p.email);
    if (recipients.length === 0) {
      console.log("No recipients with email addresses found");
      return new Response(JSON.stringify({ success: true, message: "No recipients with emails" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Sending notifications to ${recipients.length} finance users`);

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: expense.currency || "USD",
      }).format(amount);
    };

    const formatDate = (date: string) => {
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    const policyTypeLabels: Record<string, string> = {
      threshold: "Amount Threshold",
      category_restriction: "Category Restriction",
      daily_limit: "Daily Limit",
      monthly_limit: "Monthly Limit",
    };

    const actionLabels: Record<string, string> = {
      flag: "Flagged for Review",
      require_approval: "Requires Approval",
      auto_reject: "Auto Rejected",
    };

    const violationsHtml = violations.map(v => `
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin-bottom: 12px; border-radius: 0 8px 8px 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="color: #92400e; font-size: 14px; font-weight: 600;">${v.policyName}</span>
          <span style="background-color: #fde68a; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${policyTypeLabels[v.policyType] || v.policyType}</span>
        </div>
        <p style="margin: 0; color: #78350f; font-size: 13px;">${v.violationDetails}</p>
        <p style="margin: 8px 0 0 0; color: #a16207; font-size: 12px;">Action: ${actionLabels[v.action] || v.action}</p>
      </div>
    `).join("");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Expense Policy Violation Alert</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background-color: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="width: 60px; height: 60px; border-radius: 50%; background-color: #fef3c7; color: #f59e0b; font-size: 28px; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                ⚠
              </div>
              <h1 style="margin: 0 0 8px 0; font-size: 24px; color: #111827;">Policy Violation Alert</h1>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">An expense has triggered ${violations.length} policy ${violations.length === 1 ? "rule" : "rules"}</p>
            </div>

            <!-- Introduction -->
            <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
              A new expense submitted by <strong>${submitterName}</strong> has been flagged for policy violations and requires your attention.
            </p>

            <!-- Expense Details Box -->
            <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <h3 style="margin: 0 0 16px 0; font-size: 14px; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;">Expense Details</h3>
              <div style="margin-bottom: 12px;">
                <span style="color: #6b7280; font-size: 13px;">Description:</span>
                <p style="margin: 4px 0 0 0; color: #111827; font-size: 14px; font-weight: 500;">${expense.description}</p>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <span style="color: #6b7280; font-size: 13px;">Amount:</span>
                  <p style="margin: 4px 0 0 0; color: #111827; font-size: 16px; font-weight: 600;">${formatCurrency(expense.amount)}</p>
                </div>
                <div>
                  <span style="color: #6b7280; font-size: 13px;">Category:</span>
                  <p style="margin: 4px 0 0 0; color: #111827; font-size: 14px;">${expense.expense_categories?.name || "Uncategorized"}</p>
                </div>
                <div>
                  <span style="color: #6b7280; font-size: 13px;">Date:</span>
                  <p style="margin: 4px 0 0 0; color: #111827; font-size: 14px;">${formatDate(expense.expense_date)}</p>
                </div>
                <div>
                  <span style="color: #6b7280; font-size: 13px;">Submitted by:</span>
                  <p style="margin: 4px 0 0 0; color: #111827; font-size: 14px;">${submitterName}</p>
                </div>
              </div>
            </div>

            <!-- Policy Violations -->
            <div style="margin-bottom: 24px;">
              <h3 style="margin: 0 0 16px 0; font-size: 14px; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;">Policy Violations</h3>
              ${violationsHtml}
            </div>

            <!-- Call to Action -->
            <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
              Please review this expense and take appropriate action. You can approve, reject, or request additional information from the submitter.
            </p>

            <!-- Footer -->
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0; border-top: 1px solid #e5e7eb; padding-top: 16px;">
              This is an automated notification from your expense management system.
            </p>
          </div>
        </body>
      </html>
    `;

    // Send to all finance users
    const emailPromises = recipients.map(async (recipient) => {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Expenses <onboarding@resend.dev>",
            to: [recipient.email],
            subject: `⚠️ Policy Violation: ${expense.description} - ${formatCurrency(expense.amount)}`,
            html: emailHtml,
          }),
        });

        const emailResult = await emailResponse.json();
        const notificationStatus = emailResponse.ok ? "sent" : "failed";

        // Log notification to database
        await supabase.from("notifications").insert({
          company_id: expense.company_id,
          user_id: recipient.id,
          type: "email",
          category: "policy_violation",
          title: `Policy Violation: ${expense.description}`,
          message: `Expense of ${formatCurrency(expense.amount)} by ${submitterName} triggered ${violations.length} policy ${violations.length === 1 ? "violation" : "violations"}`,
          recipient_email: recipient.email,
          recipient_name: recipient.full_name,
          status: notificationStatus,
          metadata: { 
            expense_id: expenseId, 
            violations: violations.map(v => v.policyName),
            submitter_name: submitterName,
            amount: expense.amount
          },
          error_message: emailResponse.ok ? null : (emailResult.message || "Failed to send email"),
          created_by: expense.created_by,
        });

        return { recipient: recipient.email, success: emailResponse.ok, result: emailResult };
      } catch (err: any) {
        console.error(`Error sending to ${recipient.email}:`, err);
        return { recipient: recipient.email, success: false, error: err.message };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;

    console.log(`Sent ${successCount}/${recipients.length} policy violation notifications`);

    return new Response(JSON.stringify({ 
      success: true, 
      sent: successCount, 
      total: recipients.length,
      results 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-policy-violation-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
