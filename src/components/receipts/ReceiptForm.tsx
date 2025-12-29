import { useState } from "react";
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
import { Loader2 } from "lucide-react";

const receiptSchema = z.object({
  receipt_number: z.string().min(1, "Receipt number is required"),
  vendor: z.string().min(1, "Vendor name is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  category: z.string().optional(),
  description: z.string().optional(),
  receipt_date: z.string().min(1, "Date is required"),
});

type ReceiptFormData = z.infer<typeof receiptSchema>;

interface ReceiptFormProps {
  onSuccess?: () => void;
  initialFileUrl?: string;
}

const categories = [
  "Office Supplies",
  "Technology",
  "Travel",
  "Meals & Entertainment",
  "Utilities",
  "Shipping",
  "Marketing",
  "Professional Services",
  "Other",
];

export function ReceiptForm({ onSuccess, initialFileUrl }: ReceiptFormProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(initialFileUrl || null);
  const createReceipt = useCreateReceipt();

  const form = useForm<ReceiptFormData>({
    resolver: zodResolver(receiptSchema),
    defaultValues: {
      receipt_number: `RCP-${Date.now().toString().slice(-6)}`,
      vendor: "",
      amount: 0,
      category: "",
      description: "",
      receipt_date: new Date().toISOString().split("T")[0],
    },
  });

  const onSubmit = async (data: ReceiptFormData) => {
    await createReceipt.mutateAsync({
      receipt_number: data.receipt_number,
      vendor: data.vendor,
      amount: data.amount,
      category: data.category || null,
      description: data.description || null,
      receipt_date: data.receipt_date,
      file_url: fileUrl,
      status: "pending",
    });
    onSuccess?.();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FileUploadZone
          onUploadComplete={(url) => setFileUrl(url)}
          className="mb-4"
        />

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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

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
