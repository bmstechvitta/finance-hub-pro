import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Tables, TablesUpdate } from "@/integrations/supabase/types";

export type Company = Tables<"companies">;

export function useCompany() {
  return useQuery({
    queryKey: ["company"],
    queryFn: async () => {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return null;
      }

      // Get profile for current user
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.company_id) {
        return null;
      }

      // Get company data
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", profile.company_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: TablesUpdate<"companies"> & { id: string }) => {
      const { id, ...data } = updates;
      const { error } = await supabase
        .from("companies")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast({
        title: "Settings saved",
        description: "Company profile has been updated",
      });
    },
    onError: (error) => {
      console.error("Failed to update company:", error);
      toast({
        title: "Error",
        description: "Failed to save company settings",
        variant: "destructive",
      });
    },
  });
}

export function useUploadCompanyLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ companyId, file }: { companyId: string; file: File }) => {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload a JPEG, PNG, WebP, or SVG image.');
      }

      // Validate file size (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error('File size exceeds 5MB limit.');
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${companyId}/logo.${fileExt}`;

      // Upload to company-assets storage bucket
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("company-assets")
        .upload(fileName, file, { 
          upsert: true,
          contentType: file.type 
        });

      if (uploadError) {
        // Provide more helpful error messages
        if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('does not exist')) {
          throw new Error('Storage bucket not configured. Please contact your administrator to set up the company-assets bucket.');
        }
        if (uploadError.message.includes('new row violates row-level security policy')) {
          throw new Error('You do not have permission to upload company logos. Admin or Finance Manager role required.');
        }
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("company-assets")
        .getPublicUrl(fileName);

      // Update company with logo URL
      const { error: updateError } = await supabase
        .from("companies")
        .update({ logo_url: publicUrl })
        .eq("id", companyId);

      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast({
        title: "Logo uploaded",
        description: "Company logo has been updated",
      });
    },
    onError: (error: any) => {
      console.error("Failed to upload logo:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload company logo. Please ensure you have admin or finance manager permissions.",
        variant: "destructive",
      });
    },
  });
}
