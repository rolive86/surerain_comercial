export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_modules: {
        Row: {
          code: string
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      app_user_links: {
        Row: {
          active: boolean
          created_at: string
          customer_id: string | null
          role: string
          sales_rep_id: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          customer_id?: string | null
          role: string
          sales_rep_id?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          customer_id?: string | null
          role?: string
          sales_rep_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_user_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_user_links_sales_rep_id_fkey"
            columns: ["sales_rep_id"]
            isOneToOne: false
            referencedRelation: "sales_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          added_at: string
          cart_id: string
          id: string
          product_name_snapshot: string
          product_slug_snapshot: string | null
          product_source_id: string
          quantity: number
          unit_snapshot: string | null
        }
        Insert: {
          added_at?: string
          cart_id: string
          id?: string
          product_name_snapshot: string
          product_slug_snapshot?: string | null
          product_source_id: string
          quantity: number
          unit_snapshot?: string | null
        }
        Update: {
          added_at?: string
          cart_id?: string
          id?: string
          product_name_snapshot?: string
          product_slug_snapshot?: string | null
          product_source_id?: string
          quantity?: number
          unit_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          active: boolean
          created_at: string
          customer_id: string
          email: string | null
          id: string
          is_primary: boolean
          name: string | null
          phone: string | null
          position: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          customer_id: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string | null
          phone?: string | null
          position?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          customer_id?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string | null
          phone?: string | null
          position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_pricing: {
        Row: {
          currency: string
          customer_id: string
          markup_pct: number
          updated_at: string
          updated_by: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          currency?: string
          customer_id: string
          markup_pct?: number
          updated_at?: string
          updated_by?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          currency?: string
          customer_id?: string
          markup_pct?: number
          updated_at?: string
          updated_by?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_pricing_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_price_list: {
        Row: {
          active: boolean
          created_at: string
          customer_id: string
          external_id: string | null
          id: string
          last_synced_at: string | null
          price_list_id: string
          source_system: string
          sync_status: string | null
          tango_id: string | null
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          customer_id: string
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          price_list_id: string
          source_system?: string
          sync_status?: string | null
          tango_id?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          customer_id?: string
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          price_list_id?: string
          source_system?: string
          sync_status?: string | null
          tango_id?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_price_list_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_price_list_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_sales_rep: {
        Row: {
          active: boolean
          created_at: string
          customer_id: string
          id: string
          sales_rep_id: string
          valid_from: string
          valid_to: string | null
          source_system: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          customer_id: string
          id?: string
          sales_rep_id: string
          valid_from?: string
          valid_to?: string | null
          source_system?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          customer_id?: string
          id?: string
          sales_rep_id?: string
          valid_from?: string
          valid_to?: string | null
          source_system?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_sales_rep_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_sales_rep_sales_rep_id_fkey"
            columns: ["sales_rep_id"]
            isOneToOne: false
            referencedRelation: "sales_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          active: boolean
          address: string | null
          city: string | null
          created_at: string
          cuit: string | null
          email: string | null
          external_id: string | null
          id: string
          last_synced_at: string | null
          legal_name: string
          phone: string | null
          postal_code: string | null
          province: string | null
          source_system: string
          sync_status: string | null
          tango_customer_id: string | null
          tax_condition: string | null
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string | null
          created_at?: string
          cuit?: string | null
          email?: string | null
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          legal_name: string
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          source_system?: string
          sync_status?: string | null
          tango_customer_id?: string | null
          tax_condition?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string | null
          created_at?: string
          cuit?: string | null
          email?: string | null
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          legal_name?: string
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          source_system?: string
          sync_status?: string | null
          tango_customer_id?: string | null
          tax_condition?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      effective_prices: {
        Row: {
          cod_articulo: string
          computed_at: string
          currency: string
          customer_id: string | null
          final_amount: number
          id: string
        }
        Insert: {
          cod_articulo: string
          computed_at?: string
          currency?: string
          customer_id?: string | null
          final_amount: number
          id?: string
        }
        Update: {
          cod_articulo?: string
          computed_at?: string
          currency?: string
          customer_id?: string | null
          final_amount?: number
          id?: string
        }
        Relationships: []
      }
      margins: {
        Row: {
          active: boolean
          category: string | null
          cod_articulo: string | null
          created_at: string
          customer_id: string | null
          id: string
          percent: number
          scope: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          cod_articulo?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          percent: number
          scope: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          cod_articulo?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          percent?: number
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "margins_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      module_permissions: {
        Row: {
          can_edit: boolean
          can_view: boolean
          module: string
          role: string
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          module: string
          role: string
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          module?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_permissions_module_fkey"
            columns: ["module"]
            isOneToOne: false
            referencedRelation: "app_modules"
            referencedColumns: ["code"]
          },
        ]
      }
      order_addresses: {
        Row: {
          address: string | null
          city: string | null
          company: string | null
          contact: string | null
          id: string
          kind: string
          observations: string | null
          order_id: string
          postal_code: string | null
          province: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company?: string | null
          contact?: string | null
          id?: string
          kind?: string
          observations?: string | null
          order_id: string
          postal_code?: string | null
          province?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company?: string | null
          contact?: string | null
          id?: string
          kind?: string
          observations?: string | null
          order_id?: string
          postal_code?: string | null
          province?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_addresses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          description_snapshot: string | null
          discount_snapshot: number | null
          id: string
          metadata_snapshot: Json
          order_id: string
          product_name_snapshot: string
          product_slug_snapshot: string | null
          product_source_id: string
          quantity: number
          sku_snapshot: string | null
          unit_price_snapshot: number | null
          unit_snapshot: string | null
        }
        Insert: {
          description_snapshot?: string | null
          discount_snapshot?: number | null
          id?: string
          metadata_snapshot?: Json
          order_id: string
          product_name_snapshot: string
          product_slug_snapshot?: string | null
          product_source_id: string
          quantity: number
          sku_snapshot?: string | null
          unit_price_snapshot?: number | null
          unit_snapshot?: string | null
        }
        Update: {
          description_snapshot?: string | null
          discount_snapshot?: number | null
          id?: string
          metadata_snapshot?: Json
          order_id?: string
          product_name_snapshot?: string
          product_slug_snapshot?: string | null
          product_source_id?: string
          quantity?: number
          sku_snapshot?: string | null
          unit_price_snapshot?: number | null
          unit_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes: {
        Row: {
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          note_type: string
          order_id: string
        }
        Insert: {
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          note_type: string
          order_id: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          note_type?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          comment: string | null
          created_at: string
          from_status: string | null
          id: string
          order_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          comment?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          order_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          comment?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          order_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_from_status_fkey"
            columns: ["from_status"]
            isOneToOne: false
            referencedRelation: "order_statuses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_to_status_fkey"
            columns: ["to_status"]
            isOneToOne: false
            referencedRelation: "order_statuses"
            referencedColumns: ["code"]
          },
        ]
      }
      order_statuses: {
        Row: {
          active: boolean
          code: string
          is_terminal: boolean
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          is_terminal?: boolean
          label: string
          sort_order: number
        }
        Update: {
          active?: boolean
          code?: string
          is_terminal?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string
          external_id: string | null
          id: string
          last_synced_at: string | null
          order_number: string
          pdf_url: string | null
          quote_valid_until: string | null
          sales_rep_id: string | null
          source: string
          status: string
          submitted_at: string | null
          sync_status: string | null
          tango_id: string | null
          updated_at: string
          user_id: string
          whatsapp_phone: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          order_number: string
          pdf_url?: string | null
          quote_valid_until?: string | null
          sales_rep_id?: string | null
          source?: string
          status: string
          submitted_at?: string | null
          sync_status?: string | null
          tango_id?: string | null
          updated_at?: string
          user_id: string
          whatsapp_phone?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          order_number?: string
          pdf_url?: string | null
          quote_valid_until?: string | null
          sales_rep_id?: string | null
          source?: string
          status?: string
          submitted_at?: string | null
          sync_status?: string | null
          tango_id?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_sales_rep_id_fkey"
            columns: ["sales_rep_id"]
            isOneToOne: false
            referencedRelation: "sales_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "order_statuses"
            referencedColumns: ["code"]
          },
        ]
      }
      price_lists: {
        Row: {
          active: boolean
          code: string
          created_at: string
          currency: string
          external_id: string | null
          id: string
          last_synced_at: string | null
          name: string
          source_system: string
          sync_status: string | null
          tango_price_list_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          currency?: string
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          name: string
          source_system?: string
          sync_status?: string | null
          tango_price_list_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          currency?: string
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string
          source_system?: string
          sync_status?: string | null
          tango_price_list_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prices: {
        Row: {
          amount: number
          compare_at_amount: number | null
          created_at: string
          external_id: string | null
          id: string
          last_synced_at: string | null
          price_list_id: string
          product_source_id: string
          sync_status: string | null
          tango_id: string | null
          unit: string | null
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          amount: number
          compare_at_amount?: number | null
          created_at?: string
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          price_list_id: string
          product_source_id: string
          sync_status?: string | null
          tango_id?: string | null
          unit?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          amount?: number
          compare_at_amount?: number | null
          created_at?: string
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          price_list_id?: string
          product_source_id?: string
          sync_status?: string | null
          tango_id?: string | null
          unit?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prices_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      product_map: {
        Row: {
          barcode: string | null
          catalog_name: string | null
          cod_articulo: string
          confidence: number | null
          confirmed: boolean
          created_at: string
          match_method: string | null
          source_id: string
          tango_desc: string | null
        }
        Insert: {
          barcode?: string | null
          catalog_name?: string | null
          cod_articulo: string
          confidence?: number | null
          confirmed?: boolean
          created_at?: string
          match_method?: string | null
          source_id: string
          tango_desc?: string | null
        }
        Update: {
          barcode?: string | null
          catalog_name?: string | null
          cod_articulo?: string
          confidence?: number | null
          confirmed?: boolean
          created_at?: string
          match_method?: string | null
          source_id?: string
          tango_desc?: string | null
        }
        Relationships: []
      }
      sales_history: {
        Row: {
          id: string
          content_hash: string
          nro_comprobante: string | null
          tipo_comprobante: string | null
          fecha: string | null
          cod_cliente: string | null
          customer_id: string | null
          cod_vendedor: string | null
          cod_articulo: string | null
          cantidad: number | null
          precio_unitario_usd: number | null
          total_facturado: number | null
          moneda: string | null
          created_at: string
        }
        Insert: {
          id?: string
          content_hash: string
          nro_comprobante?: string | null
          tipo_comprobante?: string | null
          fecha?: string | null
          cod_cliente?: string | null
          customer_id?: string | null
          cod_vendedor?: string | null
          cod_articulo?: string | null
          cantidad?: number | null
          precio_unitario_usd?: number | null
          total_facturado?: number | null
          moneda?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          content_hash?: string
          nro_comprobante?: string | null
          tipo_comprobante?: string | null
          fecha?: string | null
          cod_cliente?: string | null
          customer_id?: string | null
          cod_vendedor?: string | null
          cod_articulo?: string | null
          cantidad?: number | null
          precio_unitario_usd?: number | null
          total_facturado?: number | null
          moneda?: string | null
          created_at?: string
        }
        Relationships: []
      }
      product_groups: {
        Row: {
          id: string
          slug: string | null
          name: string
          familia: string | null
          needs_review: boolean
          source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug?: string | null
          name: string
          familia?: string | null
          needs_review?: boolean
          source?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string | null
          name?: string
          familia?: string | null
          needs_review?: boolean
          source?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          cod_articulo: string
          group_id: string | null
          variant_label: string | null
          sort_order: number
        }
        Insert: {
          cod_articulo: string
          group_id?: string | null
          variant_label?: string | null
          sort_order?: number
        }
        Update: {
          cod_articulo?: string
          group_id?: string | null
          variant_label?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      products_tango: {
        Row: {
          active: boolean
          catalog_source_id: string | null
          cod_articulo: string
          cod_barra: string | null
          descripcion: string | null
          familia: string | null
          has_price: boolean
          has_stock: boolean
          image_url: string | null
          stock_qty: number | null
          unidad: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          catalog_source_id?: string | null
          cod_articulo: string
          cod_barra?: string | null
          descripcion?: string | null
          familia?: string | null
          has_price?: boolean
          has_stock?: boolean
          image_url?: string | null
          stock_qty?: number | null
          unidad?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          catalog_source_id?: string | null
          cod_articulo?: string
          cod_barra?: string | null
          descripcion?: string | null
          familia?: string | null
          has_price?: boolean
          has_stock?: boolean
          image_url?: string | null
          stock_qty?: number | null
          unidad?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      centros_costo: {
        Row: {
          id: string
          nombre: string
          activo: boolean
        }
        Insert: {
          id?: string
          nombre: string
          activo?: boolean
        }
        Update: {
          id?: string
          nombre?: string
          activo?: boolean
        }
        Relationships: []
      }
      motivos_factura: {
        Row: {
          id: string
          nombre: string
          activo: boolean
        }
        Insert: {
          id?: string
          nombre: string
          activo?: boolean
        }
        Update: {
          id?: string
          nombre?: string
          activo?: boolean
        }
        Relationships: []
      }
      facturas: {
        Row: {
          id: string
          uploaded_by: string | null
          cod_vendedor: string | null
          tipo: string | null
          centro_costo_id: string | null
          motivo_id: string | null
          image_path: string
          monto: number | null
          fecha: string | null
          cuit: string | null
          ocr_raw: Json | null
          estado: string
          created_at: string
        }
        Insert: {
          id?: string
          uploaded_by?: string | null
          cod_vendedor?: string | null
          tipo?: string | null
          centro_costo_id?: string | null
          motivo_id?: string | null
          image_path: string
          monto?: number | null
          fecha?: string | null
          cuit?: string | null
          ocr_raw?: Json | null
          estado?: string
          created_at?: string
        }
        Update: {
          id?: string
          uploaded_by?: string | null
          cod_vendedor?: string | null
          tipo?: string | null
          centro_costo_id?: string | null
          motivo_id?: string | null
          image_path?: string
          monto?: number | null
          fecha?: string | null
          cuit?: string | null
          ocr_raw?: Json | null
          estado?: string
          created_at?: string
        }
        Relationships: []
      }
      sales_reps: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          external_id: string | null
          id: string
          last_synced_at: string | null
          name: string
          source_system: string
          sync_status: string | null
          tango_sales_rep_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          name: string
          source_system?: string
          sync_status?: string | null
          tango_sales_rep_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          external_id?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string
          source_system?: string
          sync_status?: string | null
          tango_sales_rep_id?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          full_name: string | null
          interests: Json
          marketing_opt_in: boolean
          phone: string | null
          position: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string | null
          interests?: Json
          marketing_opt_in?: boolean
          phone?: string | null
          position?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string | null
          interests?: Json
          marketing_opt_in?: boolean
          phone?: string | null
          position?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_client_top_products: {
        Row: {
          customer_id: string | null
          cod_articulo: string | null
          lineas: number | null
          veces: number | null
          unidades: number | null
          ultima_compra: string | null
        }
        Relationships: []
      }
      v_client_reorder: {
        Row: {
          customer_id: string | null
          cod_articulo: string | null
          compras: number | null
          primera: string | null
          ultima: string | null
          avg_interval_days: number | null
          days_since: number | null
          due_for_reorder: boolean | null
        }
        Relationships: []
      }
      v_client_sales_summary: {
        Row: {
          customer_id: string | null
          comprobantes: number | null
          total_facturado: number | null
          total_12m: number | null
          ultima_compra: string | null
          primera_compra: string | null
        }
        Relationships: []
      }
      v_customer_product_frequency: {
        Row: {
          customer_id: string | null
          primera_vez: string | null
          product_source_id: string | null
          ultima_vez: string | null
          unidades_totales: number | null
          veces_pedido: number | null
        }
        Relationships: []
      }
      v_customer_product_pairs: {
        Row: {
          customer_id: string | null
          juntos: number | null
          product_a: string | null
          product_b: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_customer_id: { Args: never; Returns: string }
      current_customer_price_list_ids: { Args: never; Returns: string[] }
      current_rep_customer_ids: { Args: never; Returns: string[] }
      current_role: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      dashboard_summary: { Args: never; Returns: Json }
      vendedor_home_kpis: {
        Args: { p_fecha?: string }
        Returns: Json
      }
      rendicion_list_conceptos: { Args: never; Returns: Json }
      rendicion_list_mis: { Args: { p_limit?: number }; Returns: Json }
      rendicion_save: { Args: { p: Json }; Returns: string }
      dashboard_kpis: {
        Args: {
          p_empresa?: string
          p_moneda?: string
          p_fecha?: string
          p_vendedor?: string
          p_familia?: string
        }
        Returns: Json
      }
      dashboard_matriz: {
        Args: {
          p_empresa?: string
          p_moneda?: string
          p_vendedor?: string
          p_familia?: string
        }
        Returns: Json
      }
      dashboard_ranking: {
        Args: {
          p_empresa?: string
          p_periodo?: string
          p_fecha?: string
          p_moneda?: string
          p_familia?: string
        }
        Returns: Json
      }
      dashboard_por_empresa: {
        Args: {
          p_fecha?: string
          p_moneda?: string
          p_vendedor?: string
          p_familia?: string
        }
        Returns: Json
      }
      dashboard_dimensiones: {
        Args: { p_empresa?: string }
        Returns: Json
      }
      dashboard_comercial: {
        Args: {
          p_empresa?: string
          p_moneda?: string
          p_fecha?: string
          p_vendedor?: string
          p_familia?: string
          p_periodo?: string
        }
        Returns: Json
      }
      next_order_number: { Args: never; Returns: string }
      catalog_final_prices: {
        Args: { p_source_ids: string[] }
        Returns: {
          source_id: string
          final_amount: number
          currency: string
        }[]
      }
      catalog_product_codes: {
        Args: { p_source_ids: string[] }
        Returns: {
          source_id: string
          cod_articulo: string
        }[]
      }
      recompute_effective_prices: { Args: never; Returns: undefined }
      quote_unit_price: {
        Args: { p_cod_articulo: string; p_customer: string }
        Returns: number
      }
      stock_availability: {
        Args: { p_cod_articulo: string }
        Returns: {
          stock_real: number
          comprometido: number
          libre: number
        }[]
      }
      stock_availability_many: {
        Args: { p_codes: string[] }
        Returns: {
          cod_articulo: string
          stock_real: number
          comprometido: number
          libre: number
        }[]
      }
      clientes_a_recontactar: {
        Args: {
          p_familia?: string | null
          p_cod_articulo?: string | null
          p_mes_desde?: number
          p_mes_hasta?: number
          p_anio_base?: number
          p_localidad?: string | null
          p_provincia?: string | null
        }
        Returns: {
          customer_id: string
          cliente: string
          localidad: string | null
          provincia: string | null
          telefono: string | null
          cant_anio_base: number
          total_anio_base: number
          ultima_compra: string
          cant_anio_actual: number
        }[]
      }
      cliente_comparativo_periodo: {
        Args: {
          p_customer_id: string
          p_mes_desde?: number
          p_mes_hasta?: number
          p_anio_base?: number
          p_dia_hasta?: number
        }
        Returns: {
          cod_articulo: string
          descripcion: string | null
          familia: string | null
          cant_anio_base: number
          total_anio_base: number
          cant_anio_actual: number
          total_anio_actual: number
          estado: string
        }[]
      }
      ranking_zona_familia: {
        Args: {
          p_mes_desde?: number
          p_mes_hasta?: number
          p_anio_base?: number
          p_agrupar_por?: string
        }
        Returns: {
          zona: string
          familia: string
          cant_anio_base: number
          total_anio_base: number
          cant_anio_actual: number
          total_anio_actual: number
        }[]
      }
      ventas_explorer: {
        Args: {
          p_group_by: string
          p_metric: string
          p_fecha_desde?: string | null
          p_fecha_hasta?: string | null
          p_familia?: string | null
          p_cod_articulo?: string | null
          p_localidad?: string | null
          p_provincia?: string | null
          p_comparar_interanual?: boolean
        }
        Returns: {
          dimension: string
          valor: number
          valor_anio_anterior: number | null
          variacion_pct: number | null
        }[]
      }
      tango_specs_upsert: { Args: { p_rows: Json }; Returns: Json }
      tango_staging_fetch: { Args: { p_entity: string }; Returns: Json }
      tango_staging_run_finish: {
        Args: {
          p_error?: string
          p_failed?: number
          p_id: string
          p_read?: number
          p_status: string
          p_upserted?: number
        }
        Returns: undefined
      }
      tango_staging_run_start: {
        Args: { p_entity: string; p_meta?: Json; p_source?: string }
        Returns: string
      }
      tango_staging_upsert: {
        Args: { p_entity: string; p_rows: Json }
        Returns: Json
      }
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
