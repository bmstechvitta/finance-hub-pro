import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUploadZone } from "./FileUploadZone";
import { useCreateReceipt } from "@/hooks/useReceipts";
import { useReceiptOCR } from "@/hooks/useReceiptOCR";
import { useReceiptCategories, useCreateReceiptCategory } from "@/hooks/useReceiptCategories";
import { Loader2, Sparkles } from "lucide-react";

const receiptSchema = z.object({
  receipt_number: z.string().min(1, "Receipt number is required"),
  vendor: z.string().min(1, "Vendor name is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  category: z.string().optional(),
  customCategory: z.string().optional(),
  description: z.string().optional(),
  receipt_date: z.string().min(1, "Date is required"),
});

type ReceiptFormData = z.infer<typeof receiptSchema>;

interface ReceiptFormProps {
  onSuccess?: () => void;
  initialFileUrl?: string;
}

export function ReceiptForm({ onSuccess, initialFileUrl }: ReceiptFormProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(initialFileUrl || null);
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const { data: categoriesData } = useReceiptCategories();
  const createReceipt = useCreateReceipt();
  const createCategory = useCreateReceiptCategory();
  const { extractReceiptData, isExtracting } = useReceiptOCR();

  // Get all categories (default + custom from database)
  const allCategories = categoriesData?.all || [];

  const form = useForm<ReceiptFormData>({
    resolver: zodResolver(receiptSchema),
    defaultValues: {
      receipt_number: `RCP-${Date.now().toString().slice(-6)}`,
      vendor: "",
      amount: 0,
      category: "",
      customCategory: "",
      description: "",
      receipt_date: new Date().toISOString().split("T")[0],
    },
  });

  const selectedCategory = form.watch("category");
  
  // Show custom input when "Other" is selected
  useEffect(() => {
    setShowCustomCategoryInput(selectedCategory === "Other");
    if (selectedCategory !== "Other") {
      form.setValue("customCategory", "");
    }
  }, [selectedCategory, form]);

  const onSubmit = async (data: ReceiptFormData) => {
    // If "Other" is selected and custom category is provided, use custom category
    let finalCategory = data.category;
    if (data.category === "Other" && data.customCategory?.trim()) {
      finalCategory = data.customCategory.trim();
      // Save custom category to database for future use
      try {
        await createCategory.mutateAsync(finalCategory);
      } catch (error) {
        console.error("Failed to save custom category:", error);
        // Continue with receipt creation even if category save fails
      }
    }

    await createReceipt.mutateAsync({
      receipt_number: data.receipt_number,
      vendor: data.vendor,
      amount: data.amount,
      category: finalCategory || null,
      description: data.description || null,
      receipt_date: data.receipt_date,
      file_url: fileUrl,
      status: "pending",
    });
    
    // Reset form
    form.reset();
    setFileUrl(null);
    setShowCustomCategoryInput(false);
    onSuccess?.();
  };

  const handleUploadComplete = async (url: string) => {
    setFileUrl(url);
    
    // Only extract from images, not PDFs
    if (url && !url.toLowerCase().endsWith('.pdf')) {
      const extractedData = await extractReceiptData(url);
      if (extractedData) {
        if (extractedData.vendor) {
          form.setValue("vendor", extractedData.vendor);
        }
        if (extractedData.amount) {
          form.setValue("amount", extractedData.amount);
        }
        if (extractedData.date) {
          form.setValue("receipt_date", extractedData.date);
        }
        if (extractedData.category) {
          // Check if it's in default or custom categories
          if (allCategories.includes(extractedData.category)) {
            form.setValue("category", extractedData.category);
          } else {
            // Set as custom category
            form.setValue("category", "Other");
            form.setValue("customCategory", extractedData.category);
            setShowCustomCategoryInput(true);
          }
        }
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <FileUploadZone
            onUploadComplete={handleUploadComplete}
            className="mb-2"
          />
          {isExtracting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
              <Sparkles className="h-4 w-4" />
              <span>Extracting receipt data with AI...</span>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="receipt_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Receipt Number</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="vendor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vendor</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Office Depot" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="receipt_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {allCategories.length > 0 ? (
                    allCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="loading" disabled>
                      Loading categories...
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {showCustomCategoryInput && (
          <FormField
            control={form.control}
            name="customCategory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Custom Category</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter custom category name"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Add notes about this receipt..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={createReceipt.isPending}
        >
          {createReceipt.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Save Receipt
        </Button>
      </form>
    </Form>
  );
}
