import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  receiptId: string;
  status: "verified" | "rejected";
  verificationNotes?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Receipt notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { receiptId, status, verificationNotes }: NotificationRequest = await req.json();
    console.log(`Processing notification for receipt ${receiptId}, status: ${status}`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch receipt details with creator's profile
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select(`
        id,
        receipt_number,
        vendor,
        amount,
        currency,
        receipt_date,
        created_by,
        company_id
      `)
      .eq("id", receiptId)
      .single();

    if (receiptError || !receipt) {
      console.error("Error fetching receipt:", receiptError);
      throw new Error("Receipt not found");
    }

    console.log("Receipt found:", receipt);

    // Fetch the submitter's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", receipt.created_by)
      .single();

    if (profileError || !profile?.email) {
      console.error("Error fetching profile:", profileError);
      throw new Error("Submitter profile or email not found");
    }

    console.log(`Sending notification to: ${profile.email}`);

    // Fetch company email settings
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("email_sender_name, email_reply_to, resend_api_key, name, email")
      .eq("id", receipt.company_id)
      .single();

    if (companyError) {
      console.warn("Error fetching company email settings:", companyError);
    }

    // Use company email settings or fallback to defaults
    const senderName = company?.email_sender_name || company?.name || "Receipts";
    const replyTo = company?.email_reply_to || company?.email || null;
    const fromEmail = company?.email || "onboarding@resend.dev";
    
    // Use company's Resend API key if configured, otherwise use environment variable
    const resendApiKey = company?.resend_api_key || RESEND_API_KEY;
    
    if (!resendApiKey) {
      throw new Error("Resend API key is not configured. Please set it in Settings > Email Settings.");
    }

    const isApproved = status === "verified";
    const statusText = isApproved ? "Approved" : "Rejected";
    const statusColor = isApproved ? "#22c55e" : "#ef4444";
    const formattedAmount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: receipt.currency || "USD",
    }).format(receipt.amount);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Receipt ${statusText}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background-color: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h1 style="margin: 0 0 24px 0; font-size: 24px; color: #111827;">
              Receipt ${statusText}
            </h1>
            
            <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background-color: ${statusColor}20; color: ${statusColor}; font-weight: 600; font-size: 14px; margin-bottom: 24px;">
              ${statusText}
            </div>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Hi ${profile.full_name || "there"},
            </p>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Your receipt has been <strong style="color: ${statusColor};">${status === "verified" ? "approved" : "rejected"}</strong>.
            </p>
            
            <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <h3 style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">
                Receipt Details
              </h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Receipt Number</td>
                  <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right; font-weight: 500;">${receipt.receipt_number}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Vendor</td>
                  <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right; font-weight: 500;">${receipt.vendor}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount</td>
                  <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right; font-weight: 500;">${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date</td>
                  <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right; font-weight: 500;">${new Date(receipt.receipt_date).toLocaleDateString()}</td>
                </tr>
              </table>
            </div>
            
            ${verificationNotes ? `
              <div style="background-color: ${isApproved ? "#f0fdf4" : "#fef2f2"}; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid ${statusColor};">
                <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #374151;">Notes from reviewer:</h4>
                <p style="margin: 0; color: #4b5563; font-size: 14px;">${verificationNotes}</p>
              </div>
            ` : ""}
            
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              This is an automated notification from your expense management system.
            </p>
          </div>
        </body>
      </html>
    `;

    // Send email using Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${senderName} <${fromEmail}>`,
        reply_to: replyTo || undefined,
        to: [profile.email],
        subject: `Receipt ${receipt.receipt_number} has been ${statusText.toLowerCase()}`,
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend API error:", emailResult);
      throw new Error(emailResult.message || "Failed to send email");
    }

    console.log("Email sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true, emailResult }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-receipt-notification:", error);
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
