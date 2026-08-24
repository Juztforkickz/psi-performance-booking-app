export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.15';
  };
  public: {
    Tables: {
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

export type CustomerProfileRow = Database['public']['Tables']['customer_profiles']['Row'];
export type CustomerVehicleRow = Database['public']['Tables']['customer_vehicles']['Row'];
export type DynoRecordRow = Database['public']['Tables']['dyno_records']['Row'];
export type InvoiceRow = Database['public']['Tables']['invoices']['Row'];
export type OdometerReadingRow = Database['public']['Tables']['odometer_readings']['Row'];
export type RecommendedWorkRow = Database['public']['Tables']['recommended_work']['Row'];
export type RepairRecordRow = Database['public']['Tables']['repair_records']['Row'];
export type VehicleServiceSummaryRow = Database['public']['Views']['vehicle_service_summary']['Row'];
