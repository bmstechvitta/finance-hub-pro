import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "Image URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Extracting receipt data from image:", imageUrl);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a receipt OCR assistant. Extract the following information from receipt images:
- vendor: The store or company name
- amount: The total amount (just the number, no currency symbol)
- date: The date in YYYY-MM-DD format
- category: Best matching category from: Office Supplies, Technology, Travel, Meals & Entertainment, Utilities, Shipping, Marketing, Professional Services, Other

Respond ONLY with a JSON object containing these fields. If a field cannot be determined, use null.
Example: {"vendor": "Staples", "amount": 45.99, "date": "2024-01-15", "category": "Office Supplies"}`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract the vendor name, total amount, date, and category from this receipt image."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_receipt_data",
              description: "Extract structured data from a receipt image",
              parameters: {
                type: "object",
                properties: {
                  vendor: {
                    type: "string",
                    description: "The store or company name on the receipt"
                  },
                  amount: {
                    type: "number",
                    description: "The total amount paid (just the number)"
                  },
                  date: {
                    type: "string",
                    description: "The date of the transaction in YYYY-MM-DD format"
                  },
                  category: {
                    type: "string",
                    enum: ["Office Supplies", "Technology", "Travel", "Meals & Entertainment", "Utilities", "Shipping", "Marketing", "Professional Services", "Other"],
                    description: "The best matching expense category"
                  }
                },
                required: ["vendor", "amount", "date", "category"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_receipt_data" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        console.error("Payment required");
        return new Response(
          JSON.stringify({ error: "AI service requires payment. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to process receipt" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data));

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall && toolCall.function?.arguments) {
      const extractedData = JSON.parse(toolCall.function.arguments);
      console.log("Extracted receipt data:", extractedData);
      
      return new Response(
        JSON.stringify({ success: true, data: extractedData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: try to parse from message content
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const extractedData = JSON.parse(jsonMatch[0]);
          console.log("Extracted from content:", extractedData);
          return new Response(
            JSON.stringify({ success: true, data: extractedData }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (parseError) {
        console.error("Failed to parse content:", parseError);
      }
    }

    return new Response(
      JSON.stringify({ error: "Could not extract data from receipt" }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing receipt:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
