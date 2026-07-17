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
          absensi_role: "staff" | "admin";
          absensi_status: "active" | "pending" | "rejected" | "resigned" | "deleted";
          leave_quota: number;
          sick_quota: number;
          is_hidden: boolean;
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
          absensi_role?: "staff" | "admin";
          absensi_status?: "active" | "pending" | "rejected" | "resigned" | "deleted";
          leave_quota?: number;
          sick_quota?: number;
          is_hidden?: boolean;
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
          absensi_role?: "staff" | "admin";
          absensi_status?: "active" | "pending" | "rejected" | "resigned" | "deleted";
          leave_quota?: number;
          sick_quota?: number;
          is_hidden?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: GenericRelationship[];
      };
      attendance: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          check_in: string | null;
          check_out: string | null;
          status: "on_time" | "late" | "very_late" | "auto_checkout";
          type: "WFO" | "WFA";
          location_in: Json | null;
          location_status: string | null;
          late_fine: number;
          late_reason: string;
          late_reason_status: "pending" | "accepted" | "rejected" | null;
          radius_penalty: number;
          early_checkout: boolean;
          early_reason: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          check_in?: string | null;
          check_out?: string | null;
          status?: "on_time" | "late" | "very_late" | "auto_checkout";
          type?: "WFO" | "WFA";
          location_in?: Json | null;
          location_status?: string | null;
          late_fine?: number;
          late_reason?: string;
          late_reason_status?: "pending" | "accepted" | "rejected" | null;
          radius_penalty?: number;
          early_checkout?: boolean;
          early_reason?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          check_in?: string | null;
          check_out?: string | null;
          status?: "on_time" | "late" | "very_late" | "auto_checkout";
          type?: "WFO" | "WFA";
          location_in?: Json | null;
          location_status?: string | null;
          late_fine?: number;
          late_reason?: string;
          late_reason_status?: "pending" | "accepted" | "rejected" | null;
          radius_penalty?: number;
          early_checkout?: boolean;
          early_reason?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: GenericRelationship[];
      };
      leave_requests: {
        Row: {
          id: string;
          user_id: string;
          type: "leave" | "sick" | "wfa";
          dates: string[];
          reason: string;
          status: "pending" | "approved" | "rejected" | "cancelled";
          processed_by: string | null;
          processed_at: string | null;
          deducted_sick: number;
          deducted_leave: number;
          cancellation_requested: boolean;
          cancellation_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: "leave" | "sick" | "wfa";
          dates?: string[];
          reason?: string;
          status?: "pending" | "approved" | "rejected" | "cancelled";
          processed_by?: string | null;
          processed_at?: string | null;
          deducted_sick?: number;
          deducted_leave?: number;
          cancellation_requested?: boolean;
          cancellation_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: "leave" | "sick" | "wfa";
          dates?: string[];
          reason?: string;
          status?: "pending" | "approved" | "rejected" | "cancelled";
          processed_by?: string | null;
          processed_at?: string | null;
          deducted_sick?: number;
          deducted_leave?: number;
          cancellation_requested?: boolean;
          cancellation_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: GenericRelationship[];
      };
      holidays: {
        Row: {
          id: string;
          date: string;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          description?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          description?: string;
          created_at?: string;
        };
        Relationships: GenericRelationship[];
      };
      absensi_settings: {
        Row: {
          id: number;
          work_start: string;
          work_end: string;
          max_late: string;
          max_time_sick: string;
          max_time_leave: string;
          max_time_wfa: string;
          office_lat: number;
          office_lng: number;
          office_radius: number;
          last_sync_date: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          work_start?: string;
          work_end?: string;
          max_late?: string;
          max_time_sick?: string;
          max_time_leave?: string;
          max_time_wfa?: string;
          office_lat?: number;
          office_lng?: number;
          office_radius?: number;
          last_sync_date?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          work_start?: string;
          work_end?: string;
          max_late?: string;
          max_time_sick?: string;
          max_time_leave?: string;
          max_time_wfa?: string;
          office_lat?: number;
          office_lng?: number;
          office_radius?: number;
          last_sync_date?: string | null;
          updated_at?: string;
        };
        Relationships: GenericRelationship[];
      };
      absensi_logs: {
        Row: {
          id: string;
          actor: string;
          action: string;
          target_user_id: string | null;
          details: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor?: string;
          action: string;
          target_user_id?: string | null;
          details?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor?: string;
          action?: string;
          target_user_id?: string | null;
          details?: string | null;
          created_at?: string;
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
      process_leave_request: {
        Args: { p_request_id: string; p_action: string; p_admin_name: string };
        Returns: void;
      };
      process_leave_cancellation: {
        Args: { p_request_id: string; p_action: string; p_admin_name: string };
        Returns: void;
      };
      is_absensi_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
}
