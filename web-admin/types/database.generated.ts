export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      cmx_effective_permissions: {
        Row: {
          allow: boolean
          created_at: string | null
          permission_code: string
          resource_id: string | null
          resource_type: string | null
          tenant_org_id: string
          user_id: string
        }
        Insert: {
          allow?: boolean
          created_at?: string | null
          permission_code: string
          resource_id?: string | null
          resource_type?: string | null
          tenant_org_id: string
          user_id: string
        }
        Update: {
          allow?: boolean
          created_at?: string | null
          permission_code?: string
          resource_id?: string | null
          resource_type?: string | null
          tenant_org_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmx_effective_permissions_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cmx_effective_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_locked_accounts"
            referencedColumns: ["user_id"]
          },
        ]
      }
      hq_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          error_message: string | null
          id: string
          ip_address: unknown | null
          resource_id: string | null
          resource_type: string | null
          success: boolean | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type?: string | null
          success?: boolean | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "hq_users"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          is_active: boolean | null
          is_system_role: boolean | null
          permissions: Json
          role_code: string
          role_description: string | null
          role_description_ar: string | null
          role_name: string
          role_name_ar: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          is_active?: boolean | null
          is_system_role?: boolean | null
          permissions?: Json
          role_code: string
          role_description?: string | null
          role_description_ar?: string | null
          role_name: string
          role_name_ar?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          is_active?: boolean | null
          is_system_role?: boolean | null
          permissions?: Json
          role_code?: string
          role_description?: string | null
          role_description_ar?: string | null
          role_name?: string
          role_name_ar?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      hq_session_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          ip_address: unknown | null
          last_used_at: string | null
          refresh_token_hash: string | null
          token_hash: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: unknown | null
          last_used_at?: string | null
          refresh_token_hash?: string | null
          token_hash: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: unknown | null
          last_used_at?: string | null
          refresh_token_hash?: string | null
          token_hash?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_session_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "hq_users"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_tenant_status_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          from_status: string | null
          id: string
          lifecycle_stage_from: string | null
          lifecycle_stage_to: string | null
          metadata: Json | null
          reason: string | null
          tenant_id: string
          to_status: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          from_status?: string | null
          id?: string
          lifecycle_stage_from?: string | null
          lifecycle_stage_to?: string | null
          metadata?: Json | null
          reason?: string | null
          tenant_id: string
          to_status: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          from_status?: string | null
          id?: string
          lifecycle_stage_from?: string | null
          lifecycle_stage_to?: string | null
          metadata?: Json | null
          reason?: string | null
          tenant_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_tenant_status_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_users: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
          failed_login_attempts: number | null
          full_name: string | null
          full_name_ar: string | null
          id: string
          is_active: boolean | null
          is_email_verified: boolean | null
          last_login_at: string | null
          last_login_ip: unknown | null
          locked_until: string | null
          mfa_enabled: boolean | null
          mfa_secret: string | null
          password_changed_at: string | null
          password_hash: string
          role_code: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
          failed_login_attempts?: number | null
          full_name?: string | null
          full_name_ar?: string | null
          id?: string
          is_active?: boolean | null
          is_email_verified?: boolean | null
          last_login_at?: string | null
          last_login_ip?: unknown | null
          locked_until?: string | null
          mfa_enabled?: boolean | null
          mfa_secret?: string | null
          password_changed_at?: string | null
          password_hash: string
          role_code: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
          failed_login_attempts?: number | null
          full_name?: string | null
          full_name_ar?: string | null
          id?: string
          is_active?: boolean | null
          is_email_verified?: boolean | null
          last_login_at?: string | null
          last_login_ip?: unknown | null
          locked_until?: string | null
          mfa_enabled?: boolean | null
          mfa_secret?: string | null
          password_changed_at?: string | null
          password_hash?: string
          role_code?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_users_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "hq_roles"
            referencedColumns: ["role_code"]
          },
        ]
      }
      org_auth_user_permissions: {
        Row: {
          allow: boolean
          created_at: string | null
          created_by: string | null
          id: string
          permission_code: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          allow?: boolean
          created_at?: string | null
          created_by?: string | null
          id?: string
          permission_code: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          allow?: boolean
          created_at?: string | null
          created_by?: string | null
          id?: string
          permission_code?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_auth_user_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "sys_auth_permissions"
            referencedColumns: ["code"]
          },
        ]
      }
      org_auth_user_resource_permissions: {
        Row: {
          allow: boolean
          created_at: string | null
          created_by: string | null
          id: string
          permission_code: string
          resource_id: string
          resource_type: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          allow?: boolean
          created_at?: string | null
          created_by?: string | null
          id?: string
          permission_code: string
          resource_id: string
          resource_type: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          allow?: boolean
          created_at?: string | null
          created_by?: string | null
          id?: string
          permission_code?: string
          resource_id?: string
          resource_type?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_auth_user_resource_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "sys_auth_permissions"
            referencedColumns: ["code"]
          },
        ]
      }
      org_auth_user_resource_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean
          resource_id: string
          resource_type: string
          role_code: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          resource_id: string
          resource_type: string
          role_code: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          resource_id?: string
          resource_type?: string
          role_code?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_auth_user_resource_roles_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "sys_auth_roles"
            referencedColumns: ["code"]
          },
        ]
      }
      org_auth_user_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean
          role_code: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          role_code: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          role_code?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_auth_user_roles_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "sys_auth_roles"
            referencedColumns: ["code"]
          },
        ]
      }
      org_auth_user_workflow_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          user_id: string
          workflow_role: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
          workflow_role: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
          workflow_role?: string
        }
        Relationships: []
      }
      org_branches_mst: {
        Row: {
          address: string | null
          area: string | null
          branch_name: string | null
          building: string | null
          city: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          email: string | null
          floor: string | null
          id: string
          is_active: boolean
          is_main: boolean | null
          latitude: number | null
          longitude: number | null
          name: string | null
          name2: string | null
          phone: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          s_date: string | null
          street: string | null
          tenant_org_id: string
          type: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          address?: string | null
          area?: string | null
          branch_name?: string | null
          building?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          email?: string | null
          floor?: string | null
          id?: string
          is_active?: boolean
          is_main?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          name2?: string | null
          phone?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          s_date?: string | null
          street?: string | null
          tenant_org_id: string
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          address?: string | null
          area?: string | null
          branch_name?: string | null
          building?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          email?: string | null
          floor?: string | null
          id?: string
          is_active?: boolean
          is_main?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          name2?: string | null
          phone?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          s_date?: string | null
          street?: string | null
          tenant_org_id?: string
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_org_branch_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_customer_addresses: {
        Row: {
          address_type: string | null
          apartment: string | null
          area: string | null
          building: string | null
          city: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          delivery_notes: string | null
          floor: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          label: string | null
          latitude: number | null
          longitude: number | null
          postal_code: string | null
          street: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          address_type?: string | null
          apartment?: string | null
          area?: string | null
          building?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          delivery_notes?: string | null
          floor?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          label?: string | null
          latitude?: number | null
          longitude?: number | null
          postal_code?: string | null
          street?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          address_type?: string | null
          apartment?: string | null
          area?: string | null
          building?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          delivery_notes?: string | null
          floor?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          label?: string | null
          latitude?: number | null
          longitude?: number | null
          postal_code?: string | null
          street?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_address_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "org_customers_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_address_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_customer_merge_log: {
        Row: {
          created_at: string | null
          id: string
          loyalty_points_merged: number | null
          merge_reason: string | null
          merged_by: string
          orders_moved: number | null
          source_customer_id: string
          target_customer_id: string
          tenant_org_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          loyalty_points_merged?: number | null
          merge_reason?: string | null
          merged_by: string
          orders_moved?: number | null
          source_customer_id: string
          target_customer_id: string
          tenant_org_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          loyalty_points_merged?: number | null
          merge_reason?: string | null
          merged_by?: string
          orders_moved?: number | null
          source_customer_id?: string
          target_customer_id?: string
          tenant_org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_customer_merge_log_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_customers_mst: {
        Row: {
          address: string | null
          area: string | null
          building: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          customer_id: string | null
          customer_source_type: string
          display_name: string | null
          email: string | null
          first_name: string | null
          floor: string | null
          id: string
          is_active: boolean
          last_name: string | null
          loyalty_points: number | null
          name: string | null
          name2: string | null
          phone: string | null
          preferences: Json | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          s_date: string
          tenant_org_id: string
          type: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          address?: string | null
          area?: string | null
          building?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          customer_id?: string | null
          customer_source_type?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          floor?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          loyalty_points?: number | null
          name?: string | null
          name2?: string | null
          phone?: string | null
          preferences?: Json | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          s_date?: string
          tenant_org_id: string
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          address?: string | null
          area?: string | null
          building?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          customer_id?: string | null
          customer_source_type?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          floor?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          loyalty_points?: number | null
          name?: string | null
          name2?: string | null
          phone?: string | null
          preferences?: Json | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          s_date?: string
          tenant_org_id?: string
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_org_cust_sys"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "sys_customers_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_org_cust_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_discount_rules_cf: {
        Row: {
          can_stack_with_other_rules: boolean | null
          can_stack_with_promo: boolean | null
          conditions: Json
          created_at: string
          created_by: string | null
          created_info: string | null
          description: string | null
          description2: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          is_enabled: boolean
          metadata: Json | null
          priority: number | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          rule_code: string
          rule_name: string
          rule_name2: string | null
          rule_type: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          can_stack_with_other_rules?: boolean | null
          can_stack_with_promo?: boolean | null
          conditions: Json
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean
          is_enabled?: boolean
          metadata?: Json | null
          priority?: number | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          rule_code: string
          rule_name: string
          rule_name2?: string | null
          rule_type: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          can_stack_with_other_rules?: boolean | null
          can_stack_with_promo?: boolean | null
          conditions?: Json
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          is_enabled?: boolean
          metadata?: Json | null
          priority?: number | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          rule_code?: string
          rule_name?: string
          rule_name2?: string | null
          rule_type?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_discount_rules_tenant_fk"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_gift_card_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          gift_card_id: string
          id: string
          invoice_id: string | null
          metadata: Json | null
          notes: string | null
          order_id: string | null
          processed_by: string | null
          tenant_org_id: string
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          gift_card_id: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          notes?: string | null
          order_id?: string | null
          processed_by?: string | null
          tenant_org_id: string
          transaction_date?: string
          transaction_type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          gift_card_id?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          notes?: string | null
          order_id?: string | null
          processed_by?: string | null
          tenant_org_id?: string
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_gift_card_trans_card_fk"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "org_gift_cards_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_gift_card_trans_tenant_fk"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_gift_cards_mst: {
        Row: {
          card_name: string | null
          card_name2: string | null
          card_number: string
          card_pin: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          current_balance: number
          expiry_date: string | null
          id: string
          is_active: boolean
          issued_date: string
          issued_to_customer_id: string | null
          metadata: Json | null
          original_amount: number
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          status: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          card_name?: string | null
          card_name2?: string | null
          card_number: string
          card_pin?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          current_balance: number
          expiry_date?: string | null
          id?: string
          is_active?: boolean
          issued_date?: string
          issued_to_customer_id?: string | null
          metadata?: Json | null
          original_amount: number
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          status?: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          card_name?: string | null
          card_name2?: string | null
          card_number?: string
          card_pin?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          current_balance?: number
          expiry_date?: string | null
          id?: string
          is_active?: boolean
          issued_date?: string
          issued_to_customer_id?: string | null
          metadata?: Json | null
          original_amount?: number
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          status?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_gift_cards_tenant_fk"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invoice_mst: {
        Row: {
          created_at: string
          created_by: string | null
          created_info: string | null
          discount: number | null
          due_date: string | null
          id: string
          invoice_no: string
          metadata: Json | null
          order_id: string | null
          paid_amount: number | null
          paid_at: string | null
          paid_by: string | null
          payment_method: string | null
          rec_notes: string | null
          status: string | null
          subtotal: number | null
          tax: number | null
          tenant_org_id: string
          total: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          discount?: number | null
          due_date?: string | null
          id?: string
          invoice_no: string
          metadata?: Json | null
          order_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          rec_notes?: string | null
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          tenant_org_id: string
          total?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          discount?: number | null
          due_date?: string | null
          id?: string
          invoice_no?: string
          metadata?: Json | null
          order_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          rec_notes?: string | null
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          tenant_org_id?: string
          total?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_org_invoice_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_org_invoice_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_order_history: {
        Row: {
          action_type: string
          created_at: string | null
          done_at: string | null
          done_by: string | null
          from_value: string | null
          id: string
          order_id: string
          payload: Json | null
          tenant_org_id: string
          to_value: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          done_at?: string | null
          done_by?: string | null
          from_value?: string | null
          id?: string
          order_id: string
          payload?: Json | null
          tenant_org_id: string
          to_value?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          done_at?: string | null
          done_by?: string | null
          from_value?: string | null
          id?: string
          order_id?: string
          payload?: Json | null
          tenant_org_id?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_history_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_history_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_history_user"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "admin_locked_accounts"
            referencedColumns: ["user_id"]
          },
        ]
      }
      org_order_item_issues: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          issue_code: string
          issue_text: string
          metadata: Json | null
          order_id: string
          order_item_id: string
          photo_url: string | null
          priority: string | null
          solved_at: string | null
          solved_by: string | null
          solved_notes: string | null
          tenant_org_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          issue_code: string
          issue_text: string
          metadata?: Json | null
          order_id: string
          order_item_id: string
          photo_url?: string | null
          priority?: string | null
          solved_at?: string | null
          solved_by?: string | null
          solved_notes?: string | null
          tenant_org_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          issue_code?: string
          issue_text?: string
          metadata?: Json | null
          order_id?: string
          order_item_id?: string
          photo_url?: string | null
          priority?: string | null
          solved_at?: string | null
          solved_by?: string | null
          solved_notes?: string | null
          tenant_org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_issue_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_locked_accounts"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_issue_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_issue_order_item"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "org_order_items_dtl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_issue_solved_by"
            columns: ["solved_by"]
            isOneToOne: false
            referencedRelation: "admin_locked_accounts"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_issue_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_order_item_processing_steps: {
        Row: {
          done_at: string | null
          done_by: string | null
          id: string
          metadata: Json | null
          notes: string | null
          order_id: string
          order_item_id: string
          step_code: string
          step_seq: number
          tenant_org_id: string
        }
        Insert: {
          done_at?: string | null
          done_by?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          order_id: string
          order_item_id: string
          step_code: string
          step_seq: number
          tenant_org_id: string
        }
        Update: {
          done_at?: string | null
          done_by?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          order_id?: string
          order_item_id?: string
          step_code?: string
          step_seq?: number
          tenant_org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_step_done_by"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "admin_locked_accounts"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_step_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_step_order_item"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "org_order_items_dtl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_step_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_order_items_dtl: {
        Row: {
          barcode: string | null
          brand: string | null
          color: string | null
          created_at: string | null
          damage_notes: string | null
          has_damage: boolean | null
          has_stain: boolean | null
          id: string
          item_is_rejected: boolean | null
          item_issue_id: string | null
          item_last_step: string | null
          item_last_step_at: string | null
          item_last_step_by: string | null
          item_stage: string | null
          item_status: string | null
          metadata: Json | null
          notes: string | null
          order_id: string
          order_item_srno: string | null
          price_per_unit: number
          product_id: string | null
          product_name: string | null
          product_name2: string | null
          quantity: number | null
          quantity_ready: number | null
          service_category_code: string | null
          stain_notes: string | null
          status: string | null
          tenant_org_id: string
          total_price: number
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          color?: string | null
          created_at?: string | null
          damage_notes?: string | null
          has_damage?: boolean | null
          has_stain?: boolean | null
          id?: string
          item_is_rejected?: boolean | null
          item_issue_id?: string | null
          item_last_step?: string | null
          item_last_step_at?: string | null
          item_last_step_by?: string | null
          item_stage?: string | null
          item_status?: string | null
          metadata?: Json | null
          notes?: string | null
          order_id: string
          order_item_srno?: string | null
          price_per_unit: number
          product_id?: string | null
          product_name?: string | null
          product_name2?: string | null
          quantity?: number | null
          quantity_ready?: number | null
          service_category_code?: string | null
          stain_notes?: string | null
          status?: string | null
          tenant_org_id: string
          total_price: number
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          color?: string | null
          created_at?: string | null
          damage_notes?: string | null
          has_damage?: boolean | null
          has_stain?: boolean | null
          id?: string
          item_is_rejected?: boolean | null
          item_issue_id?: string | null
          item_last_step?: string | null
          item_last_step_at?: string | null
          item_last_step_by?: string | null
          item_stage?: string | null
          item_status?: string | null
          metadata?: Json | null
          notes?: string | null
          order_id?: string
          order_item_srno?: string | null
          price_per_unit?: number
          product_id?: string | null
          product_name?: string | null
          product_name2?: string | null
          quantity?: number | null
          quantity_ready?: number | null
          service_category_code?: string | null
          stain_notes?: string | null
          status?: string | null
          tenant_org_id?: string
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_org_items_ctg"
            columns: ["tenant_org_id", "service_category_code"]
            isOneToOne: false
            referencedRelation: "org_service_category_cf"
            referencedColumns: ["tenant_org_id", "service_category_code"]
          },
          {
            foreignKeyName: "fk_org_items_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_org_items_prod"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "org_product_data_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_order_status_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          changed_by_name: string | null
          created_at: string | null
          from_status: string | null
          id: string
          metadata: Json | null
          notes: string | null
          order_id: string
          tenant_org_id: string
          to_status: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          order_id: string
          tenant_org_id: string
          to_status: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          order_id?: string
          tenant_org_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_status_history_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_status_history_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_status_history_user"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "admin_locked_accounts"
            referencedColumns: ["user_id"]
          },
        ]
      }
      org_orders_mst: {
        Row: {
          bag_count: number | null
          barcode: string | null
          branch_id: string | null
          created_at: string | null
          current_stage: string | null
          current_status: string | null
          customer_id: string
          customer_notes: string | null
          delivered_at: string | null
          discount: number | null
          has_issue: boolean | null
          has_split: boolean | null
          id: string
          internal_notes: string | null
          is_order_quick_drop: boolean | null
          is_rejected: boolean | null
          issue_id: string | null
          last_transition_at: string | null
          last_transition_by: string | null
          order_no: string
          order_subtype: string | null
          order_type_id: string | null
          paid_amount: number | null
          paid_at: string | null
          paid_by: string | null
          parent_order_id: string | null
          payment_method: string | null
          payment_notes: string | null
          payment_status: string | null
          photo_urls: Json | null
          preparation_status: string | null
          prepared_at: string | null
          prepared_by: string | null
          priority: string | null
          priority_multiplier: number | null
          qr_code: string | null
          quick_drop_quantity: number | null
          rack_location: string | null
          ready_at: string | null
          ready_by: string | null
          ready_by_at_new: string | null
          ready_by_override: string | null
          received_at: string | null
          rejected_from_stage: string | null
          service_category_code: string | null
          status: string | null
          subtotal: number | null
          tax: number | null
          tenant_org_id: string
          total: number | null
          total_items: number | null
          updated_at: string | null
          workflow_template_id: string | null
        }
        Insert: {
          bag_count?: number | null
          barcode?: string | null
          branch_id?: string | null
          created_at?: string | null
          current_stage?: string | null
          current_status?: string | null
          customer_id: string
          customer_notes?: string | null
          delivered_at?: string | null
          discount?: number | null
          has_issue?: boolean | null
          has_split?: boolean | null
          id?: string
          internal_notes?: string | null
          is_order_quick_drop?: boolean | null
          is_rejected?: boolean | null
          issue_id?: string | null
          last_transition_at?: string | null
          last_transition_by?: string | null
          order_no: string
          order_subtype?: string | null
          order_type_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_by?: string | null
          parent_order_id?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_status?: string | null
          photo_urls?: Json | null
          preparation_status?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          priority?: string | null
          priority_multiplier?: number | null
          qr_code?: string | null
          quick_drop_quantity?: number | null
          rack_location?: string | null
          ready_at?: string | null
          ready_by?: string | null
          ready_by_at_new?: string | null
          ready_by_override?: string | null
          received_at?: string | null
          rejected_from_stage?: string | null
          service_category_code?: string | null
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          tenant_org_id: string
          total?: number | null
          total_items?: number | null
          updated_at?: string | null
          workflow_template_id?: string | null
        }
        Update: {
          bag_count?: number | null
          barcode?: string | null
          branch_id?: string | null
          created_at?: string | null
          current_stage?: string | null
          current_status?: string | null
          customer_id?: string
          customer_notes?: string | null
          delivered_at?: string | null
          discount?: number | null
          has_issue?: boolean | null
          has_split?: boolean | null
          id?: string
          internal_notes?: string | null
          is_order_quick_drop?: boolean | null
          is_rejected?: boolean | null
          issue_id?: string | null
          last_transition_at?: string | null
          last_transition_by?: string | null
          order_no?: string
          order_subtype?: string | null
          order_type_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_by?: string | null
          parent_order_id?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_status?: string | null
          photo_urls?: Json | null
          preparation_status?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          priority?: string | null
          priority_multiplier?: number | null
          qr_code?: string | null
          quick_drop_quantity?: number | null
          rack_location?: string | null
          ready_at?: string | null
          ready_by?: string | null
          ready_by_at_new?: string | null
          ready_by_override?: string | null
          received_at?: string | null
          rejected_from_stage?: string | null
          service_category_code?: string | null
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          tenant_org_id?: string
          total?: number | null
          total_items?: number | null
          updated_at?: string | null
          workflow_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_order_parent_order"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_org_order_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_org_order_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "org_customers_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_org_order_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_org_order_type"
            columns: ["order_type_id"]
            isOneToOne: false
            referencedRelation: "sys_order_type_cd"
            referencedColumns: ["order_type_id"]
          },
          {
            foreignKeyName: "org_orders_mst_workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "sys_workflow_template_cd"
            referencedColumns: ["template_id"]
          },
        ]
      }
      org_payments_dtl_tr: {
        Row: {
          created_at: string
          created_by: string | null
          created_info: string | null
          due_date: string | null
          gateway: string | null
          id: string
          invoice_id: string
          metadata: Json | null
          paid_amount: number | null
          paid_at: string | null
          paid_by: string | null
          payment_method: string | null
          rec_notes: string | null
          status: string | null
          tenant_org_id: string
          transaction_id: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          due_date?: string | null
          gateway?: string | null
          id?: string
          invoice_id: string
          metadata?: Json | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          rec_notes?: string | null
          status?: string | null
          tenant_org_id: string
          transaction_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          due_date?: string | null
          gateway?: string | null
          id?: string
          invoice_id?: string
          metadata?: Json | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          rec_notes?: string | null
          status?: string | null
          tenant_org_id?: string
          transaction_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_org_payment_invoice"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "org_invoice_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_org_payment_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_pln_change_history_tr: {
        Row: {
          change_reason: string | null
          change_type: string
          created_at: string | null
          created_by: string | null
          effective_date: string
          from_plan_code: string | null
          id: string
          proration_amount: number | null
          proration_invoice_id: string | null
          subscription_id: string
          tenant_org_id: string
          to_plan_code: string
        }
        Insert: {
          change_reason?: string | null
          change_type: string
          created_at?: string | null
          created_by?: string | null
          effective_date: string
          from_plan_code?: string | null
          id?: string
          proration_amount?: number | null
          proration_invoice_id?: string | null
          subscription_id: string
          tenant_org_id: string
          to_plan_code: string
        }
        Update: {
          change_reason?: string | null
          change_type?: string
          created_at?: string | null
          created_by?: string | null
          effective_date?: string
          from_plan_code?: string | null
          id?: string
          proration_amount?: number | null
          proration_invoice_id?: string | null
          subscription_id?: string
          tenant_org_id?: string
          to_plan_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_pln_change_history_tr_proration_invoice_id_fkey"
            columns: ["proration_invoice_id"]
            isOneToOne: false
            referencedRelation: "sys_bill_invoices_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_pln_change_history_tr_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "org_pln_subscriptions_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_pln_change_history_tr_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_pln_change_history_tr_tenant_org_id_subscription_id_fkey"
            columns: ["tenant_org_id", "subscription_id"]
            isOneToOne: false
            referencedRelation: "org_pln_subscriptions_mst"
            referencedColumns: ["tenant_org_id", "id"]
          },
        ]
      }
      org_pln_subscriptions_mst: {
        Row: {
          activated_at: string | null
          base_price: number
          billing_cycle: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          currency: string | null
          current_period_end: string
          current_period_start: string
          default_payment_method_id: string | null
          discount_applied_at: string | null
          discount_code: string | null
          discount_duration_months: number | null
          discount_type: string | null
          discount_value: number | null
          id: string
          is_active: boolean
          plan_change_scheduled_at: string | null
          plan_changed_at: string | null
          plan_code: string
          plan_name: string | null
          previous_plan_code: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          scheduled_plan_change_date: string | null
          scheduled_plan_code: string | null
          status: string | null
          subscription_notes: string | null
          suspended_at: string | null
          tenant_org_id: string
          trial_end: string | null
          trial_start: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          activated_at?: string | null
          base_price: number
          billing_cycle?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          currency?: string | null
          current_period_end: string
          current_period_start: string
          default_payment_method_id?: string | null
          discount_applied_at?: string | null
          discount_code?: string | null
          discount_duration_months?: number | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          is_active?: boolean
          plan_change_scheduled_at?: string | null
          plan_changed_at?: string | null
          plan_code: string
          plan_name?: string | null
          previous_plan_code?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          scheduled_plan_change_date?: string | null
          scheduled_plan_code?: string | null
          status?: string | null
          subscription_notes?: string | null
          suspended_at?: string | null
          tenant_org_id: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          activated_at?: string | null
          base_price?: number
          billing_cycle?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          currency?: string | null
          current_period_end?: string
          current_period_start?: string
          default_payment_method_id?: string | null
          discount_applied_at?: string | null
          discount_code?: string | null
          discount_duration_months?: number | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          is_active?: boolean
          plan_change_scheduled_at?: string | null
          plan_changed_at?: string | null
          plan_code?: string
          plan_name?: string | null
          previous_plan_code?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          scheduled_plan_change_date?: string | null
          scheduled_plan_code?: string | null
          status?: string | null
          subscription_notes?: string | null
          suspended_at?: string | null
          tenant_org_id?: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_pln_subscriptions_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_price_list_items_dtl: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          discount_percent: number | null
          id: string
          is_active: boolean
          max_quantity: number | null
          min_quantity: number | null
          price: number
          price_list_id: string
          product_id: string
          rec_status: number | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean
          max_quantity?: number | null
          min_quantity?: number | null
          price: number
          price_list_id: string
          product_id: string
          rec_status?: number | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean
          max_quantity?: number | null
          min_quantity?: number | null
          price?: number
          price_list_id?: string
          product_id?: string
          rec_status?: number | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_price_list_items_dtl_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "org_price_lists_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_price_list_items_dtl_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_price_list_items_dtl_tenant_org_id_product_id_fkey"
            columns: ["tenant_org_id", "product_id"]
            isOneToOne: false
            referencedRelation: "org_product_data_mst"
            referencedColumns: ["tenant_org_id", "id"]
          },
        ]
      }
      org_price_lists_mst: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          description: string | null
          description2: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          is_active: boolean
          is_default: boolean | null
          name: string
          name2: string | null
          price_list_type: string
          priority: number | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean | null
          name: string
          name2?: string | null
          price_list_type: string
          priority?: number | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean | null
          name?: string
          name2?: string | null
          price_list_type?: string
          priority?: number | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_price_lists_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_product_data_mst: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          default_express_sell_price: number | null
          default_sell_price: number | null
          extra_days: number | null
          hint_text: string | null
          id: string
          id_sku: string | null
          is_active: boolean
          is_retail_item: boolean | null
          is_tax_exempt: number | null
          item_type_code: string | null
          min_quantity: number | null
          min_sell_price: number | null
          multiplier_express: number | null
          pieces_per_product: number | null
          price_type: string | null
          product_code: string
          product_color1: string | null
          product_color2: string | null
          product_color3: string | null
          product_cost: number | null
          product_group1: string | null
          product_group2: string | null
          product_group3: string | null
          product_icon: string | null
          product_image: string | null
          product_name: string | null
          product_name2: string | null
          product_order: number | null
          product_type: number | null
          product_unit: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          service_category_code: string | null
          tags: Json | null
          tenant_org_id: string
          turnaround_hh: number | null
          turnaround_hh_express: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          default_express_sell_price?: number | null
          default_sell_price?: number | null
          extra_days?: number | null
          hint_text?: string | null
          id?: string
          id_sku?: string | null
          is_active?: boolean
          is_retail_item?: boolean | null
          is_tax_exempt?: number | null
          item_type_code?: string | null
          min_quantity?: number | null
          min_sell_price?: number | null
          multiplier_express?: number | null
          pieces_per_product?: number | null
          price_type?: string | null
          product_code: string
          product_color1?: string | null
          product_color2?: string | null
          product_color3?: string | null
          product_cost?: number | null
          product_group1?: string | null
          product_group2?: string | null
          product_group3?: string | null
          product_icon?: string | null
          product_image?: string | null
          product_name?: string | null
          product_name2?: string | null
          product_order?: number | null
          product_type?: number | null
          product_unit?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          service_category_code?: string | null
          tags?: Json | null
          tenant_org_id: string
          turnaround_hh?: number | null
          turnaround_hh_express?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          default_express_sell_price?: number | null
          default_sell_price?: number | null
          extra_days?: number | null
          hint_text?: string | null
          id?: string
          id_sku?: string | null
          is_active?: boolean
          is_retail_item?: boolean | null
          is_tax_exempt?: number | null
          item_type_code?: string | null
          min_quantity?: number | null
          min_sell_price?: number | null
          multiplier_express?: number | null
          pieces_per_product?: number | null
          price_type?: string | null
          product_code?: string
          product_color1?: string | null
          product_color2?: string | null
          product_color3?: string | null
          product_cost?: number | null
          product_group1?: string | null
          product_group2?: string | null
          product_group3?: string | null
          product_icon?: string | null
          product_image?: string | null
          product_name?: string | null
          product_name2?: string | null
          product_order?: number | null
          product_type?: number | null
          product_unit?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          service_category_code?: string | null
          tags?: Json | null
          tenant_org_id?: string
          turnaround_hh?: number | null
          turnaround_hh_express?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_org_prod_ctg"
            columns: ["tenant_org_id", "service_category_code"]
            isOneToOne: false
            referencedRelation: "org_service_category_cf"
            referencedColumns: ["tenant_org_id", "service_category_code"]
          },
          {
            foreignKeyName: "fk_org_prod_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_product_item_type"
            columns: ["item_type_code"]
            isOneToOne: false
            referencedRelation: "sys_item_type_cd"
            referencedColumns: ["item_type_code"]
          },
        ]
      }
      org_promo_codes_mst: {
        Row: {
          applicable_categories: Json | null
          created_at: string
          created_by: string | null
          created_info: string | null
          current_uses: number | null
          description: string | null
          description2: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          is_enabled: boolean
          max_discount_amount: number | null
          max_order_amount: number | null
          max_uses: number | null
          max_uses_per_customer: number | null
          metadata: Json | null
          min_order_amount: number | null
          promo_code: string
          promo_name: string | null
          promo_name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          applicable_categories?: Json | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          current_uses?: number | null
          description?: string | null
          description2?: string | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean
          is_enabled?: boolean
          max_discount_amount?: number | null
          max_order_amount?: number | null
          max_uses?: number | null
          max_uses_per_customer?: number | null
          metadata?: Json | null
          min_order_amount?: number | null
          promo_code: string
          promo_name?: string | null
          promo_name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          applicable_categories?: Json | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          current_uses?: number | null
          description?: string | null
          description2?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          is_enabled?: boolean
          max_discount_amount?: number | null
          max_order_amount?: number | null
          max_uses?: number | null
          max_uses_per_customer?: number | null
          metadata?: Json | null
          min_order_amount?: number | null
          promo_code?: string
          promo_name?: string | null
          promo_name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_promo_codes_tenant_fk"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_promo_usage_log: {
        Row: {
          customer_id: string | null
          discount_amount: number
          id: string
          invoice_id: string | null
          metadata: Json | null
          order_id: string | null
          order_total_after: number
          order_total_before: number
          promo_code_id: string
          tenant_org_id: string
          used_at: string
          used_by: string | null
        }
        Insert: {
          customer_id?: string | null
          discount_amount: number
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          order_id?: string | null
          order_total_after: number
          order_total_before: number
          promo_code_id: string
          tenant_org_id: string
          used_at?: string
          used_by?: string | null
        }
        Update: {
          customer_id?: string | null
          discount_amount?: number
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          order_id?: string | null
          order_total_after?: number
          order_total_before?: number
          promo_code_id?: string
          tenant_org_id?: string
          used_at?: string
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_promo_usage_promo_fk"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "org_promo_codes_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_promo_usage_tenant_fk"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_service_category_cf: {
        Row: {
          created_at: string
          created_by: string | null
          created_info: string | null
          display_name: string | null
          is_active: boolean | null
          is_enabled: boolean | null
          name: string | null
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          service_category_code: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          display_name?: string | null
          is_active?: boolean | null
          is_enabled?: boolean | null
          name?: string | null
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          service_category_code: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          display_name?: string | null
          is_active?: boolean | null
          is_enabled?: boolean | null
          name?: string | null
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          service_category_code?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_org_ctg_sys"
            columns: ["service_category_code"]
            isOneToOne: false
            referencedRelation: "sys_service_category_cd"
            referencedColumns: ["service_category_code"]
          },
          {
            foreignKeyName: "fk_org_ctg_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_subscriptions_mst: {
        Row: {
          auto_renew: boolean | null
          branch_limit: number | null
          cancellation_date: string | null
          cancellation_reason: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          end_date: string
          id: string
          is_active: boolean | null
          is_enabled: boolean | null
          last_invoice_date: string | null
          last_invoice_number: string | null
          last_payment_amount: number | null
          last_payment_date: string | null
          last_payment_method: string | null
          orders_limit: number | null
          orders_used: number | null
          payment_notes: string | null
          payment_reference: string | null
          plan: string | null
          rec_notes: string | null
          rec_status: number | null
          start_date: string | null
          status: string | null
          tenant_org_id: string
          trial_ends: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          user_limit: number | null
        }
        Insert: {
          auto_renew?: boolean | null
          branch_limit?: number | null
          cancellation_date?: string | null
          cancellation_reason?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          end_date: string
          id?: string
          is_active?: boolean | null
          is_enabled?: boolean | null
          last_invoice_date?: string | null
          last_invoice_number?: string | null
          last_payment_amount?: number | null
          last_payment_date?: string | null
          last_payment_method?: string | null
          orders_limit?: number | null
          orders_used?: number | null
          payment_notes?: string | null
          payment_reference?: string | null
          plan?: string | null
          rec_notes?: string | null
          rec_status?: number | null
          start_date?: string | null
          status?: string | null
          tenant_org_id: string
          trial_ends?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          user_limit?: number | null
        }
        Update: {
          auto_renew?: boolean | null
          branch_limit?: number | null
          cancellation_date?: string | null
          cancellation_reason?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          end_date?: string
          id?: string
          is_active?: boolean | null
          is_enabled?: boolean | null
          last_invoice_date?: string | null
          last_invoice_number?: string | null
          last_payment_amount?: number | null
          last_payment_date?: string | null
          last_payment_method?: string | null
          orders_limit?: number | null
          orders_used?: number | null
          payment_notes?: string | null
          payment_reference?: string | null
          plan?: string | null
          rec_notes?: string | null
          rec_status?: number | null
          start_date?: string | null
          status?: string | null
          tenant_org_id?: string
          trial_ends?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          user_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_org_subs_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_tenant_service_category_workflow_cf: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          service_category_code: string
          tenant_org_id: string
          track_individual_piece: boolean | null
          updated_at: string | null
          updated_by: string | null
          use_assembly_screen: boolean | null
          use_preparation_screen: boolean | null
          use_qa_screen: boolean | null
          workflow_template_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          service_category_code: string
          tenant_org_id: string
          track_individual_piece?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          use_assembly_screen?: boolean | null
          use_preparation_screen?: boolean | null
          use_qa_screen?: boolean | null
          workflow_template_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          service_category_code?: string
          tenant_org_id?: string
          track_individual_piece?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          use_assembly_screen?: boolean | null
          use_preparation_screen?: boolean | null
          use_qa_screen?: boolean | null
          workflow_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_service_category_workflow_category"
            columns: ["tenant_org_id", "service_category_code"]
            isOneToOne: true
            referencedRelation: "org_service_category_cf"
            referencedColumns: ["tenant_org_id", "service_category_code"]
          },
          {
            foreignKeyName: "org_tenant_service_category_workflow__workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "sys_workflow_template_cd"
            referencedColumns: ["template_id"]
          },
        ]
      }
      org_tenant_settings_cf: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          id: string
          is_active: boolean
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          setting_code: string
          setting_desc: string | null
          setting_name: string | null
          setting_name2: string | null
          setting_value: string | null
          setting_value_type: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          setting_code: string
          setting_desc?: string | null
          setting_name?: string | null
          setting_name2?: string | null
          setting_value?: string | null
          setting_value_type?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          setting_code?: string
          setting_desc?: string | null
          setting_name?: string | null
          setting_name2?: string | null
          setting_value?: string | null
          setting_value_type?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ots_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_tenant_workflow_settings_cf: {
        Row: {
          created_at: string | null
          created_by: string | null
          orders_split_enabled: boolean | null
          tenant_org_id: string
          track_individual_piece: boolean | null
          updated_at: string | null
          updated_by: string | null
          use_assembly_screen: boolean | null
          use_preparation_screen: boolean | null
          use_qa_screen: boolean | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          orders_split_enabled?: boolean | null
          tenant_org_id: string
          track_individual_piece?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          use_assembly_screen?: boolean | null
          use_preparation_screen?: boolean | null
          use_qa_screen?: boolean | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          orders_split_enabled?: boolean | null
          tenant_org_id?: string
          track_individual_piece?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          use_assembly_screen?: boolean | null
          use_preparation_screen?: boolean | null
          use_qa_screen?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "org_tenant_workflow_settings_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: true
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_tenant_workflow_templates_cf: {
        Row: {
          allow_back_steps: boolean | null
          created_at: string | null
          extra_config: Json | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          template_id: string
          tenant_org_id: string
          updated_at: string | null
        }
        Insert: {
          allow_back_steps?: boolean | null
          created_at?: string | null
          extra_config?: Json | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          template_id: string
          tenant_org_id: string
          updated_at?: string | null
        }
        Update: {
          allow_back_steps?: boolean | null
          created_at?: string | null
          extra_config?: Json | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          template_id?: string
          tenant_org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tenant_workflow_templates_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_tenant_workflow_templates_cf_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sys_workflow_template_cd"
            referencedColumns: ["template_id"]
          },
        ]
      }
      org_tenants_mst: {
        Row: {
          address: string | null
          brand_color_primary: string | null
          brand_color_secondary: string | null
          business_hours: Json | null
          business_type: string | null
          business_type_code: string | null
          city: string | null
          country: string | null
          country_code: string | null
          created_at: string | null
          currency: string | null
          date_format: string | null
          email: string
          feature_flags: Json | null
          first_day_of_week: number | null
          id: string
          is_active: boolean | null
          language: string | null
          logo_url: string | null
          name: string
          name2: string | null
          onboarding_completed: boolean | null
          phone: string
          phone_country_code: string | null
          s_current_plan: string | null
          slug: string
          status: string | null
          time_format: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          brand_color_primary?: string | null
          brand_color_secondary?: string | null
          business_hours?: Json | null
          business_type?: string | null
          business_type_code?: string | null
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          currency?: string | null
          date_format?: string | null
          email: string
          feature_flags?: Json | null
          first_day_of_week?: number | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          logo_url?: string | null
          name: string
          name2?: string | null
          onboarding_completed?: boolean | null
          phone: string
          phone_country_code?: string | null
          s_current_plan?: string | null
          slug: string
          status?: string | null
          time_format?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          brand_color_primary?: string | null
          brand_color_secondary?: string | null
          business_hours?: Json | null
          business_type?: string | null
          business_type_code?: string | null
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          currency?: string | null
          date_format?: string | null
          email?: string
          feature_flags?: Json | null
          first_day_of_week?: number | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          logo_url?: string | null
          name?: string
          name2?: string | null
          onboarding_completed?: boolean | null
          phone?: string
          phone_country_code?: string | null
          s_current_plan?: string | null
          slug?: string
          status?: string | null
          time_format?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tenant_business_type"
            columns: ["business_type_code"]
            isOneToOne: false
            referencedRelation: "sys_main_business_type_cd"
            referencedColumns: ["business_type_code"]
          },
        ]
      }
      org_usage_tracking: {
        Row: {
          api_calls: number | null
          branches_count: number | null
          created_at: string | null
          id: string
          orders_count: number | null
          period_end: string
          period_start: string
          storage_mb: number | null
          tenant_org_id: string
          updated_at: string | null
          users_count: number | null
        }
        Insert: {
          api_calls?: number | null
          branches_count?: number | null
          created_at?: string | null
          id?: string
          orders_count?: number | null
          period_end: string
          period_start: string
          storage_mb?: number | null
          tenant_org_id: string
          updated_at?: string | null
          users_count?: number | null
        }
        Update: {
          api_calls?: number | null
          branches_count?: number | null
          created_at?: string | null
          id?: string
          orders_count?: number | null
          period_end?: string
          period_start?: string
          storage_mb?: number | null
          tenant_org_id?: string
          updated_at?: string | null
          users_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "org_usage_tracking_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_users_mst: {
        Row: {
          address: string | null
          area: string | null
          building: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          display_name: string | null
          email: string | null
          failed_login_attempts: number | null
          first_name: string | null
          floor: string | null
          id: string
          is_active: boolean
          is_user: boolean
          last_failed_login_at: string | null
          last_login_at: string | null
          last_name: string | null
          lock_reason: string | null
          locked_until: string | null
          login_count: number | null
          main_branch_id: string | null
          name: string | null
          name2: string | null
          password_hash: string | null
          phone: string | null
          preferences: Json | null
          rec_notes: string | null
          rec_status: number | null
          role: string
          tenant_org_id: string
          type: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          area?: string | null
          building?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          display_name?: string | null
          email?: string | null
          failed_login_attempts?: number | null
          first_name?: string | null
          floor?: string | null
          id?: string
          is_active?: boolean
          is_user?: boolean
          last_failed_login_at?: string | null
          last_login_at?: string | null
          last_name?: string | null
          lock_reason?: string | null
          locked_until?: string | null
          login_count?: number | null
          main_branch_id?: string | null
          name?: string | null
          name2?: string | null
          password_hash?: string | null
          phone?: string | null
          preferences?: Json | null
          rec_notes?: string | null
          rec_status?: number | null
          role?: string
          tenant_org_id: string
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          area?: string | null
          building?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          display_name?: string | null
          email?: string | null
          failed_login_attempts?: number | null
          first_name?: string | null
          floor?: string | null
          id?: string
          is_active?: boolean
          is_user?: boolean
          last_failed_login_at?: string | null
          last_login_at?: string | null
          last_name?: string | null
          lock_reason?: string | null
          locked_until?: string | null
          login_count?: number | null
          main_branch_id?: string | null
          name?: string | null
          name2?: string | null
          password_hash?: string | null
          phone?: string | null
          preferences?: Json | null
          rec_notes?: string | null
          rec_status?: number | null
          role?: string
          tenant_org_id?: string
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_users_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_users_mst_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_locked_accounts"
            referencedColumns: ["user_id"]
          },
        ]
      }
      org_workflow_rules: {
        Row: {
          created_at: string | null
          from_status: string
          id: string
          is_allowed: boolean | null
          requires_role: string | null
          tenant_org_id: string
          to_status: string
          updated_at: string | null
          validation_rules: Json | null
        }
        Insert: {
          created_at?: string | null
          from_status: string
          id?: string
          is_allowed?: boolean | null
          requires_role?: string | null
          tenant_org_id: string
          to_status: string
          updated_at?: string | null
          validation_rules?: Json | null
        }
        Update: {
          created_at?: string | null
          from_status?: string
          id?: string
          is_allowed?: boolean | null
          requires_role?: string | null
          tenant_org_id?: string
          to_status?: string
          updated_at?: string | null
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_workflow_rules_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_workflow_settings_cf: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          quality_gate_rules: Json | null
          service_category_code: string | null
          status_transitions: Json
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          workflow_steps: Json
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          quality_gate_rules?: Json | null
          service_category_code?: string | null
          status_transitions?: Json
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          workflow_steps?: Json
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          quality_gate_rules?: Json | null
          service_category_code?: string | null
          status_transitions?: Json
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          workflow_steps?: Json
        }
        Relationships: [
          {
            foreignKeyName: "fk_workflow_settings_category"
            columns: ["tenant_org_id", "service_category_code"]
            isOneToOne: true
            referencedRelation: "org_service_category_cf"
            referencedColumns: ["tenant_org_id", "service_category_code"]
          },
          {
            foreignKeyName: "fk_workflow_settings_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_audit_log: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          request_id: string | null
          status: string | null
          tenant_org_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          request_id?: string | null
          status?: string | null
          tenant_org_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          request_id?: string | null
          status?: string | null
          tenant_org_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_audit_log_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_locked_accounts"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sys_auth_permissions: {
        Row: {
          category: string | null
          category_main: string | null
          code: string
          created_at: string | null
          created_by: string | null
          created_info: string | null
          description: string | null
          description2: string | null
          feature_code: string | null
          for_feature_only: number | null
          for_screen_only: number | null
          is_active: boolean
          is_enabled: boolean
          is_internal_use_only: boolean
          name: string | null
          name2: string | null
          rec_notes: string | null
          rec_status: number | null
          screen_code: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          category?: string | null
          category_main?: string | null
          code: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          feature_code?: string | null
          for_feature_only?: number | null
          for_screen_only?: number | null
          is_active?: boolean
          is_enabled?: boolean
          is_internal_use_only?: boolean
          name?: string | null
          name2?: string | null
          rec_notes?: string | null
          rec_status?: number | null
          screen_code?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          category?: string | null
          category_main?: string | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          feature_code?: string | null
          for_feature_only?: number | null
          for_screen_only?: number | null
          is_active?: boolean
          is_enabled?: boolean
          is_internal_use_only?: boolean
          name?: string | null
          name2?: string | null
          rec_notes?: string | null
          rec_status?: number | null
          screen_code?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_auth_role_default_permissions: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          is_active: boolean
          is_enabled: boolean
          permission_code: string
          rec_notes: string | null
          rec_status: number | null
          role_code: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean
          is_enabled?: boolean
          permission_code: string
          rec_notes?: string | null
          rec_status?: number | null
          role_code: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean
          is_enabled?: boolean
          permission_code?: string
          rec_notes?: string | null
          rec_status?: number | null
          role_code?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sys_default_perm_permission_code"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "sys_auth_permissions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fk_sys_default_perm_role_code"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "sys_auth_roles"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sys_auth_role_default_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "sys_auth_permissions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sys_auth_role_default_permissions_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "sys_auth_roles"
            referencedColumns: ["code"]
          },
        ]
      }
      sys_auth_roles: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          is_active: boolean
          is_system: boolean
          name: string
          name2: string | null
          old_role_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          is_system?: boolean
          name: string
          name2?: string | null
          old_role_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          is_system?: boolean
          name?: string
          name2?: string | null
          old_role_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_bill_discount_codes_mst: {
        Row: {
          applies_to: string | null
          code: string
          created_at: string | null
          created_by: string | null
          created_info: string | null
          description: string | null
          description_ar: string | null
          duration_months: number | null
          id: string
          is_active: boolean | null
          max_per_customer: number | null
          max_redemptions: number | null
          plan_codes: Json | null
          rec_notes: string | null
          rec_status: number | null
          times_redeemed: number | null
          type: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          valid_from: string | null
          valid_until: string | null
          value: number
        }
        Insert: {
          applies_to?: string | null
          code: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description_ar?: string | null
          duration_months?: number | null
          id?: string
          is_active?: boolean | null
          max_per_customer?: number | null
          max_redemptions?: number | null
          plan_codes?: Json | null
          rec_notes?: string | null
          rec_status?: number | null
          times_redeemed?: number | null
          type: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          valid_from?: string | null
          valid_until?: string | null
          value: number
        }
        Update: {
          applies_to?: string | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description_ar?: string | null
          duration_months?: number | null
          id?: string
          is_active?: boolean | null
          max_per_customer?: number | null
          max_redemptions?: number | null
          plan_codes?: Json | null
          rec_notes?: string | null
          rec_status?: number | null
          times_redeemed?: number | null
          type?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          valid_from?: string | null
          valid_until?: string | null
          value?: number
        }
        Relationships: []
      }
      sys_bill_discount_redemptions_tr: {
        Row: {
          created_by: string | null
          discount_amount: number | null
          discount_code: string
          id: string
          invoice_id: string | null
          redeemed_at: string | null
          tenant_org_id: string
        }
        Insert: {
          created_by?: string | null
          discount_amount?: number | null
          discount_code: string
          id?: string
          invoice_id?: string | null
          redeemed_at?: string | null
          tenant_org_id: string
        }
        Update: {
          created_by?: string | null
          discount_amount?: number | null
          discount_code?: string
          id?: string
          invoice_id?: string | null
          redeemed_at?: string | null
          tenant_org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sys_bill_discount_redemptions_tr_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sys_bill_invoices_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_bill_discount_redemptions_tr_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_bill_dunning_mst: {
        Row: {
          calls_made: number | null
          created_at: string | null
          created_by: string | null
          emails_sent: number | null
          first_failure_date: string
          id: string
          invoice_id: string
          last_retry_date: string | null
          max_retries: number | null
          resolution_method: string | null
          resolved_at: string | null
          retry_count: number | null
          status: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          calls_made?: number | null
          created_at?: string | null
          created_by?: string | null
          emails_sent?: number | null
          first_failure_date: string
          id?: string
          invoice_id: string
          last_retry_date?: string | null
          max_retries?: number | null
          resolution_method?: string | null
          resolved_at?: string | null
          retry_count?: number | null
          status?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          calls_made?: number | null
          created_at?: string | null
          created_by?: string | null
          emails_sent?: number | null
          first_failure_date?: string
          id?: string
          invoice_id?: string
          last_retry_date?: string | null
          max_retries?: number | null
          resolution_method?: string | null
          resolved_at?: string | null
          retry_count?: number | null
          status?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_bill_dunning_mst_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sys_bill_invoices_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_bill_dunning_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_bill_dunning_mst_tenant_org_id_invoice_id_fkey"
            columns: ["tenant_org_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "sys_bill_invoices_mst"
            referencedColumns: ["tenant_org_id", "id"]
          },
        ]
      }
      sys_bill_invoice_payments_tr: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          created_info: string | null
          currency: string | null
          failure_reason: string | null
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_gateway: string | null
          payment_gateway_fee: number | null
          payment_gateway_ref: string | null
          payment_method: string | null
          status: string | null
          tenant_org_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          currency?: string | null
          failure_reason?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date: string
          payment_gateway?: string | null
          payment_gateway_fee?: number | null
          payment_gateway_ref?: string | null
          payment_method?: string | null
          status?: string | null
          tenant_org_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          currency?: string | null
          failure_reason?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_gateway?: string | null
          payment_gateway_fee?: number | null
          payment_gateway_ref?: string | null
          payment_method?: string | null
          status?: string | null
          tenant_org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sys_bill_invoice_payments_tr_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sys_bill_invoices_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_bill_invoice_payments_tr_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_bill_invoice_payments_tr_tenant_org_id_invoice_id_fkey"
            columns: ["tenant_org_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "sys_bill_invoices_mst"
            referencedColumns: ["tenant_org_id", "id"]
          },
        ]
      }
      sys_bill_invoices_mst: {
        Row: {
          amount_due: number
          amount_paid: number | null
          billing_period_end: string
          billing_period_start: string
          created_at: string | null
          created_by: string | null
          created_info: string | null
          currency: string | null
          discount_total: number | null
          due_date: string
          id: string
          internal_notes: string | null
          invoice_date: string
          invoice_no: string
          line_items: Json
          notes: string | null
          paid_at: string | null
          payment_gateway: string | null
          payment_gateway_fee: number | null
          payment_gateway_ref: string | null
          payment_method: string | null
          plan_code: string
          plan_name: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          status: string | null
          subscription_id: string | null
          subtotal: number
          tax: number | null
          tenant_org_id: string
          total: number
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          amount_due: number
          amount_paid?: number | null
          billing_period_end: string
          billing_period_start: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          currency?: string | null
          discount_total?: number | null
          due_date: string
          id?: string
          internal_notes?: string | null
          invoice_date: string
          invoice_no: string
          line_items?: Json
          notes?: string | null
          paid_at?: string | null
          payment_gateway?: string | null
          payment_gateway_fee?: number | null
          payment_gateway_ref?: string | null
          payment_method?: string | null
          plan_code: string
          plan_name?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          status?: string | null
          subscription_id?: string | null
          subtotal: number
          tax?: number | null
          tenant_org_id: string
          total: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          amount_due?: number
          amount_paid?: number | null
          billing_period_end?: string
          billing_period_start?: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          currency?: string | null
          discount_total?: number | null
          due_date?: string
          id?: string
          internal_notes?: string | null
          invoice_date?: string
          invoice_no?: string
          line_items?: Json
          notes?: string | null
          paid_at?: string | null
          payment_gateway?: string | null
          payment_gateway_fee?: number | null
          payment_gateway_ref?: string | null
          payment_method?: string | null
          plan_code?: string
          plan_name?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          status?: string | null
          subscription_id?: string | null
          subtotal?: number
          tax?: number | null
          tenant_org_id?: string
          total?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_bill_invoices_mst_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "org_pln_subscriptions_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_bill_invoices_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_bill_payment_gateways_cf: {
        Row: {
          auto_capture: boolean | null
          created_at: string | null
          created_by: string | null
          credentials_encrypted: string | null
          gateway_code: string
          gateway_name: string
          id: string
          is_active: boolean | null
          is_active_flag: boolean | null
          is_default: boolean | null
          max_amount: number | null
          max_retries: number | null
          min_amount: number | null
          payment_methods: Json | null
          rec_status: number | null
          regions: Json | null
          retry_enabled: boolean | null
          transaction_fee_fixed: number | null
          transaction_fee_percentage: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          auto_capture?: boolean | null
          created_at?: string | null
          created_by?: string | null
          credentials_encrypted?: string | null
          gateway_code: string
          gateway_name: string
          id?: string
          is_active?: boolean | null
          is_active_flag?: boolean | null
          is_default?: boolean | null
          max_amount?: number | null
          max_retries?: number | null
          min_amount?: number | null
          payment_methods?: Json | null
          rec_status?: number | null
          regions?: Json | null
          retry_enabled?: boolean | null
          transaction_fee_fixed?: number | null
          transaction_fee_percentage?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          auto_capture?: boolean | null
          created_at?: string | null
          created_by?: string | null
          credentials_encrypted?: string | null
          gateway_code?: string
          gateway_name?: string
          id?: string
          is_active?: boolean | null
          is_active_flag?: boolean | null
          is_default?: boolean | null
          max_amount?: number | null
          max_retries?: number | null
          min_amount?: number | null
          payment_methods?: Json | null
          rec_status?: number | null
          regions?: Json | null
          retry_enabled?: boolean | null
          transaction_fee_fixed?: number | null
          transaction_fee_percentage?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_bill_payment_method_codes_cd: {
        Row: {
          auto_approve: boolean | null
          created_at: string | null
          created_by: string | null
          description: string | null
          description_ar: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          method_code: string
          method_color: string | null
          method_icon: string | null
          method_name: string
          method_name_ar: string | null
          rec_notes: string | null
          rec_status: number | null
          requires_verification: boolean | null
          type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          auto_approve?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description_ar?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          method_code: string
          method_color?: string | null
          method_icon?: string | null
          method_name: string
          method_name_ar?: string | null
          rec_notes?: string | null
          rec_status?: number | null
          requires_verification?: boolean | null
          type: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          auto_approve?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description_ar?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          method_code?: string
          method_color?: string | null
          method_icon?: string | null
          method_name?: string
          method_name_ar?: string | null
          rec_notes?: string | null
          rec_status?: number | null
          requires_verification?: boolean | null
          type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_bill_payment_methods_mst: {
        Row: {
          bank_account_last4: string | null
          bank_name: string | null
          card_brand: string | null
          card_exp_month: number | null
          card_exp_year: number | null
          card_last4: string | null
          created_at: string | null
          created_by: string | null
          gateway: string | null
          gateway_customer_id: string | null
          gateway_payment_method_id: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          is_verified: boolean | null
          tenant_org_id: string
          type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          bank_account_last4?: string | null
          bank_name?: string | null
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string | null
          created_by?: string | null
          gateway?: string | null
          gateway_customer_id?: string | null
          gateway_payment_method_id?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_verified?: boolean | null
          tenant_org_id: string
          type: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          bank_account_last4?: string | null
          bank_name?: string | null
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string | null
          created_by?: string | null
          gateway?: string | null
          gateway_customer_id?: string | null
          gateway_payment_method_id?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_verified?: boolean | null
          tenant_org_id?: string
          type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_bill_payment_methods_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_bill_revenue_metrics_monthly: {
        Row: {
          arpc: number | null
          arpu: number | null
          arr: number | null
          cac: number | null
          churned_customers: number | null
          churned_mrr: number | null
          contraction_mrr: number | null
          created_at: string | null
          expansion_mrr: number | null
          id: string
          ltv: number | null
          ltv_cac_ratio: number | null
          metric_month: string
          mrr: number | null
          mrr_growth_percentage: number | null
          new_customers: number | null
          new_mrr: number | null
          paying_customers: number | null
          total_customers: number | null
          trial_customers: number | null
          updated_at: string | null
        }
        Insert: {
          arpc?: number | null
          arpu?: number | null
          arr?: number | null
          cac?: number | null
          churned_customers?: number | null
          churned_mrr?: number | null
          contraction_mrr?: number | null
          created_at?: string | null
          expansion_mrr?: number | null
          id?: string
          ltv?: number | null
          ltv_cac_ratio?: number | null
          metric_month: string
          mrr?: number | null
          mrr_growth_percentage?: number | null
          new_customers?: number | null
          new_mrr?: number | null
          paying_customers?: number | null
          total_customers?: number | null
          trial_customers?: number | null
          updated_at?: string | null
        }
        Update: {
          arpc?: number | null
          arpu?: number | null
          arr?: number | null
          cac?: number | null
          churned_customers?: number | null
          churned_mrr?: number | null
          contraction_mrr?: number | null
          created_at?: string | null
          expansion_mrr?: number | null
          id?: string
          ltv?: number | null
          ltv_cac_ratio?: number | null
          metric_month?: string
          mrr?: number | null
          mrr_growth_percentage?: number | null
          new_customers?: number | null
          new_mrr?: number | null
          paying_customers?: number | null
          total_customers?: number | null
          trial_customers?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sys_bill_usage_metrics_daily: {
        Row: {
          active_users: number | null
          api_calls: number | null
          branches_count: number | null
          created_at: string | null
          id: string
          metric_date: string
          orders_cancelled: number | null
          orders_completed: number | null
          orders_count: number | null
          revenue: number | null
          storage_mb_used: number | null
          tenant_org_id: string
          total_users: number | null
          updated_at: string | null
        }
        Insert: {
          active_users?: number | null
          api_calls?: number | null
          branches_count?: number | null
          created_at?: string | null
          id?: string
          metric_date: string
          orders_cancelled?: number | null
          orders_completed?: number | null
          orders_count?: number | null
          revenue?: number | null
          storage_mb_used?: number | null
          tenant_org_id: string
          total_users?: number | null
          updated_at?: string | null
        }
        Update: {
          active_users?: number | null
          api_calls?: number | null
          branches_count?: number | null
          created_at?: string | null
          id?: string
          metric_date?: string
          orders_cancelled?: number | null
          orders_completed?: number | null
          orders_count?: number | null
          revenue?: number | null
          storage_mb_used?: number | null
          tenant_org_id?: string
          total_users?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_bill_usage_metrics_daily_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_billing_cycle_cd: {
        Row: {
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          cycle_type: string
          days: number | null
          description: string | null
          description2: string | null
          discount_percentage: number | null
          display_order: number | null
          icon: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_prepaid: boolean | null
          is_system: boolean | null
          metadata: Json | null
          months: number
          name: string
          name2: string | null
          rec_status: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          cycle_type: string
          days?: number | null
          description?: string | null
          description2?: string | null
          discount_percentage?: number | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_prepaid?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          months: number
          name: string
          name2?: string | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          cycle_type?: string
          days?: number | null
          description?: string | null
          description2?: string | null
          discount_percentage?: number | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_prepaid?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          months?: number
          name?: string
          name2?: string | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_business_type_template_cf: {
        Row: {
          business_type_code: string
          created_at: string | null
          created_by: string | null
          created_info: string | null
          is_default: boolean | null
          is_enabled: boolean | null
          item_code: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          service_category_code: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          business_type_code: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          is_default?: boolean | null
          is_enabled?: boolean | null
          item_code: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          service_category_code: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          business_type_code?: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          is_default?: boolean | null
          is_enabled?: boolean | null
          item_code?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          service_category_code?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_btt_business_type"
            columns: ["business_type_code"]
            isOneToOne: false
            referencedRelation: "sys_main_business_type_cd"
            referencedColumns: ["business_type_code"]
          },
          {
            foreignKeyName: "fk_btt_item_template"
            columns: ["item_code", "service_category_code"]
            isOneToOne: false
            referencedRelation: "sys_service_prod_templates_cd"
            referencedColumns: ["item_code", "service_category_code"]
          },
        ]
      }
      sys_code_table_audit_log: {
        Row: {
          action: string
          change_reason: string | null
          changed_at: string | null
          changed_by: string
          changed_fields: string[] | null
          id: string
          ip_address: string | null
          is_rollback: boolean | null
          new_values: Json | null
          old_values: Json | null
          record_code: string
          rollback_of_id: string | null
          table_name: string
          user_agent: string | null
        }
        Insert: {
          action: string
          change_reason?: string | null
          changed_at?: string | null
          changed_by: string
          changed_fields?: string[] | null
          id?: string
          ip_address?: string | null
          is_rollback?: boolean | null
          new_values?: Json | null
          old_values?: Json | null
          record_code: string
          rollback_of_id?: string | null
          table_name: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string
          changed_fields?: string[] | null
          id?: string
          ip_address?: string | null
          is_rollback?: boolean | null
          new_values?: Json | null
          old_values?: Json | null
          record_code?: string
          rollback_of_id?: string | null
          table_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_code_table_audit_log_rollback_of_id_fkey"
            columns: ["rollback_of_id"]
            isOneToOne: false
            referencedRelation: "sys_code_table_audit_log"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_code_tables_registry: {
        Row: {
          category: string | null
          code_pattern: string | null
          created_at: string | null
          current_version: number | null
          description: string | null
          description2: string | null
          display_name: string
          display_name2: string | null
          display_order: number | null
          is_editable: boolean | null
          is_extensible: boolean | null
          last_seeded_at: string | null
          max_code_length: number | null
          metadata: Json | null
          requires_unique_name: boolean | null
          supports_tenant_override: boolean | null
          table_name: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          code_pattern?: string | null
          created_at?: string | null
          current_version?: number | null
          description?: string | null
          description2?: string | null
          display_name: string
          display_name2?: string | null
          display_order?: number | null
          is_editable?: boolean | null
          is_extensible?: boolean | null
          last_seeded_at?: string | null
          max_code_length?: number | null
          metadata?: Json | null
          requires_unique_name?: boolean | null
          supports_tenant_override?: boolean | null
          table_name: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          code_pattern?: string | null
          created_at?: string | null
          current_version?: number | null
          description?: string | null
          description2?: string | null
          display_name?: string
          display_name2?: string | null
          display_order?: number | null
          is_editable?: boolean | null
          is_extensible?: boolean | null
          last_seeded_at?: string | null
          max_code_length?: number | null
          metadata?: Json | null
          requires_unique_name?: boolean | null
          supports_tenant_override?: boolean | null
          table_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sys_components_cd: {
        Row: {
          badge: string | null
          color1: string | null
          color2: string | null
          color3: string | null
          comp_code: string
          comp_icon: string | null
          comp_id: string
          comp_image: string | null
          comp_level: number | null
          comp_path: string | null
          comp_value1: string | null
          comp_value2: string | null
          comp_value3: string | null
          comp_value4: string | null
          comp_value5: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          description: string | null
          description2: string | null
          display_order: number | null
          feature_code: string | null
          feature_flag: Json | null
          is_active: boolean | null
          is_for_tenant_use: boolean | null
          is_leaf: boolean | null
          is_navigable: boolean | null
          is_system: boolean | null
          label: string | null
          label2: string | null
          main_permission_code: string | null
          metadata: Json | null
          parent_comp_code: string | null
          parent_comp_id: string | null
          permissions: Json | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          require_all_permissions: boolean | null
          role_code: string | null
          roles: Json | null
          screen_code: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          badge?: string | null
          color1?: string | null
          color2?: string | null
          color3?: string | null
          comp_code: string
          comp_icon?: string | null
          comp_id?: string
          comp_image?: string | null
          comp_level?: number | null
          comp_path?: string | null
          comp_value1?: string | null
          comp_value2?: string | null
          comp_value3?: string | null
          comp_value4?: string | null
          comp_value5?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          feature_code?: string | null
          feature_flag?: Json | null
          is_active?: boolean | null
          is_for_tenant_use?: boolean | null
          is_leaf?: boolean | null
          is_navigable?: boolean | null
          is_system?: boolean | null
          label?: string | null
          label2?: string | null
          main_permission_code?: string | null
          metadata?: Json | null
          parent_comp_code?: string | null
          parent_comp_id?: string | null
          permissions?: Json | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          require_all_permissions?: boolean | null
          role_code?: string | null
          roles?: Json | null
          screen_code?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          badge?: string | null
          color1?: string | null
          color2?: string | null
          color3?: string | null
          comp_code?: string
          comp_icon?: string | null
          comp_id?: string
          comp_image?: string | null
          comp_level?: number | null
          comp_path?: string | null
          comp_value1?: string | null
          comp_value2?: string | null
          comp_value3?: string | null
          comp_value4?: string | null
          comp_value5?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          feature_code?: string | null
          feature_flag?: Json | null
          is_active?: boolean | null
          is_for_tenant_use?: boolean | null
          is_leaf?: boolean | null
          is_navigable?: boolean | null
          is_system?: boolean | null
          label?: string | null
          label2?: string | null
          main_permission_code?: string | null
          metadata?: Json | null
          parent_comp_code?: string | null
          parent_comp_id?: string | null
          permissions?: Json | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          require_all_permissions?: boolean | null
          role_code?: string | null
          roles?: Json | null
          screen_code?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_comp_parent"
            columns: ["parent_comp_id"]
            isOneToOne: false
            referencedRelation: "sys_components_cd"
            referencedColumns: ["comp_id"]
          },
        ]
      }
      sys_country_cd: {
        Row: {
          address_format: string | null
          code: string
          color: string | null
          continent: string | null
          created_at: string | null
          created_by: string | null
          default_currency_code: string | null
          default_language_code: string | null
          default_timezone_code: string | null
          description: string | null
          description2: string | null
          display_order: number | null
          icon: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_system: boolean | null
          iso_alpha3: string | null
          iso_code: string
          iso_numeric: number | null
          metadata: Json | null
          name: string
          name2: string | null
          phone_code: string | null
          rec_status: number | null
          region: string | null
          subregion: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          address_format?: string | null
          code: string
          color?: string | null
          continent?: string | null
          created_at?: string | null
          created_by?: string | null
          default_currency_code?: string | null
          default_language_code?: string | null
          default_timezone_code?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          iso_alpha3?: string | null
          iso_code: string
          iso_numeric?: number | null
          metadata?: Json | null
          name: string
          name2?: string | null
          phone_code?: string | null
          rec_status?: number | null
          region?: string | null
          subregion?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          address_format?: string | null
          code?: string
          color?: string | null
          continent?: string | null
          created_at?: string | null
          created_by?: string | null
          default_currency_code?: string | null
          default_language_code?: string | null
          default_timezone_code?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          iso_alpha3?: string | null
          iso_code?: string
          iso_numeric?: number | null
          metadata?: Json | null
          name?: string
          name2?: string | null
          phone_code?: string | null
          rec_status?: number | null
          region?: string | null
          subregion?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_currency_cd: {
        Row: {
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          decimal_places: number | null
          decimal_separator: string | null
          description: string | null
          description2: string | null
          display_order: number | null
          icon: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_system: boolean | null
          iso_code: string
          iso_numeric: number | null
          metadata: Json | null
          name: string
          name2: string | null
          rec_status: number | null
          symbol: string
          symbol_position: string | null
          thousands_separator: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          decimal_places?: number | null
          decimal_separator?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          iso_code: string
          iso_numeric?: number | null
          metadata?: Json | null
          name: string
          name2?: string | null
          rec_status?: number | null
          symbol: string
          symbol_position?: string | null
          thousands_separator?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          decimal_places?: number | null
          decimal_separator?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          iso_code?: string
          iso_numeric?: number | null
          metadata?: Json | null
          name?: string
          name2?: string | null
          rec_status?: number | null
          symbol?: string
          symbol_position?: string | null
          thousands_separator?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_customers_mst: {
        Row: {
          address: string | null
          area: string | null
          avatar_url: string | null
          building: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          customer_number: string | null
          customer_source_type: string
          display_name: string | null
          email: string | null
          email_verified: boolean | null
          first_name: string | null
          first_tenant_org_id: string | null
          floor: string | null
          id: string
          last_name: string | null
          name: string | null
          name2: string | null
          phone: string | null
          phone_verified: boolean | null
          preferences: Json | null
          profile_status: string | null
          type: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          address?: string | null
          area?: string | null
          avatar_url?: string | null
          building?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          customer_number?: string | null
          customer_source_type?: string
          display_name?: string | null
          email?: string | null
          email_verified?: boolean | null
          first_name?: string | null
          first_tenant_org_id?: string | null
          floor?: string | null
          id?: string
          last_name?: string | null
          name?: string | null
          name2?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          preferences?: Json | null
          profile_status?: string | null
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          address?: string | null
          area?: string | null
          avatar_url?: string | null
          building?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          customer_number?: string | null
          customer_source_type?: string
          display_name?: string | null
          email?: string | null
          email_verified?: boolean | null
          first_name?: string | null
          first_tenant_org_id?: string | null
          floor?: string | null
          id?: string
          last_name?: string | null
          name?: string | null
          name2?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          preferences?: Json | null
          profile_status?: string | null
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_fabric_type_cd: {
        Row: {
          can_bleach: boolean | null
          can_iron: boolean | null
          care_level: string | null
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          display_order: number | null
          fabric_category: string | null
          icon: string | null
          iron_temperature: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_system: boolean | null
          metadata: Json | null
          name: string
          name2: string | null
          rec_status: number | null
          requires_dry_clean: boolean | null
          requires_hand_wash: boolean | null
          temperature_max_celsius: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          can_bleach?: boolean | null
          can_iron?: boolean | null
          care_level?: string | null
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          fabric_category?: string | null
          icon?: string | null
          iron_temperature?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          name: string
          name2?: string | null
          rec_status?: number | null
          requires_dry_clean?: boolean | null
          requires_hand_wash?: boolean | null
          temperature_max_celsius?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          can_bleach?: boolean | null
          can_iron?: boolean | null
          care_level?: string | null
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          fabric_category?: string | null
          icon?: string | null
          iron_temperature?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          name?: string
          name2?: string | null
          rec_status?: number | null
          requires_dry_clean?: boolean | null
          requires_hand_wash?: boolean | null
          temperature_max_celsius?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_garment_type_cd: {
        Row: {
          care_instructions: string | null
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          default_base_price: number | null
          default_service_types: string[] | null
          description: string | null
          description2: string | null
          display_order: number | null
          estimated_processing_hours: number | null
          garment_category: string | null
          gender: string | null
          handling_multiplier: number | null
          icon: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_system: boolean | null
          metadata: Json | null
          name: string
          name2: string | null
          rec_status: number | null
          requires_special_handling: boolean | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          care_instructions?: string | null
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          default_base_price?: number | null
          default_service_types?: string[] | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          estimated_processing_hours?: number | null
          garment_category?: string | null
          gender?: string | null
          handling_multiplier?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          name: string
          name2?: string | null
          rec_status?: number | null
          requires_special_handling?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          care_instructions?: string | null
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          default_base_price?: number | null
          default_service_types?: string[] | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          estimated_processing_hours?: number | null
          garment_category?: string | null
          gender?: string | null
          handling_multiplier?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          name?: string
          name2?: string | null
          rec_status?: number | null
          requires_special_handling?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_issue_type_cd: {
        Row: {
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          default_resolution_action: string | null
          description: string | null
          description2: string | null
          display_order: number | null
          estimated_resolution_hours: number | null
          icon: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_system: boolean | null
          issue_category: string | null
          metadata: Json | null
          name: string
          name2: string | null
          rec_status: number | null
          requires_customer_notification: boolean | null
          requires_refund: boolean | null
          requires_replacement: boolean | null
          severity_level: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          default_resolution_action?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          estimated_resolution_hours?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          issue_category?: string | null
          metadata?: Json | null
          name: string
          name2?: string | null
          rec_status?: number | null
          requires_customer_notification?: boolean | null
          requires_refund?: boolean | null
          requires_replacement?: boolean | null
          severity_level?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          default_resolution_action?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          estimated_resolution_hours?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          issue_category?: string | null
          metadata?: Json | null
          name?: string
          name2?: string | null
          rec_status?: number | null
          requires_customer_notification?: boolean | null
          requires_refund?: boolean | null
          requires_replacement?: boolean | null
          severity_level?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_item_type_cd: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          display_order: number | null
          icon: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_garment: boolean | null
          is_retail: boolean | null
          is_system: boolean | null
          item_type_code: string
          metadata: Json | null
          name: string
          name2: string | null
          rec_order: number | null
          rec_status: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_garment?: boolean | null
          is_retail?: boolean | null
          is_system?: boolean | null
          item_type_code: string
          metadata?: Json | null
          name: string
          name2?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_garment?: boolean | null
          is_retail?: boolean | null
          is_system?: boolean | null
          item_type_code?: string
          metadata?: Json | null
          name?: string
          name2?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_items_data_list_cd: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          hint_text: string | null
          hint_text2: string | null
          id_sku: string | null
          is_active: boolean
          is_retail_item: boolean | null
          item_code: string
          item_color1: string | null
          item_color2: string | null
          item_color3: string | null
          item_icon: string | null
          item_image: string | null
          item_name: string
          item_name2: string | null
          item_type_code: string | null
          metadata: Json | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          tags: Json | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          hint_text?: string | null
          hint_text2?: string | null
          id_sku?: string | null
          is_active?: boolean
          is_retail_item?: boolean | null
          item_code: string
          item_color1?: string | null
          item_color2?: string | null
          item_color3?: string | null
          item_icon?: string | null
          item_image?: string | null
          item_name: string
          item_name2?: string | null
          item_type_code?: string | null
          metadata?: Json | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tags?: Json | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          hint_text?: string | null
          hint_text2?: string | null
          id_sku?: string | null
          is_active?: boolean
          is_retail_item?: boolean | null
          item_code?: string
          item_color1?: string | null
          item_color2?: string | null
          item_color3?: string | null
          item_icon?: string | null
          item_image?: string | null
          item_name?: string
          item_name2?: string | null
          item_type_code?: string | null
          metadata?: Json | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tags?: Json | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_item_type"
            columns: ["item_type_code"]
            isOneToOne: false
            referencedRelation: "sys_item_type_cd"
            referencedColumns: ["item_type_code"]
          },
        ]
      }
      sys_language_cd: {
        Row: {
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          date_format: string | null
          description: string | null
          description2: string | null
          display_order: number | null
          icon: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_rtl: boolean | null
          is_system: boolean | null
          iso_639_2: string | null
          iso_code: string
          locale_code: string | null
          metadata: Json | null
          name: string
          name2: string | null
          rec_status: number | null
          time_format: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          date_format?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_rtl?: boolean | null
          is_system?: boolean | null
          iso_639_2?: string | null
          iso_code: string
          locale_code?: string | null
          metadata?: Json | null
          name: string
          name2?: string | null
          rec_status?: number | null
          time_format?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          date_format?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_rtl?: boolean | null
          is_system?: boolean | null
          iso_639_2?: string | null
          iso_code?: string
          locale_code?: string | null
          metadata?: Json | null
          name?: string
          name2?: string | null
          rec_status?: number | null
          time_format?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_main_business_type_cd: {
        Row: {
          business_type_code: string
          business_type_color1: string | null
          business_type_color2: string | null
          business_type_color3: string | null
          business_type_desc: string | null
          business_type_desc2: string | null
          business_type_icon: string | null
          business_type_image: string | null
          business_type_name: string
          business_type_name2: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          default_features: Json | null
          default_settings: Json | null
          is_active: boolean
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          business_type_code: string
          business_type_color1?: string | null
          business_type_color2?: string | null
          business_type_color3?: string | null
          business_type_desc?: string | null
          business_type_desc2?: string | null
          business_type_icon?: string | null
          business_type_image?: string | null
          business_type_name: string
          business_type_name2?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          default_features?: Json | null
          default_settings?: Json | null
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          business_type_code?: string
          business_type_color1?: string | null
          business_type_color2?: string | null
          business_type_color3?: string | null
          business_type_desc?: string | null
          business_type_desc2?: string | null
          business_type_icon?: string | null
          business_type_image?: string | null
          business_type_name?: string
          business_type_name2?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          default_features?: Json | null
          default_settings?: Json | null
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_metric_type_cd: {
        Row: {
          aggregation_period: string | null
          calculation_formula: string | null
          category_code: string | null
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          critical_threshold: number | null
          data_type: string
          decimal_places: number | null
          description: string | null
          description2: string | null
          display_order: number | null
          format_pattern: string | null
          icon: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_system: boolean | null
          metadata: Json | null
          metric_group: string | null
          name: string
          name2: string | null
          rec_status: number | null
          requires_date_range: boolean | null
          show_percentage: boolean | null
          show_trend: boolean | null
          target_value: number | null
          unit: string | null
          updated_at: string | null
          updated_by: string | null
          warning_threshold: number | null
        }
        Insert: {
          aggregation_period?: string | null
          calculation_formula?: string | null
          category_code?: string | null
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          critical_threshold?: number | null
          data_type: string
          decimal_places?: number | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          format_pattern?: string | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          metric_group?: string | null
          name: string
          name2?: string | null
          rec_status?: number | null
          requires_date_range?: boolean | null
          show_percentage?: boolean | null
          show_trend?: boolean | null
          target_value?: number | null
          unit?: string | null
          updated_at?: string | null
          updated_by?: string | null
          warning_threshold?: number | null
        }
        Update: {
          aggregation_period?: string | null
          calculation_formula?: string | null
          category_code?: string | null
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          critical_threshold?: number | null
          data_type?: string
          decimal_places?: number | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          format_pattern?: string | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          metric_group?: string | null
          name?: string
          name2?: string | null
          rec_status?: number | null
          requires_date_range?: boolean | null
          show_percentage?: boolean | null
          show_trend?: boolean | null
          target_value?: number | null
          unit?: string | null
          updated_at?: string | null
          updated_by?: string | null
          warning_threshold?: number | null
        }
        Relationships: []
      }
      sys_notification_channel_cd: {
        Row: {
          channel_type: string | null
          code: string
          color: string | null
          cost_per_message: number | null
          created_at: string | null
          created_by: string | null
          daily_limit: number | null
          description: string | null
          description2: string | null
          display_order: number | null
          icon: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_system: boolean | null
          max_length: number | null
          metadata: Json | null
          name: string
          name2: string | null
          rate_limit_per_minute: number | null
          rec_status: number | null
          requires_configuration: boolean | null
          supports_attachments: boolean | null
          supports_rich_content: boolean | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          channel_type?: string | null
          code: string
          color?: string | null
          cost_per_message?: number | null
          created_at?: string | null
          created_by?: string | null
          daily_limit?: number | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          max_length?: number | null
          metadata?: Json | null
          name: string
          name2?: string | null
          rate_limit_per_minute?: number | null
          rec_status?: number | null
          requires_configuration?: boolean | null
          supports_attachments?: boolean | null
          supports_rich_content?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          channel_type?: string | null
          code?: string
          color?: string | null
          cost_per_message?: number | null
          created_at?: string | null
          created_by?: string | null
          daily_limit?: number | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          max_length?: number | null
          metadata?: Json | null
          name?: string
          name2?: string | null
          rate_limit_per_minute?: number | null
          rec_status?: number | null
          requires_configuration?: boolean | null
          supports_attachments?: boolean | null
          supports_rich_content?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_notification_type_cd: {
        Row: {
          auto_send: boolean | null
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          default_body_template: string | null
          default_subject: string | null
          default_template_code: string | null
          description: string | null
          description2: string | null
          display_order: number | null
          icon: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_system: boolean | null
          metadata: Json | null
          name: string
          name2: string | null
          notification_category: string | null
          priority: string | null
          rec_status: number | null
          requires_action: boolean | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          auto_send?: boolean | null
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          default_body_template?: string | null
          default_subject?: string | null
          default_template_code?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          name: string
          name2?: string | null
          notification_category?: string | null
          priority?: string | null
          rec_status?: number | null
          requires_action?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          auto_send?: boolean | null
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          default_body_template?: string | null
          default_subject?: string | null
          default_template_code?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          name?: string
          name2?: string | null
          notification_category?: string | null
          priority?: string | null
          rec_status?: number | null
          requires_action?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_order_status_cd: {
        Row: {
          allowed_next_statuses: string[] | null
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          default_sla_hours: number | null
          description: string | null
          description2: string | null
          display_order: number | null
          icon: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_final_status: boolean | null
          is_initial_status: boolean | null
          is_system: boolean | null
          metadata: Json | null
          name: string
          name2: string | null
          rec_status: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          allowed_next_statuses?: string[] | null
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          default_sla_hours?: number | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_final_status?: boolean | null
          is_initial_status?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          name: string
          name2?: string | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          allowed_next_statuses?: string[] | null
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          default_sla_hours?: number | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_final_status?: boolean | null
          is_initial_status?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          name?: string
          name2?: string | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_order_type_cd: {
        Row: {
          created_at: string | null
          is_active: boolean
          order_type_color1: string | null
          order_type_color2: string | null
          order_type_color3: string | null
          order_type_icon: string | null
          order_type_id: string
          order_type_image: string | null
          order_type_name: string | null
          order_type_name2: string | null
          rec_notes: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          is_active?: boolean
          order_type_color1?: string | null
          order_type_color2?: string | null
          order_type_color3?: string | null
          order_type_icon?: string | null
          order_type_id: string
          order_type_image?: string | null
          order_type_name?: string | null
          order_type_name2?: string | null
          rec_notes?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          is_active?: boolean
          order_type_color1?: string | null
          order_type_color2?: string | null
          order_type_color3?: string | null
          order_type_icon?: string | null
          order_type_id?: string
          order_type_image?: string | null
          order_type_name?: string | null
          order_type_name2?: string | null
          rec_notes?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sys_otp_codes: {
        Row: {
          attempts: number | null
          code: string
          created_at: string | null
          expires_at: string
          id: string
          phone: string
          purpose: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number | null
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          phone: string
          purpose: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number | null
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          phone?: string
          purpose?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      sys_payment_gateway_cd: {
        Row: {
          available_for_plans: string[] | null
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          display_order: number | null
          fee_fixed_amount: number | null
          fee_percentage: number | null
          gateway_type: string
          has_transaction_fee: boolean | null
          icon: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_online: boolean | null
          is_system: boolean | null
          logo_url: string | null
          max_transaction_amount: number | null
          metadata: Json | null
          min_transaction_amount: number | null
          name: string
          name2: string | null
          rec_status: number | null
          requires_api_key: boolean | null
          supported_currencies: string[] | null
          supported_payment_methods: string[] | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          available_for_plans?: string[] | null
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          fee_fixed_amount?: number | null
          fee_percentage?: number | null
          gateway_type: string
          has_transaction_fee?: boolean | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_online?: boolean | null
          is_system?: boolean | null
          logo_url?: string | null
          max_transaction_amount?: number | null
          metadata?: Json | null
          min_transaction_amount?: number | null
          name: string
          name2?: string | null
          rec_status?: number | null
          requires_api_key?: boolean | null
          supported_currencies?: string[] | null
          supported_payment_methods?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          available_for_plans?: string[] | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          fee_fixed_amount?: number | null
          fee_percentage?: number | null
          gateway_type?: string
          has_transaction_fee?: boolean | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_online?: boolean | null
          is_system?: boolean | null
          logo_url?: string | null
          max_transaction_amount?: number | null
          metadata?: Json | null
          min_transaction_amount?: number | null
          name?: string
          name2?: string | null
          rec_status?: number | null
          requires_api_key?: boolean | null
          supported_currencies?: string[] | null
          supported_payment_methods?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_payment_method_cd: {
        Row: {
          created_at: string | null
          is_active: boolean
          is_enabled: boolean
          payment_method_code: string
          payment_method_name: string | null
          payment_method_name2: string | null
          payment_type_color1: string | null
          payment_type_color2: string | null
          payment_type_color3: string | null
          payment_type_icon: string | null
          payment_type_image: string | null
          rec_notes: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          is_active?: boolean
          is_enabled?: boolean
          payment_method_code: string
          payment_method_name?: string | null
          payment_method_name2?: string | null
          payment_type_color1?: string | null
          payment_type_color2?: string | null
          payment_type_color3?: string | null
          payment_type_icon?: string | null
          payment_type_image?: string | null
          rec_notes?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          is_active?: boolean
          is_enabled?: boolean
          payment_method_code?: string
          payment_method_name?: string | null
          payment_method_name2?: string | null
          payment_type_color1?: string | null
          payment_type_color2?: string | null
          payment_type_color3?: string | null
          payment_type_icon?: string | null
          payment_type_image?: string | null
          rec_notes?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sys_payment_status_cd: {
        Row: {
          allows_retry: boolean | null
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          display_order: number | null
          icon: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_failed: boolean | null
          is_final: boolean | null
          is_successful: boolean | null
          is_system: boolean | null
          metadata: Json | null
          name: string
          name2: string | null
          rec_status: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          allows_retry?: boolean | null
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_failed?: boolean | null
          is_final?: boolean | null
          is_successful?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          name: string
          name2?: string | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          allows_retry?: boolean | null
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_failed?: boolean | null
          is_final?: boolean | null
          is_successful?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          name?: string
          name2?: string | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_payment_type_cd: {
        Row: {
          created_at: string | null
          has_plan: boolean
          is_active: boolean
          is_enabled: boolean
          payment_type_color1: string | null
          payment_type_color2: string | null
          payment_type_color3: string | null
          payment_type_icon: string | null
          payment_type_id: string
          payment_type_image: string | null
          payment_type_name: string | null
          payment_type_name2: string | null
          rec_notes: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          has_plan?: boolean
          is_active?: boolean
          is_enabled?: boolean
          payment_type_color1?: string | null
          payment_type_color2?: string | null
          payment_type_color3?: string | null
          payment_type_icon?: string | null
          payment_type_id: string
          payment_type_image?: string | null
          payment_type_name?: string | null
          payment_type_name2?: string | null
          rec_notes?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          has_plan?: boolean
          is_active?: boolean
          is_enabled?: boolean
          payment_type_color1?: string | null
          payment_type_color2?: string | null
          payment_type_color3?: string | null
          payment_type_icon?: string | null
          payment_type_id?: string
          payment_type_image?: string | null
          payment_type_name?: string | null
          payment_type_name2?: string | null
          rec_notes?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sys_permission_cd: {
        Row: {
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          display_order: number | null
          icon: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_system: boolean | null
          metadata: Json | null
          name: string
          name2: string | null
          permission_category: string | null
          permission_type: string | null
          rbac_permission_code: string | null
          rec_status: number | null
          resource_name: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          name: string
          name2?: string | null
          permission_category?: string | null
          permission_type?: string | null
          rbac_permission_code?: string | null
          rec_status?: number | null
          resource_name?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          name?: string
          name2?: string | null
          permission_category?: string | null
          permission_type?: string | null
          rbac_permission_code?: string | null
          rec_status?: number | null
          resource_name?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_plan_features_cd: {
        Row: {
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          default_value: string | null
          description: string | null
          description2: string | null
          display_order: number | null
          feature_category: string | null
          feature_type: string | null
          icon: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_system: boolean | null
          max_value: number | null
          metadata: Json | null
          name: string
          name2: string | null
          rec_status: number | null
          unit: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          default_value?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          feature_category?: string | null
          feature_type?: string | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          max_value?: number | null
          metadata?: Json | null
          name: string
          name2?: string | null
          rec_status?: number | null
          unit?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          default_value?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          feature_category?: string | null
          feature_type?: string | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          max_value?: number | null
          metadata?: Json | null
          name?: string
          name2?: string | null
          rec_status?: number | null
          unit?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_plan_limits: {
        Row: {
          branches_limit: number
          created_at: string | null
          display_order: number | null
          feature_flags: Json
          is_active: boolean | null
          is_public: boolean | null
          orders_limit: number
          plan_code: string
          plan_description: string | null
          plan_description2: string | null
          plan_name: string
          plan_name2: string | null
          price_monthly: number
          price_yearly: number | null
          storage_mb_limit: number
          updated_at: string | null
          users_limit: number
        }
        Insert: {
          branches_limit: number
          created_at?: string | null
          display_order?: number | null
          feature_flags: Json
          is_active?: boolean | null
          is_public?: boolean | null
          orders_limit: number
          plan_code: string
          plan_description?: string | null
          plan_description2?: string | null
          plan_name: string
          plan_name2?: string | null
          price_monthly: number
          price_yearly?: number | null
          storage_mb_limit: number
          updated_at?: string | null
          users_limit: number
        }
        Update: {
          branches_limit?: number
          created_at?: string | null
          display_order?: number | null
          feature_flags?: Json
          is_active?: boolean | null
          is_public?: boolean | null
          orders_limit?: number
          plan_code?: string
          plan_description?: string | null
          plan_description2?: string | null
          plan_name?: string
          plan_name2?: string | null
          price_monthly?: number
          price_yearly?: number | null
          storage_mb_limit?: number
          updated_at?: string | null
          users_limit?: number
        }
        Relationships: []
      }
      sys_plans_mst: {
        Row: {
          base_price_annual: number | null
          base_price_monthly: number | null
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          currency_code: string | null
          description: string | null
          description2: string | null
          display_order: number | null
          icon: string | null
          includes_features: string[] | null
          is_active: boolean | null
          is_default: boolean | null
          is_system: boolean | null
          max_storage_gb: number | null
          max_tenants: number | null
          max_users_per_tenant: number | null
          metadata: Json | null
          name: string
          name2: string | null
          plan_tier: string | null
          rec_status: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          base_price_annual?: number | null
          base_price_monthly?: number | null
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          currency_code?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          includes_features?: string[] | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          max_storage_gb?: number | null
          max_tenants?: number | null
          max_users_per_tenant?: number | null
          metadata?: Json | null
          name: string
          name2?: string | null
          plan_tier?: string | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          base_price_annual?: number | null
          base_price_monthly?: number | null
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          currency_code?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          includes_features?: string[] | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          max_storage_gb?: number | null
          max_tenants?: number | null
          max_users_per_tenant?: number | null
          metadata?: Json | null
          name?: string
          name2?: string | null
          plan_tier?: string | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_pln_subscription_plans_mst: {
        Row: {
          annual_price: number | null
          base_price: number
          billing_cycle: string
          created_at: string | null
          created_by: string | null
          created_info: string | null
          currency: string | null
          description: string | null
          description_ar: string | null
          display_order: number | null
          features: Json
          id: string
          is_active: boolean | null
          is_default: boolean | null
          is_public: boolean | null
          limits: Json
          overage_pricing: Json | null
          plan_code: string
          plan_color: string | null
          plan_icon: string | null
          plan_name: string
          plan_name_ar: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          recommended: boolean | null
          setup_fee: number | null
          trial_days: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          annual_price?: number | null
          base_price?: number
          billing_cycle?: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          currency?: string | null
          description?: string | null
          description_ar?: string | null
          display_order?: number | null
          features?: Json
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_public?: boolean | null
          limits?: Json
          overage_pricing?: Json | null
          plan_code: string
          plan_color?: string | null
          plan_icon?: string | null
          plan_name: string
          plan_name_ar?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          recommended?: boolean | null
          setup_fee?: number | null
          trial_days?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          annual_price?: number | null
          base_price?: number
          billing_cycle?: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          currency?: string | null
          description?: string | null
          description_ar?: string | null
          display_order?: number | null
          features?: Json
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_public?: boolean | null
          limits?: Json
          overage_pricing?: Json | null
          plan_code?: string
          plan_color?: string | null
          plan_icon?: string | null
          plan_name?: string
          plan_name_ar?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          recommended?: boolean | null
          setup_fee?: number | null
          trial_days?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_quality_check_status_cd: {
        Row: {
          allows_proceed: boolean | null
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          display_order: number | null
          icon: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_system: boolean | null
          metadata: Json | null
          name: string
          name2: string | null
          rec_status: number | null
          requires_action: boolean | null
          status_type: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          allows_proceed?: boolean | null
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          name: string
          name2?: string | null
          rec_status?: number | null
          requires_action?: boolean | null
          status_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          allows_proceed?: boolean | null
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          name?: string
          name2?: string | null
          rec_status?: number | null
          requires_action?: boolean | null
          status_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_report_category_cd: {
        Row: {
          allowed_user_roles: string[] | null
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          display_order: number | null
          icon: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_system: boolean | null
          metadata: Json | null
          name: string
          name2: string | null
          parent_category_code: string | null
          rec_status: number | null
          report_type: string | null
          requires_admin_access: boolean | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          allowed_user_roles?: string[] | null
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          name: string
          name2?: string | null
          parent_category_code?: string | null
          rec_status?: number | null
          report_type?: string | null
          requires_admin_access?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          allowed_user_roles?: string[] | null
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          name?: string
          name2?: string | null
          parent_category_code?: string | null
          rec_status?: number | null
          report_type?: string | null
          requires_admin_access?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_service_category_cd: {
        Row: {
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          ctg_desc: string | null
          ctg_name: string
          ctg_name2: string | null
          description: string | null
          description2: string | null
          display_order: number | null
          has_fee: boolean
          icon: string | null
          is_active: boolean
          is_builtin: boolean
          is_mandatory: boolean
          is_system: boolean | null
          metadata: Json | null
          multiplier_express: number | null
          name: string
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          service_category_code: string
          service_category_color1: string | null
          service_category_color2: string | null
          service_category_color3: string | null
          service_category_icon: string | null
          service_category_image: string | null
          turnaround_hh: number | null
          turnaround_hh_express: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          ctg_desc?: string | null
          ctg_name: string
          ctg_name2?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          has_fee?: boolean
          icon?: string | null
          is_active?: boolean
          is_builtin?: boolean
          is_mandatory?: boolean
          is_system?: boolean | null
          metadata?: Json | null
          multiplier_express?: number | null
          name: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          service_category_code: string
          service_category_color1?: string | null
          service_category_color2?: string | null
          service_category_color3?: string | null
          service_category_icon?: string | null
          service_category_image?: string | null
          turnaround_hh?: number | null
          turnaround_hh_express?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          ctg_desc?: string | null
          ctg_name?: string
          ctg_name2?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          has_fee?: boolean
          icon?: string | null
          is_active?: boolean
          is_builtin?: boolean
          is_mandatory?: boolean
          is_system?: boolean | null
          metadata?: Json | null
          multiplier_express?: number | null
          name?: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          service_category_code?: string
          service_category_color1?: string | null
          service_category_color2?: string | null
          service_category_color3?: string | null
          service_category_icon?: string | null
          service_category_image?: string | null
          turnaround_hh?: number | null
          turnaround_hh_express?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_service_prod_templates_cd: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          default_express_sell_price: number | null
          default_sell_price: number | null
          default_workflow_steps: string[] | null
          description: string | null
          description2: string | null
          extra_days: number | null
          hint_text: string | null
          hint_text2: string | null
          id_sku: string | null
          is_active: boolean
          is_express_available: boolean | null
          is_retail_item: boolean | null
          is_subscription_available: boolean | null
          is_to_seed: boolean | null
          item_code: string
          item_type_code: string | null
          metadata: Json | null
          min_quantity: number | null
          min_sell_price: number | null
          multiplier_express: number | null
          name: string
          name2: string | null
          pieces_per_product: number | null
          price_type: string | null
          product_color1: string | null
          product_color2: string | null
          product_color3: string | null
          product_cost: number | null
          product_group1: string | null
          product_group2: string | null
          product_group3: string | null
          product_icon: string | null
          product_image: string | null
          product_unit: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          requires_dimensions: boolean | null
          requires_item_count: boolean | null
          requires_weight: boolean | null
          seed_options: Json | null
          seed_priority: number | null
          service_category_code: string
          tags: Json | null
          template_code: string
          template_id: string
          turnaround_hh: number | null
          turnaround_hh_express: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          default_express_sell_price?: number | null
          default_sell_price?: number | null
          default_workflow_steps?: string[] | null
          description?: string | null
          description2?: string | null
          extra_days?: number | null
          hint_text?: string | null
          hint_text2?: string | null
          id_sku?: string | null
          is_active?: boolean
          is_express_available?: boolean | null
          is_retail_item?: boolean | null
          is_subscription_available?: boolean | null
          is_to_seed?: boolean | null
          item_code: string
          item_type_code?: string | null
          metadata?: Json | null
          min_quantity?: number | null
          min_sell_price?: number | null
          multiplier_express?: number | null
          name: string
          name2?: string | null
          pieces_per_product?: number | null
          price_type?: string | null
          product_color1?: string | null
          product_color2?: string | null
          product_color3?: string | null
          product_cost?: number | null
          product_group1?: string | null
          product_group2?: string | null
          product_group3?: string | null
          product_icon?: string | null
          product_image?: string | null
          product_unit?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_dimensions?: boolean | null
          requires_item_count?: boolean | null
          requires_weight?: boolean | null
          seed_options?: Json | null
          seed_priority?: number | null
          service_category_code: string
          tags?: Json | null
          template_code: string
          template_id?: string
          turnaround_hh?: number | null
          turnaround_hh_express?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          default_express_sell_price?: number | null
          default_sell_price?: number | null
          default_workflow_steps?: string[] | null
          description?: string | null
          description2?: string | null
          extra_days?: number | null
          hint_text?: string | null
          hint_text2?: string | null
          id_sku?: string | null
          is_active?: boolean
          is_express_available?: boolean | null
          is_retail_item?: boolean | null
          is_subscription_available?: boolean | null
          is_to_seed?: boolean | null
          item_code?: string
          item_type_code?: string | null
          metadata?: Json | null
          min_quantity?: number | null
          min_sell_price?: number | null
          multiplier_express?: number | null
          name?: string
          name2?: string | null
          pieces_per_product?: number | null
          price_type?: string | null
          product_color1?: string | null
          product_color2?: string | null
          product_color3?: string | null
          product_cost?: number | null
          product_group1?: string | null
          product_group2?: string | null
          product_group3?: string | null
          product_icon?: string | null
          product_image?: string | null
          product_unit?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_dimensions?: boolean | null
          requires_item_count?: boolean | null
          requires_weight?: boolean | null
          seed_options?: Json | null
          seed_priority?: number | null
          service_category_code?: string
          tags?: Json | null
          template_code?: string
          template_id?: string
          turnaround_hh?: number | null
          turnaround_hh_express?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_template_category"
            columns: ["service_category_code"]
            isOneToOne: false
            referencedRelation: "sys_service_category_cd"
            referencedColumns: ["service_category_code"]
          },
          {
            foreignKeyName: "fk_template_item"
            columns: ["item_code"]
            isOneToOne: false
            referencedRelation: "sys_items_data_list_cd"
            referencedColumns: ["item_code"]
          },
          {
            foreignKeyName: "fk_template_item_type"
            columns: ["item_type_code"]
            isOneToOne: false
            referencedRelation: "sys_item_type_cd"
            referencedColumns: ["item_type_code"]
          },
        ]
      }
      sys_tenant_lifecycle: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          churn_prediction_score: number | null
          created_at: string | null
          data_retention_until: string | null
          health_score: number | null
          id: string
          last_activity_at: string | null
          last_health_calculated_at: string | null
          last_login_at: string | null
          last_order_at: string | null
          lifecycle_stage: string
          onboarding_checklist: Json | null
          onboarding_completed_at: string | null
          onboarding_started_at: string | null
          onboarding_status: string | null
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          tenant_org_id: string
          updated_at: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          churn_prediction_score?: number | null
          created_at?: string | null
          data_retention_until?: string | null
          health_score?: number | null
          id?: string
          last_activity_at?: string | null
          last_health_calculated_at?: string | null
          last_login_at?: string | null
          last_order_at?: string | null
          lifecycle_stage?: string
          onboarding_checklist?: Json | null
          onboarding_completed_at?: string | null
          onboarding_started_at?: string | null
          onboarding_status?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          tenant_org_id: string
          updated_at?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          churn_prediction_score?: number | null
          created_at?: string | null
          data_retention_until?: string | null
          health_score?: number | null
          id?: string
          last_activity_at?: string | null
          last_health_calculated_at?: string | null
          last_login_at?: string | null
          last_order_at?: string | null
          lifecycle_stage?: string
          onboarding_checklist?: Json | null
          onboarding_completed_at?: string | null
          onboarding_started_at?: string | null
          onboarding_status?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          tenant_org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_tenant_lifecycle_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: true
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_tenant_metrics_daily: {
        Row: {
          active_customers: number | null
          active_users: number | null
          api_calls: number | null
          avg_order_value: number | null
          created_at: string | null
          id: string
          metric_date: string
          new_customers: number | null
          orders_cancelled: number | null
          orders_completed: number | null
          orders_created: number | null
          revenue: number | null
          storage_mb_used: number | null
          tenant_org_id: string
          total_logins: number | null
        }
        Insert: {
          active_customers?: number | null
          active_users?: number | null
          api_calls?: number | null
          avg_order_value?: number | null
          created_at?: string | null
          id?: string
          metric_date: string
          new_customers?: number | null
          orders_cancelled?: number | null
          orders_completed?: number | null
          orders_created?: number | null
          revenue?: number | null
          storage_mb_used?: number | null
          tenant_org_id: string
          total_logins?: number | null
        }
        Update: {
          active_customers?: number | null
          active_users?: number | null
          api_calls?: number | null
          avg_order_value?: number | null
          created_at?: string | null
          id?: string
          metric_date?: string
          new_customers?: number | null
          orders_cancelled?: number | null
          orders_completed?: number | null
          orders_created?: number | null
          revenue?: number | null
          storage_mb_used?: number | null
          tenant_org_id?: string
          total_logins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_tenant_metrics_daily_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_tenant_settings_cd: {
        Row: {
          created_at: string
          created_by: string | null
          created_info: string | null
          is_active: boolean
          is_for_tenants_org: boolean
          is_per_branch_id: boolean
          is_per_tenant_org_id: boolean
          is_per_user_id: boolean
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          setting_code: string
          setting_desc: string | null
          setting_name: string | null
          setting_name2: string | null
          setting_value: string | null
          setting_value_type: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean
          is_for_tenants_org?: boolean
          is_per_branch_id?: boolean
          is_per_tenant_org_id?: boolean
          is_per_user_id?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          setting_code: string
          setting_desc?: string | null
          setting_name?: string | null
          setting_name2?: string | null
          setting_value?: string | null
          setting_value_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean
          is_for_tenants_org?: boolean
          is_per_branch_id?: boolean
          is_per_tenant_org_id?: boolean
          is_per_user_id?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          setting_code?: string
          setting_desc?: string | null
          setting_name?: string | null
          setting_name2?: string | null
          setting_value?: string | null
          setting_value_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_timezone_cd: {
        Row: {
          code: string
          color: string | null
          country_code: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          display_order: number | null
          dst_end_rule: string | null
          dst_start_rule: string | null
          icon: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_system: boolean | null
          metadata: Json | null
          name: string
          name2: string | null
          rec_status: number | null
          region: string | null
          updated_at: string | null
          updated_by: string | null
          uses_dst: boolean | null
          utc_offset_hours: number
          utc_offset_minutes: number | null
          utc_offset_string: string | null
        }
        Insert: {
          code: string
          color?: string | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          dst_end_rule?: string | null
          dst_start_rule?: string | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          name: string
          name2?: string | null
          rec_status?: number | null
          region?: string | null
          updated_at?: string | null
          updated_by?: string | null
          uses_dst?: boolean | null
          utc_offset_hours: number
          utc_offset_minutes?: number | null
          utc_offset_string?: string | null
        }
        Update: {
          code?: string
          color?: string | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          dst_end_rule?: string | null
          dst_start_rule?: string | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          name?: string
          name2?: string | null
          rec_status?: number | null
          region?: string | null
          updated_at?: string | null
          updated_by?: string | null
          uses_dst?: boolean | null
          utc_offset_hours?: number
          utc_offset_minutes?: number | null
          utc_offset_string?: string | null
        }
        Relationships: []
      }
      sys_user_role_cd: {
        Row: {
          access_level: string | null
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          display_order: number | null
          icon: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_platform_role: boolean | null
          is_system: boolean | null
          is_tenant_role: boolean | null
          metadata: Json | null
          name: string
          name2: string | null
          rbac_role_code: string | null
          rec_status: number | null
          role_level: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          access_level?: string | null
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_platform_role?: boolean | null
          is_system?: boolean | null
          is_tenant_role?: boolean | null
          metadata?: Json | null
          name: string
          name2?: string | null
          rbac_role_code?: string | null
          rec_status?: number | null
          role_level?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          access_level?: string | null
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_platform_role?: boolean | null
          is_system?: boolean | null
          is_tenant_role?: boolean | null
          metadata?: Json | null
          name?: string
          name2?: string | null
          rbac_role_code?: string | null
          rec_status?: number | null
          role_level?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_workflow_step_cd: {
        Row: {
          allowed_next_steps: string[] | null
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          display_order: number | null
          estimated_duration_hours: number | null
          icon: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_required: boolean | null
          is_system: boolean | null
          metadata: Json | null
          name: string
          name2: string | null
          rec_status: number | null
          requires_photo: boolean | null
          requires_scan: boolean | null
          requires_signature: boolean | null
          step_category: string | null
          step_type: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          allowed_next_steps?: string[] | null
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          estimated_duration_hours?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_required?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          name: string
          name2?: string | null
          rec_status?: number | null
          requires_photo?: boolean | null
          requires_scan?: boolean | null
          requires_signature?: boolean | null
          step_category?: string | null
          step_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          allowed_next_steps?: string[] | null
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          estimated_duration_hours?: number | null
          icon?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_required?: boolean | null
          is_system?: boolean | null
          metadata?: Json | null
          name?: string
          name2?: string | null
          rec_status?: number | null
          requires_photo?: boolean | null
          requires_scan?: boolean | null
          requires_signature?: boolean | null
          step_category?: string | null
          step_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_workflow_template_cd: {
        Row: {
          created_at: string | null
          is_active: boolean
          rec_order: number | null
          rec_status: number | null
          template_code: string
          template_desc: string | null
          template_id: string
          template_name: string
          template_name2: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          is_active?: boolean
          rec_order?: number | null
          rec_status?: number | null
          template_code: string
          template_desc?: string | null
          template_id?: string
          template_name: string
          template_name2?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          is_active?: boolean
          rec_order?: number | null
          rec_status?: number | null
          template_code?: string
          template_desc?: string | null
          template_id?: string
          template_name?: string
          template_name2?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sys_workflow_template_stages: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          is_terminal: boolean | null
          seq_no: number
          stage_code: string
          stage_name: string
          stage_name2: string | null
          stage_type: string
          template_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_terminal?: boolean | null
          seq_no: number
          stage_code: string
          stage_name: string
          stage_name2?: string | null
          stage_type: string
          template_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_terminal?: boolean | null
          seq_no?: number
          stage_code?: string
          stage_name?: string
          stage_name2?: string | null
          stage_type?: string
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_workflow_template_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sys_workflow_template_cd"
            referencedColumns: ["template_id"]
          },
        ]
      }
      sys_workflow_template_transitions: {
        Row: {
          allow_manual: boolean | null
          auto_when_done: boolean | null
          created_at: string | null
          from_stage_code: string
          id: string
          is_active: boolean | null
          requires_invoice: boolean | null
          requires_pod: boolean | null
          requires_scan_ok: boolean | null
          template_id: string
          to_stage_code: string
          updated_at: string | null
        }
        Insert: {
          allow_manual?: boolean | null
          auto_when_done?: boolean | null
          created_at?: string | null
          from_stage_code: string
          id?: string
          is_active?: boolean | null
          requires_invoice?: boolean | null
          requires_pod?: boolean | null
          requires_scan_ok?: boolean | null
          template_id: string
          to_stage_code: string
          updated_at?: string | null
        }
        Update: {
          allow_manual?: boolean | null
          auto_when_done?: boolean | null
          created_at?: string | null
          from_stage_code?: string
          id?: string
          is_active?: boolean | null
          requires_invoice?: boolean | null
          requires_pod?: boolean | null
          requires_scan_ok?: boolean | null
          template_id?: string
          to_stage_code?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_workflow_template_transitions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sys_workflow_template_cd"
            referencedColumns: ["template_id"]
          },
        ]
      }
    }
    Views: {
      admin_locked_accounts: {
        Row: {
          display_name: string | null
          email: string | null
          failed_login_attempts: number | null
          last_failed_login_at: string | null
          lock_reason: string | null
          locked_until: string | null
          minutes_remaining: number | null
          tenant_org_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_users_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_order_status_history_legacy: {
        Row: {
          done_at: string | null
          done_by: string | null
          from_value: string | null
          id: string | null
          notes: string | null
          order_id: string | null
          payload: Json | null
          tenant_org_id: string | null
          to_value: string | null
        }
        Insert: {
          done_at?: string | null
          done_by?: string | null
          from_value?: string | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          payload?: Json | null
          tenant_org_id?: string | null
          to_value?: string | null
        }
        Update: {
          done_at?: string | null
          done_by?: string | null
          from_value?: string | null
          id?: string | null
          notes?: string | null
          order_id?: string | null
          payload?: Json | null
          tenant_org_id?: string | null
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_status_history_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_status_history_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_status_history_user"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "admin_locked_accounts"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v_effective_tenant_settings: {
        Row: {
          branch_id: string | null
          is_active: boolean | null
          setting_code: string | null
          setting_desc: string | null
          setting_name: string | null
          setting_name2: string | null
          setting_value: string | null
          setting_value_type: string | null
          source: string | null
          tenant_org_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_unlock_expired_accounts: {
        Args: Record<PropertyKey, never>
        Returns: {
          unlocked_count: number
        }[]
      }
      check_code_table_references: {
        Args: { p_record_code: string; p_table_name: string }
        Returns: {
          reference_count: number
          referencing_column: string
          referencing_table: string
        }[]
      }
      check_rbac_migration_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          has_rbac_role: boolean
          old_role: string
          rbac_roles: string[]
          tenant_org_id: string
          user_id: string
        }[]
      }
      cleanup_expired_otp_codes: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cmx_can: {
        Args: {
          p_perm: string
          p_resource_id?: string
          p_resource_type?: string
        }
        Returns: boolean
      }
      cmx_get_allowed_transitions: {
        Args: { p_from?: string; p_order: string; p_tenant: string }
        Returns: Json
      }
      cmx_order_items_transition: {
        Args: {
          p_from: string
          p_order: string
          p_payload?: Json
          p_tenant: string
          p_to: string
          p_user?: string
        }
        Returns: string
      }
      cmx_order_transition: {
        Args: {
          p_from: string
          p_order: string
          p_payload?: Json
          p_tenant: string
          p_to: string
          p_user?: string
        }
        Returns: Json
      }
      cmx_rebuild_user_permissions: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: undefined
      }
      cmx_validate_transition: {
        Args: {
          p_from: string
          p_order: string
          p_tenant: string
          p_to: string
        }
        Returns: Json
      }
      create_and_link_auth_user: {
        Args: {
          p_display_name: string
          p_email: string
          p_password: string
          p_role?: string
          p_tenant_id: string
        }
        Returns: string
      }
      current_tenant_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      current_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      extract_order_sequence: {
        Args: { p_order_no: string }
        Returns: number
      }
      fn_get_setting_value: {
        Args: { p_setting_code: string; p_tenant_org_id: string }
        Returns: Json
      }
      fn_is_setting_allowed: {
        Args: { p_setting_code: string; p_tenant_org_id: string }
        Returns: boolean
      }
      fn_next_order_item_srno: {
        Args: { p_order: string; p_tenant: string }
        Returns: string
      }
      fn_recalc_order_totals: {
        Args: { p_order: string; p_tenant: string }
        Returns: undefined
      }
      generate_customer_number: {
        Args: { p_tenant_org_id: string }
        Returns: string
      }
      generate_order_number: {
        Args: { p_tenant_org_id: string }
        Returns: string
      }
      get_code_table_history: {
        Args: { p_limit?: number; p_record_code: string; p_table_name: string }
        Returns: {
          action: string
          change_reason: string
          changed_at: string
          changed_by: string
          changed_fields: string[]
          id: string
          is_rollback: boolean
          new_values: Json
          old_values: Json
        }[]
      }
      get_navigation_with_parents: {
        Args: {
          p_feature_flags?: Json
          p_user_permissions: string[]
          p_user_role?: string
        }
        Returns: {
          badge: string
          comp_code: string
          comp_icon: string
          comp_id: string
          comp_level: number
          comp_path: string
          display_order: number
          feature_flag: Json
          is_leaf: boolean
          label: string
          label2: string
          main_permission_code: string
          parent_comp_code: string
          parent_comp_id: string
          permissions: Json
          require_all_permissions: boolean
          roles: Json
        }[]
      }
      get_navigation_with_parents_jh: {
        Args: {
          p_feature_flags?: Json
          p_user_permissions: string[]
          p_user_role?: string
        }
        Returns: {
          badge: string
          comp_code: string
          comp_icon: string
          comp_id: string
          comp_level: number
          comp_path: string
          display_order: number
          feature_flag: Json
          is_leaf: boolean
          label: string
          label2: string
          main_permission_code: string
          parent_comp_code: string
          parent_comp_id: string
          permissions: Json
          require_all_permissions: boolean
          roles: Json
        }[]
      }
      get_order_number_prefix: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_order_timeline: {
        Args: { p_order_id: string }
        Returns: {
          action_type: string
          done_at: string
          done_by: string
          from_value: string
          id: string
          payload: Json
          to_value: string
        }[]
      }
      get_product_price: {
        Args: {
          p_effective_date?: string
          p_price_list_type?: string
          p_product_id: string
          p_quantity?: number
          p_tenant_org_id: string
        }
        Returns: number
      }
      get_user_permissions: {
        Args: Record<PropertyKey, never>
        Returns: {
          permission_code: string
          resource_id: string
          resource_type: string
        }[]
      }
      get_user_permissions_jh: {
        Args: { p_cur_tenant_org_id?: string; p_cur_user_id?: string }
        Returns: {
          permission_code: string
          resource_id: string
          resource_type: string
        }[]
      }
      get_user_role_compat: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: string
      }
      get_user_roles: {
        Args: Record<PropertyKey, never>
        Returns: {
          role_code: string
          role_id: string
          role_name: string
        }[]
      }
      get_user_tenants: {
        Args: Record<PropertyKey, never>
        Returns: {
          is_active: boolean
          last_login_at: string
          tenant_id: string
          tenant_name: string
          tenant_slug: string
          user_role: string
        }[]
      }
      get_user_tenants_jh: {
        Args: { p_cur_user_id?: string }
        Returns: {
          is_active: boolean
          last_login_at: string
          org_user_id: string
          tenant_id: string
          tenant_name: string
          tenant_slug: string
          user_id: string
          user_role: string
        }[]
      }
      get_user_tenants_u: {
        Args: { p_cur_user_id?: string }
        Returns: {
          is_active: boolean
          last_login_at: string
          org_user_id: string
          tenant_id: string
          tenant_name: string
          tenant_slug: string
          user_id: string
          user_role: string
        }[]
      }
      get_user_workflow_roles: {
        Args: Record<PropertyKey, never>
        Returns: {
          workflow_role: string
        }[]
      }
      has_all_permissions: {
        Args: { p_permissions: string[] }
        Returns: boolean
      }
      has_any_permission: {
        Args: { p_permissions: string[] }
        Returns: boolean
      }
      has_permission: {
        Args: { p_permission: string }
        Returns: boolean
      }
      has_resource_permission: {
        Args: {
          p_permission: string
          p_resource_id: string
          p_resource_type: string
        }
        Returns: boolean
      }
      has_tenant_access: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      has_unresolved_issues: {
        Args: { p_order_item_id: string }
        Returns: boolean
      }
      has_workflow_role: {
        Args: { p_workflow_role: string }
        Returns: boolean
      }
      hq_user_has_permission: {
        Args: { p_permission: string; p_user_id: string }
        Returns: boolean
      }
      initialize_new_tenant: {
        Args: {
          p_admin_display_name?: string
          p_admin_email?: string
          p_admin_password?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      initialize_tenant_product_catalog: {
        Args: {
          p_create_default_price_list?: boolean
          p_include_cost?: boolean
          p_include_pricing?: boolean
          p_seed_filter?: string
          p_tenant_org_id: string
        }
        Returns: Json
      }
      is_account_locked: {
        Args: { p_email: string }
        Returns: {
          is_locked: boolean
          lock_reason: string
          locked_until: string
          user_id: string
        }[]
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_item_all_steps_done: {
        Args: { p_order_item_id: string }
        Returns: boolean
      }
      is_operator: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type?: string
          p_error_message?: string
          p_ip_address?: unknown
          p_new_values?: Json
          p_old_values?: Json
          p_request_id?: string
          p_status?: string
          p_tenant_org_id: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      log_code_table_change: {
        Args: {
          p_action: string
          p_change_reason?: string
          p_changed_by: string
          p_ip_address?: string
          p_new_values: Json
          p_old_values: Json
          p_record_code: string
          p_table_name: string
          p_user_agent?: string
        }
        Returns: string
      }
      log_order_action: {
        Args: {
          p_action_type: string
          p_done_by?: string
          p_from_value?: string
          p_order_id: string
          p_payload?: Json
          p_tenant_org_id: string
          p_to_value?: string
        }
        Returns: string
      }
      migrate_users_to_rbac: {
        Args: Record<PropertyKey, never>
        Returns: {
          migrated: boolean
          new_role_code: string
          old_role: string
          tenant_org_id: string
          user_id: string
        }[]
      }
      migrate_users_to_rbac_batch: {
        Args: { p_batch_size?: number }
        Returns: {
          batch_number: number
          total_remaining: number
          users_migrated: number
        }[]
      }
      order_has_action: {
        Args: { p_action_type: string; p_order_id: string }
        Returns: boolean
      }
      record_login_attempt: {
        Args: {
          p_email: string
          p_error_message?: string
          p_ip_address?: unknown
          p_success: boolean
          p_user_agent?: string
        }
        Returns: {
          is_locked: boolean
          lock_reason: string
          locked_until: string
          log_id: string
        }[]
      }
      reseed_missing_products: {
        Args: {
          p_include_pricing?: boolean
          p_item_codes?: string[]
          p_only_missing?: boolean
          p_tenant_org_id: string
        }
        Returns: Json
      }
      switch_tenant_context: {
        Args: { p_tenant_id: string }
        Returns: {
          message: string
          success: boolean
          tenant_id: string
          tenant_name: string
          tenant_slug: string
          user_role: string
        }[]
      }
      sys_bill_generate_invoice_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      sys_bill_get_default_payment_method: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      unlock_account: {
        Args: { p_admin_user_id: string; p_reason?: string; p_user_id: string }
        Returns: boolean
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

