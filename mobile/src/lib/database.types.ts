export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.15';
  };
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          completed_at: string | null;
          requested_at: string;
          staff_note: string | null;
          status: 'completed' | 'in_review' | 'requested';
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          requested_at?: string;
          staff_note?: string | null;
          status?: 'completed' | 'in_review' | 'requested';
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          staff_note?: string | null;
          status?: 'completed' | 'in_review' | 'requested';
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_events: {
        Row: {
          action: 'delete' | 'insert' | 'update';
          actor_kind: 'customer' | 'staff' | 'system';
          actor_user_id: string | null;
          customer_id: string | null;
          id: number;
          occurred_at: string;
          record_id: string;
          table_name: string;
        };
        Insert: Record<never, never>;
        Update: Record<never, never>;
        Relationships: [];
      };
      booking_integration_jobs: {
        Row: {
          attempt_count: number;
          available_at: string;
          booking_request_id: string;
          completed_at: string | null;
          created_at: string;
          customer_id: string;
          dedupe_key: string;
          id: string;
          job_kind: 'notify_customer_booking_confirmed' | 'notify_customer_cancelled' | 'notify_customer_date_approved' | 'notify_customer_date_proposed' | 'notify_customer_request_received' | 'notify_psi_booking_confirmed' | 'notify_psi_request_received' | 'sync_google_calendar_confirmed';
          last_attempt_at: string | null;
          last_error_code: string | null;
          provider_reference: string | null;
          status: 'blocked_configuration' | 'cancelled' | 'failed' | 'pending' | 'processing' | 'succeeded';
          updated_at: string;
        };
        Insert: Record<never, never>;
        Update: Record<never, never>;
        Relationships: [];
      };
      booking_requests: {
        Row: {
          archived_at: string | null;
          approved_date: string | null;
          booking_type: 'dyno' | 'service';
          client_request_id: string;
          created_at: string;
          created_by: string;
          currency: 'AUD';
          customer_id: string;
          deposit_amount_cents: number | null;
          id: string;
          preferred_date: string | null;
          request_context: Record<string, unknown>;
          request_notes: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          staff_note: string | null;
          state: 'cancelled' | 'completed' | 'confirmed' | 'date_approved' | 'date_proposed' | 'pending_staff_review';
          updated_at: string;
          vehicle_id: string;
        };
        Insert: {
          archived_at?: string | null;
          approved_date?: string | null;
          booking_type: 'dyno' | 'service';
          client_request_id?: string;
          created_at?: string;
          created_by: string;
          currency?: 'AUD';
          customer_id: string;
          deposit_amount_cents?: number | null;
          id?: string;
          preferred_date?: string | null;
          request_context?: Record<string, unknown>;
          request_notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          staff_note?: string | null;
          state?: 'cancelled' | 'completed' | 'confirmed' | 'date_approved' | 'date_proposed' | 'pending_staff_review';
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          archived_at?: string | null;
          approved_date?: string | null;
          deposit_amount_cents?: number | null;
          preferred_date?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          staff_note?: string | null;
          state?: 'cancelled' | 'completed' | 'confirmed' | 'date_approved' | 'date_proposed' | 'pending_staff_review';
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_profiles: {
        Row: {
          account_state: string;
          created_at: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          mobile: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_state?: string;
          created_at?: string;
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          mobile?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_state?: string;
          email?: string;
          first_name?: string | null;
          last_name?: string | null;
          mobile?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_vehicles: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string;
          customer_id: string;
          id: string;
          is_primary: boolean;
          make: string;
          model: string;
          nickname: string | null;
          odometer_km: number | null;
          registration: string;
          updated_at: string;
          vin_last_four: string | null;
          year: number;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by: string;
          customer_id: string;
          id?: string;
          is_primary?: boolean;
          make: string;
          model: string;
          nickname?: string | null;
          odometer_km?: number | null;
          registration: string;
          updated_at?: string;
          vin_last_four?: string | null;
          year: number;
        };
        Update: {
          archived_at?: string | null;
          is_primary?: boolean;
          make?: string;
          model?: string;
          nickname?: string | null;
          odometer_km?: number | null;
          registration?: string;
          updated_at?: string;
          vin_last_four?: string | null;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_vehicles_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customer_profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      dyno_records: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string;
          customer_id: string;
          fuel: string | null;
          id: string;
          notes: string | null;
          power_kw_at_hubs: number;
          record_source: 'customer_entry' | 'psi_verified';
          tested_at: string;
          torque_nm_at_hubs: number | null;
          updated_at: string;
          vehicle_id: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by: string;
          customer_id: string;
          fuel?: string | null;
          id?: string;
          notes?: string | null;
          power_kw_at_hubs: number;
          record_source: 'customer_entry' | 'psi_verified';
          tested_at: string;
          torque_nm_at_hubs?: number | null;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          archived_at?: string | null;
          fuel?: string | null;
          notes?: string | null;
          power_kw_at_hubs?: number;
          tested_at?: string;
          torque_nm_at_hubs?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          amount_cents: number | null;
          archived_at: string | null;
          created_at: string;
          created_by: string;
          currency: 'AUD';
          customer_id: string;
          id: string;
          invoice_date: string;
          invoice_number: string;
          summary: string;
          updated_at: string;
          vehicle_id: string;
        };
        Insert: {
          amount_cents?: number | null;
          archived_at?: string | null;
          created_at?: string;
          created_by: string;
          currency?: 'AUD';
          customer_id: string;
          id?: string;
          invoice_date: string;
          invoice_number: string;
          summary: string;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          amount_cents?: number | null;
          archived_at?: string | null;
          currency?: 'AUD';
          invoice_date?: string;
          invoice_number?: string;
          summary?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_events: {
        Row: {
          body: string;
          booking_request_id: string | null;
          created_at: string;
          deep_link: '/bookings' | '/staff';
          id: string;
          kind: 'booking_cancelled' | 'booking_completed' | 'booking_confirmed' | 'booking_date_approved' | 'booking_date_proposed' | 'booking_request_received' | 'new_booking_request';
          read_at: string | null;
          recipient_user_id: string;
          source_event_key: string;
          title: string;
        };
        Insert: Record<never, never>;
        Update: { read_at?: string | null };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          booking_reminders_enabled: boolean;
          booking_updates_enabled: boolean;
          created_at: string;
          sound_enabled: boolean;
          updated_at: string;
          user_id: string;
          workshop_alerts_enabled: boolean;
        };
        Insert: {
          booking_reminders_enabled?: boolean;
          booking_updates_enabled?: boolean;
          sound_enabled?: boolean;
          updated_at?: string;
          user_id: string;
          workshop_alerts_enabled?: boolean;
        };
        Update: {
          booking_reminders_enabled?: boolean;
          booking_updates_enabled?: boolean;
          sound_enabled?: boolean;
          updated_at?: string;
          workshop_alerts_enabled?: boolean;
        };
        Relationships: [];
      };
      push_devices: {
        Row: {
          created_at: string;
          enabled: boolean;
          expo_push_token: string;
          id: string;
          last_seen_at: string;
          platform: 'android' | 'ios';
          updated_at: string;
          user_id: string;
        };
        Insert: {
          enabled?: boolean;
          expo_push_token: string;
          id?: string;
          last_seen_at?: string;
          platform: 'android' | 'ios';
          updated_at?: string;
          user_id: string;
        };
        Update: { enabled?: boolean; last_seen_at?: string; updated_at?: string };
        Relationships: [];
      };
      push_notification_jobs: {
        Row: {
          attempt_count: number;
          available_at: string;
          booking_request_id: string | null;
          completed_at: string | null;
          created_at: string;
          event_id: string;
          id: string;
          last_attempt_at: string | null;
          last_error_code: string | null;
          provider_ticket_id: string | null;
          recipient_user_id: string;
          status: 'cancelled' | 'failed' | 'pending' | 'processing' | 'succeeded';
          updated_at: string;
        };
        Insert: Record<never, never>;
        Update: Record<never, never>;
        Relationships: [];
      };
      odometer_readings: {
        Row: {
          created_at: string;
          created_by: string;
          customer_id: string;
          id: string;
          reading_km: number;
          recorded_at: string;
          record_source: 'customer_entry' | 'psi_record';
          service_completion_id: string | null;
          vehicle_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          customer_id: string;
          id?: string;
          reading_km: number;
          recorded_at?: string;
          record_source: 'customer_entry' | 'psi_record';
          service_completion_id?: string | null;
          vehicle_id: string;
        };
        Update: Record<never, never>;
        Relationships: [];
      };
      recommended_work: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string;
          customer_id: string;
          id: string;
          notes: string | null;
          record_source: 'customer_entry' | 'psi_record';
          status: 'due_soon' | 'monitor' | 'priority' | 'recommended';
          timing: string | null;
          title: string;
          updated_at: string;
          vehicle_id: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by: string;
          customer_id: string;
          id?: string;
          notes?: string | null;
          record_source: 'customer_entry' | 'psi_record';
          status: 'due_soon' | 'monitor' | 'priority' | 'recommended';
          timing?: string | null;
          title: string;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          archived_at?: string | null;
          notes?: string | null;
          status?: 'due_soon' | 'monitor' | 'priority' | 'recommended';
          timing?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      repair_records: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string;
          customer_id: string;
          id: string;
          notes: string | null;
          odometer_km: number | null;
          record_kind: 'inspection' | 'repair' | 'service';
          record_source: 'customer_entry' | 'psi_record';
          repair_date: string;
          service_completion_id: string | null;
          title: string;
          updated_at: string;
          vehicle_id: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by: string;
          customer_id: string;
          id?: string;
          notes?: string | null;
          odometer_km?: number | null;
          record_kind?: 'inspection' | 'repair' | 'service';
          record_source: 'customer_entry' | 'psi_record';
          repair_date: string;
          service_completion_id?: string | null;
          title: string;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          archived_at?: string | null;
          notes?: string | null;
          odometer_km?: number | null;
          record_kind?: 'inspection' | 'repair' | 'service';
          repair_date?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_completions: {
        Row: {
          booking_request_id: string;
          completed_at: string;
          created_at: string;
          created_by: string;
          customer_id: string;
          id: string;
          next_check_in_date: string | null;
          next_check_in_odometer_km: number | null;
          odometer_km: number | null;
          summary: string;
          vehicle_id: string;
        };
        Insert: {
          booking_request_id: string;
          completed_at?: string;
          created_at?: string;
          created_by: string;
          customer_id: string;
          id?: string;
          next_check_in_date?: string | null;
          next_check_in_odometer_km?: number | null;
          odometer_km?: number | null;
          summary: string;
          vehicle_id: string;
        };
        Update: Record<never, never>;
        Relationships: [];
      };
      staff_members: {
        Row: {
          activated_at: string | null;
          created_at: string;
          email: string;
          id: string;
          invited_at: string;
          role: 'owner' | 'staff';
          status: 'active' | 'disabled' | 'pending';
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          activated_at?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          invited_at?: string;
          role: 'owner' | 'staff';
          status?: 'active' | 'disabled' | 'pending';
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          activated_at?: string | null;
          email?: string;
          role?: 'owner' | 'staff';
          status?: 'active' | 'disabled' | 'pending';
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      vehicle_files: {
        Row: {
          archived_at: string | null;
          bucket_id: 'vehicle-documents' | 'vehicle-photos';
          created_at: string;
          created_by: string;
          customer_id: string;
          dyno_record_id: string | null;
          file_kind: 'dyno_graph' | 'invoice' | 'repair_document' | 'vehicle_photo';
          file_size_bytes: number;
          id: string;
          invoice_id: string | null;
          mime_type: string;
          object_path: string;
          record_source: 'customer_entry' | 'psi_record';
          updated_at: string;
          vehicle_id: string;
        };
        Insert: {
          archived_at?: string | null;
          bucket_id: 'vehicle-documents' | 'vehicle-photos';
          created_at?: string;
          created_by: string;
          customer_id: string;
          dyno_record_id?: string | null;
          file_kind: 'dyno_graph' | 'invoice' | 'repair_document' | 'vehicle_photo';
          file_size_bytes: number;
          id?: string;
          invoice_id?: string | null;
          mime_type: string;
          object_path: string;
          record_source: 'customer_entry' | 'psi_record';
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          archived_at?: string | null;
          bucket_id?: 'vehicle-documents' | 'vehicle-photos';
          dyno_record_id?: string | null;
          file_kind?: 'dyno_graph' | 'invoice' | 'repair_document' | 'vehicle_photo';
          file_size_bytes?: number;
          invoice_id?: string | null;
          mime_type?: string;
          object_path?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      vehicle_service_summary: {
        Row: {
          customer_id: string | null;
          latest_customer_odometer_km: number | null;
          latest_customer_odometer_recorded_at: string | null;
          latest_psi_odometer_km: number | null;
          latest_psi_service_at: string | null;
          next_psi_check_in_date: string | null;
          next_psi_check_in_odometer_km: number | null;
          vehicle_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export type AccountDeletionRequestRow = Database['public']['Tables']['account_deletion_requests']['Row'];
export type CustomerProfileRow = Database['public']['Tables']['customer_profiles']['Row'];
export type AuditEventRow = Database['public']['Tables']['audit_events']['Row'];
export type BookingIntegrationJobRow = Database['public']['Tables']['booking_integration_jobs']['Row'];
export type CustomerVehicleRow = Database['public']['Tables']['customer_vehicles']['Row'];
export type BookingRequestRow = Database['public']['Tables']['booking_requests']['Row'];
export type DynoRecordRow = Database['public']['Tables']['dyno_records']['Row'];
export type InvoiceRow = Database['public']['Tables']['invoices']['Row'];
export type NotificationEventRow = Database['public']['Tables']['notification_events']['Row'];
export type NotificationPreferenceRow = Database['public']['Tables']['notification_preferences']['Row'];
export type OdometerReadingRow = Database['public']['Tables']['odometer_readings']['Row'];
export type RecommendedWorkRow = Database['public']['Tables']['recommended_work']['Row'];
export type RepairRecordRow = Database['public']['Tables']['repair_records']['Row'];
export type ServiceCompletionRow = Database['public']['Tables']['service_completions']['Row'];
export type StaffMemberRow = Database['public']['Tables']['staff_members']['Row'];
export type VehicleFileRow = Database['public']['Tables']['vehicle_files']['Row'];
export type VehicleServiceSummaryRow = Database['public']['Views']['vehicle_service_summary']['Row'];
