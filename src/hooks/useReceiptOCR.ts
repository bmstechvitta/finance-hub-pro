import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ExtractedReceiptData {
  vendor: string | null;
  amount: number | null;
  date: string | null;
  category: string | null;
}

export function useReceiptOCR() {
  const [isExtracting, setIsExtracting] = useState(false);

  const extractReceiptData = async (imageUrl: string): Promise<ExtractedReceiptData | null> => {
    setIsExtracting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("extract-receipt-data", {
        body: { imageUrl },
      });

      if (error) {
        console.error("OCR error:", error);
        toast({
          title: "Extraction failed",
          description: error.message || "Could not extract data from receipt",
          variant: "destructive",
        });
        return null;
      }

      if (data?.success && data?.data) {
        toast({
          title: "Data extracted",
          description: "Receipt information has been auto-filled",
        });
        return data.data;
      }

      if (data?.error) {
        toast({
          title: "Extraction failed",
          description: data.error,
          variant: "destructive",
        });
      }

      return null;
    } catch (error) {
      console.error("OCR error:", error);
      toast({
        title: "Extraction failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsExtracting(false);
    }
  };

  return { extractReceiptData, isExtracting };
}
