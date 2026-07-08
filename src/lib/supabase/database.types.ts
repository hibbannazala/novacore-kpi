export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type KpiRole = "tim" | "head" | "hr" | "executive" | "developer";
export type KpiCategory = "quantity" | "quality";

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["departments"]["Row"], "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["departments"]["Insert"]>;
      };
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          kpi_role: KpiRole;
          department_id: string | null;
          position: string | null;
          photo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "created_at" | "updated_at"> & { created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      kpis: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          unit: string;
          category: KpiCategory;
          created_by: string | null;
          department_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["kpis"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["kpis"]["Insert"]>;
      };
      kpi_assignments: {
        Row: {
          id: string;
          user_id: string;
          kpi_id: string;
          year: number;
          month: number;
          monthly_target: number;
          actual_total: number;
          achievement_percentage: number;
          weight: number;
          notes: string | null;
          assigned_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["kpi_assignments"]["Row"], "id" | "actual_total" | "achievement_percentage" | "created_at" | "updated_at"> & { id?: string; actual_total?: number; achievement_percentage?: number; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["kpi_assignments"]["Insert"]>;
      };
      monthly_scores: {
        Row: {
          id: string;
          assignment_id: string;
          year: number;
          month: number;
          actual_total: number;
          monthly_target: number;
          achievement_percentage: number;
          inputted_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["monthly_scores"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["monthly_scores"]["Insert"]>;
      };
      daily_reports: {
        Row: {
          id: string;
          assignment_id: string;
          user_id: string;
          date: string;
          value: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["daily_reports"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["daily_reports"]["Insert"]>;
      };
      kpi_settings: {
        Row: {
          id: string;
          user_id: string;
          quantity_weight: number;
          quality_weight: number;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["kpi_settings"]["Row"], "id" | "updated_at"> & { id?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["kpi_settings"]["Insert"]>;
      };
      feedbacks: {
        Row: {
          id: string;
          user_id: string;
          user_name: string;
          department: string;
          role: string;
          type: "bug" | "feature" | "other";
          status: "open" | "in_progress" | "resolved" | "rejected";
          message: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["feedbacks"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["feedbacks"]["Insert"]>;
      };
      kpi_histories: {
        Row: {
          id: string;
          assignment_id: string | null;
          user_id: string | null;
          action: string;
          old_value: Json | null;
          new_value: Json | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["kpi_histories"]["Row"], "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["kpi_histories"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      my_kpi_role: {
        Args: Record<string, never>;
        Returns: KpiRole;
      };
    };
    Enums: Record<string, never>;
  };
}
