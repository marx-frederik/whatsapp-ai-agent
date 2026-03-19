export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          customer_number: string;
          company_name: string;
          contact_name: string | null;
          phone: string | null;
          email: string | null;
          street: string | null;
          city: string | null;
          postal_code: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_number: string;
          company_name: string;
          contact_name?: string | null;
          phone?: string | null;
          email?: string | null;
          street?: string | null;
          city?: string | null;
          postal_code?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_number?: string;
          company_name?: string;
          contact_name?: string | null;
          phone?: string | null;
          email?: string | null;
          street?: string | null;
          city?: string | null;
          postal_code?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          customer_id: string;
          type: string;
          status: string;
          requested_date: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_number: string;
          customer_id: string;
          type: string;
          status?: string;
          requested_date?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          customer_id?: string;
          type?: string;
          status?: string;
          requested_date?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          sku: string | null;
          name: string;
          quantity: number;
          unit: string;
          unit_price: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          sku?: string | null;
          name: string;
          quantity: number;
          unit?: string;
          unit_price?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          sku?: string | null;
          name?: string;
          quantity?: number;
          unit?: string;
          unit_price?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
