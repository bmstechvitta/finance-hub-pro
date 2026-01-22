import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";

export interface Notification {
  id: string;
  company_id: string | null;
  user_id: string | null;
  type: string;
  category: string;
  title: string;
  message: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  status: string;
  metadata: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  created_by: string | null;
}

export function useNotifications(limit = 50) {
  const queryClient = useQueryClient();

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel("notifications-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          console.log("Notification change received:", payload.eventType);
          // Invalidate queries to refresh the data
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          queryClient.invalidateQueries({ queryKey: ["notification-stats"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["notifications", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as Notification[];
    },
  });
}

export function useNotificationStats() {
  return useQuery({
    queryKey: ["notification-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, status, type, category, created_at");

      if (error) throw error;

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);

      const total = data?.length || 0;
      const sent = data?.filter((n) => n.status === "sent").length || 0;
      const failed = data?.filter((n) => n.status === "failed").length || 0;
      const todayCount = data?.filter(
        (n) => new Date(n.created_at) >= startOfDay
      ).length || 0;
      const weekCount = data?.filter(
        (n) => new Date(n.created_at) >= startOfWeek
      ).length || 0;

      // Count by category
      const byCategory = data?.reduce((acc, n) => {
        acc[n.category] = (acc[n.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return { total, sent, failed, todayCount, weekCount, byCategory };
    },
  });
}

export function useClearNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get user's company_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) {
        throw new Error("Company not found");
      }

      // Delete all notifications for the company
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("company_id", profile.company_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notification-stats"] });
      toast({
        title: "Notifications cleared",
        description: "All notifications have been cleared successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to clear notifications",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
