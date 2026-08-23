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
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export type CustomerProfileRow = Database['public']['Tables']['customer_profiles']['Row'];
export type CustomerVehicleRow = Database['public']['Tables']['customer_vehicles']['Row'];
