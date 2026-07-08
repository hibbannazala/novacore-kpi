export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type KpiRole = "tim" | "head" | "hr" | "executive" | "developer";
export type KpiCategory = "quantity" | "quality";

type GenericRelationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: GenericRelationship[];
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
          managed_departments: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          kpi_role?: KpiRole;
          department_id?: string | null;
          position?: string | null;
          photo_url?: string | null;
          managed_departments?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          kpi_role?: KpiRole;
          department_id?: string | null;
          position?: string | null;
          photo_url?: string | null;
          managed_departments?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: GenericRelationship[];
      };
      kpis: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          type: "result" | "activity" | "quality";
          unit: string;
          period: string;
          category: KpiCategory;
          brand: string | null;
          status: string;
          monthly_target: number;
          year: number;
          month: number;
          created_by: string | null;
          department_id: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          type?: "result" | "activity" | "quality";
          unit?: string;
          period?: string;
          category?: KpiCategory;
          brand?: string | null;
          status?: string;
          monthly_target?: number;
          year?: number;
          month?: number;
          created_by?: string | null;
          department_id?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          type?: "result" | "activity" | "quality";
          unit?: string;
          period?: string;
          category?: KpiCategory;
          brand?: string | null;
          status?: string;
          monthly_target?: number;
          year?: number;
          month?: number;
          created_by?: string | null;
          department_id?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: GenericRelationship[];
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
          status: string;
          department_id: string | null;
          assigned_by: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kpi_id: string;
          year: number;
          month: number;
          monthly_target?: number;
          actual_total?: number;
          achievement_percentage?: number;
          weight?: number;
          notes?: string | null;
          status?: string;
          department_id?: string | null;
          assigned_by?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          kpi_id?: string;
          year?: number;
          month?: number;
          monthly_target?: number;
          actual_total?: number;
          achievement_percentage?: number;
          weight?: number;
          notes?: string | null;
          status?: string;
          department_id?: string | null;
          assigned_by?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: GenericRelationship[];
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
        Insert: {
          id?: string;
          assignment_id: string;
          year: number;
          month: number;
          actual_total: number;
          monthly_target?: number;
          achievement_percentage?: number;
          inputted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          assignment_id?: string;
          year?: number;
          month?: number;
          actual_total?: number;
          monthly_target?: number;
          achievement_percentage?: number;
          inputted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: GenericRelationship[];
      };
      daily_reports: {
        Row: {
          id: string;
          assignment_id: string;
          kpi_id: string | null;
          user_id: string;
          date: string;
          value: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          kpi_id?: string | null;
          user_id: string;
          date: string;
          value: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          assignment_id?: string;
          kpi_id?: string | null;
          user_id?: string;
          date?: string;
          value?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: GenericRelationship[];
      };
      kpi_settings: {
        Row: {
          id: string;
          user_id: string;
          result_weight: number;
          activity_weight: number;
          quality_weight: number;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          result_weight?: number;
          activity_weight?: number;
          quality_weight?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          result_weight?: number;
          activity_weight?: number;
          quality_weight?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: GenericRelationship[];
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
        Insert: {
          id?: string;
          user_id: string;
          user_name: string;
          department: string;
          role: string;
          type: "bug" | "feature" | "other";
          status?: "open" | "in_progress" | "resolved" | "rejected";
          message: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          user_name?: string;
          department?: string;
          role?: string;
          type?: "bug" | "feature" | "other";
          status?: "open" | "in_progress" | "resolved" | "rejected";
          message?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: GenericRelationship[];
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
        Insert: {
          id?: string;
          assignment_id?: string | null;
          user_id?: string | null;
          action: string;
          old_value?: Json | null;
          new_value?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          assignment_id?: string | null;
          user_id?: string | null;
          action?: string;
          old_value?: Json | null;
          new_value?: Json | null;
          created_at?: string;
        };
        Relationships: GenericRelationship[];
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
