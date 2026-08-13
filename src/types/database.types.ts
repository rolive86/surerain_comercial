export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      attributes: {
        Row: {
          created_at: string
          data_type: string
          filterable: boolean
          id: string
          name: string
          slug: string
          unit: string | null
        }
        Insert: {
          created_at?: string
          data_type?: string
          filterable?: boolean
          id?: string
          name: string
          slug: string
          unit?: string | null
        }
        Update: {
          created_at?: string
          data_type?: string
          filterable?: boolean
          id?: string
          name?: string
          slug?: string
          unit?: string | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          logo_media_id: string | null
          name: string
          slug: string
          source_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          logo_media_id?: string | null
          name: string
          slug: string
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          logo_media_id?: string | null
          name?: string
          slug?: string
          source_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_logo_media_id_fkey"
            columns: ["logo_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          image_id: string | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          source_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_id?: string | null
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_id?: string | null
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          source_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          bucket: string | null
          checksum: string | null
          created_at: string
          document_type: string
          id: string
          local_path: string | null
          media_id: string | null
          mime_type: string | null
          name: string
          original_url: string
          product_id: string
          storage_path: string | null
        }
        Insert: {
          bucket?: string | null
          checksum?: string | null
          created_at?: string
          document_type: string
          id?: string
          local_path?: string | null
          media_id?: string | null
          mime_type?: string | null
          name: string
          original_url: string
          product_id: string
          storage_path?: string | null
        }
        Update: {
          bucket?: string | null
          checksum?: string | null
          created_at?: string
          document_type?: string
          id?: string
          local_path?: string | null
          media_id?: string | null
          mime_type?: string | null
          name?: string
          original_url?: string
          product_id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          allow_backorder: boolean
          available: boolean
          stock_quantity: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          allow_backorder?: boolean
          available?: boolean
          stock_quantity?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          allow_backorder?: boolean
          available?: boolean
          stock_quantity?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          source_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          source_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          source_id?: string | null
        }
        Relationships: []
      }
      media: {
        Row: {
          alt_text: string | null
          bucket: string | null
          checksum: string | null
          created_at: string
          download_status: string
          file_size: number | null
          filename: string
          height: number | null
          id: string
          local_path: string | null
          mime_type: string | null
          original_url: string
          storage_path: string | null
          type: string
          updated_at: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          bucket?: string | null
          checksum?: string | null
          created_at?: string
          download_status?: string
          file_size?: number | null
          filename: string
          height?: number | null
          id?: string
          local_path?: string | null
          mime_type?: string | null
          original_url: string
          storage_path?: string | null
          type: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          bucket?: string | null
          checksum?: string | null
          created_at?: string
          download_status?: string
          file_size?: number | null
          filename?: string
          height?: number | null
          id?: string
          local_path?: string | null
          mime_type?: string | null
          original_url?: string
          storage_path?: string | null
          type?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: []
      }
      prices: {
        Row: {
          amount: number
          compare_at_amount: number | null
          created_at: string
          currency: string
          id: string
          product_variant_id: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          amount: number
          compare_at_amount?: number | null
          created_at?: string
          currency?: string
          id?: string
          product_variant_id: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          amount?: number
          compare_at_amount?: number | null
          created_at?: string
          currency?: string
          id?: string
          product_variant_id?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prices_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_attribute_values: {
        Row: {
          attribute_id: string
          created_at: string
          id: string
          product_id: string
          value_boolean: boolean | null
          value_json: Json | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          attribute_id: string
          created_at?: string
          id?: string
          product_id: string
          value_boolean?: boolean | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          attribute_id?: string
          created_at?: string
          id?: string
          product_id?: string
          value_boolean?: boolean | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_attribute_values_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attribute_values_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          category_id: string
          is_primary: boolean
          product_id: string
        }
        Insert: {
          category_id: string
          is_primary?: boolean
          product_id: string
        }
        Update: {
          category_id?: string
          is_primary?: boolean
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_markets: {
        Row: {
          market_id: string
          product_id: string
        }
        Insert: {
          market_id: string
          product_id: string
        }
        Update: {
          market_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_markets_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_markets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          media_id: string
          product_id: string
          role: string
          sort_order: number
        }
        Insert: {
          media_id: string
          product_id: string
          role: string
          sort_order?: number
        }
        Update: {
          media_id?: string
          product_id?: string
          role?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_types: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          source_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          source_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          source_id?: string | null
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          product_id: string
          sku: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          product_id: string
          sku?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          product_id?: string
          sku?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string | null
          content_hash: string
          created_at: string
          description: string
          featured: boolean
          featured_image_id: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          name: string
          original_url: string
          product_type_id: string | null
          published: boolean
          purchasable: boolean
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          sku: string | null
          slug: string
          sort_order: number
          source_active: boolean
          source_created_at: string | null
          source_id: string
          source_updated_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          content_hash: string
          created_at?: string
          description?: string
          featured?: boolean
          featured_image_id?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          name: string
          original_url: string
          product_type_id?: string | null
          published?: boolean
          purchasable?: boolean
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku?: string | null
          slug: string
          sort_order?: number
          source_active?: boolean
          source_created_at?: string | null
          source_id: string
          source_updated_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          content_hash?: string
          created_at?: string
          description?: string
          featured?: boolean
          featured_image_id?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          name?: string
          original_url?: string
          product_type_id?: string | null
          published?: boolean
          purchasable?: boolean
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku?: string | null
          slug?: string
          sort_order?: number
          source_active?: boolean
          source_created_at?: string | null
          source_id?: string
          source_updated_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_featured_image_id_fkey"
            columns: ["featured_image_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          finished_at: string | null
          id: string
          notes: string | null
          products_missing: number | null
          products_modified: number | null
          products_new: number | null
          products_seen: number | null
          source_url: string
          started_at: string
        }
        Insert: {
          finished_at?: string | null
          id?: string
          notes?: string | null
          products_missing?: number | null
          products_modified?: number | null
          products_new?: number | null
          products_seen?: number | null
          source_url: string
          started_at?: string
        }
        Update: {
          finished_at?: string | null
          id?: string
          notes?: string | null
          products_missing?: number | null
          products_modified?: number | null
          products_new?: number | null
          products_seen?: number | null
          source_url?: string
          started_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
