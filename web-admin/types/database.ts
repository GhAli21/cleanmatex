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
            foreignKeyName: "cmx_effective_permissions_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "cmx_effective_permissions_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
          ip_address: unknown
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
          ip_address?: unknown
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
          ip_address?: unknown
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
      hq_crm_marketing_lead_daily_seq: {
        Row: {
          day_utc: string
          last_n: number
        }
        Insert: {
          day_utc: string
          last_n: number
        }
        Update: {
          day_utc?: string
          last_n?: number
        }
        Relationships: []
      }
      hq_crm_marketing_lead_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_label: string | null
          event_payload_jsonb: Json | null
          event_type: string
          id: string
          lead_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_label?: string | null
          event_payload_jsonb?: Json | null
          event_type: string
          id?: string
          lead_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_label?: string | null
          event_payload_jsonb?: Json | null
          event_type?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_crm_marketing_lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "hq_crm_marketing_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_crm_marketing_lead_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_internal: boolean
          lead_id: string
          note_text: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_internal?: boolean
          lead_id: string
          note_text: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_internal?: boolean
          lead_id?: string
          note_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_crm_marketing_lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "hq_crm_marketing_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_crm_marketing_lead_tags: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          tag: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          tag: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_crm_marketing_lead_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "hq_crm_marketing_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_crm_marketing_leads: {
        Row: {
          acquisition_source: string | null
          acquisition_source_detail: string | null
          assigned_to: string | null
          branch_count: number | null
          business_name: string
          business_type: string | null
          closed_at: string | null
          company_size: string | null
          country_code: string | null
          country_name: string | null
          created_at: string
          created_by: string | null
          current_tools: string | null
          direction: string | null
          duplicate_of_id: string | null
          email: string
          fbclid: string | null
          first_contacted_at: string | null
          full_name: string
          gclid: string | null
          id: string
          interested_plan_code: string | null
          interested_plan_price: string | null
          is_duplicate: boolean
          landing_page: string | null
          lead_code: string
          locale: string | null
          message: string | null
          normalized_email: string
          normalized_phone: string | null
          notes_internal: string | null
          number_of_employees: string | null
          pain_points_jsonb: Json | null
          phone: string
          planned_install_date: string | null
          preferred_language: string | null
          priority: string
          qualified_at: string | null
          referrer: string | null
          request_type: string
          services_needed_jsonb: Json | null
          session_id: string | null
          source_page: string | null
          status: string
          submission_context_jsonb: Json | null
          submitted_at: string
          updated_at: string
          updated_by: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          acquisition_source?: string | null
          acquisition_source_detail?: string | null
          assigned_to?: string | null
          branch_count?: number | null
          business_name: string
          business_type?: string | null
          closed_at?: string | null
          company_size?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          created_by?: string | null
          current_tools?: string | null
          direction?: string | null
          duplicate_of_id?: string | null
          email: string
          fbclid?: string | null
          first_contacted_at?: string | null
          full_name: string
          gclid?: string | null
          id?: string
          interested_plan_code?: string | null
          interested_plan_price?: string | null
          is_duplicate?: boolean
          landing_page?: string | null
          lead_code: string
          locale?: string | null
          message?: string | null
          normalized_email: string
          normalized_phone?: string | null
          notes_internal?: string | null
          number_of_employees?: string | null
          pain_points_jsonb?: Json | null
          phone: string
          planned_install_date?: string | null
          preferred_language?: string | null
          priority?: string
          qualified_at?: string | null
          referrer?: string | null
          request_type: string
          services_needed_jsonb?: Json | null
          session_id?: string | null
          source_page?: string | null
          status?: string
          submission_context_jsonb?: Json | null
          submitted_at?: string
          updated_at?: string
          updated_by?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          acquisition_source?: string | null
          acquisition_source_detail?: string | null
          assigned_to?: string | null
          branch_count?: number | null
          business_name?: string
          business_type?: string | null
          closed_at?: string | null
          company_size?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          created_by?: string | null
          current_tools?: string | null
          direction?: string | null
          duplicate_of_id?: string | null
          email?: string
          fbclid?: string | null
          first_contacted_at?: string | null
          full_name?: string
          gclid?: string | null
          id?: string
          interested_plan_code?: string | null
          interested_plan_price?: string | null
          is_duplicate?: boolean
          landing_page?: string | null
          lead_code?: string
          locale?: string | null
          message?: string | null
          normalized_email?: string
          normalized_phone?: string | null
          notes_internal?: string | null
          number_of_employees?: string | null
          pain_points_jsonb?: Json | null
          phone?: string
          planned_install_date?: string | null
          preferred_language?: string | null
          priority?: string
          qualified_at?: string | null
          referrer?: string | null
          request_type?: string
          services_needed_jsonb?: Json | null
          session_id?: string | null
          source_page?: string | null
          status?: string
          submission_context_jsonb?: Json | null
          submitted_at?: string
          updated_at?: string
          updated_by?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_crm_marketing_leads_duplicate_of_id_fkey"
            columns: ["duplicate_of_id"]
            isOneToOne: false
            referencedRelation: "hq_crm_marketing_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_crm_marketing_leads_interested_plan_code_fkey"
            columns: ["interested_plan_code"]
            isOneToOne: false
            referencedRelation: "sys_pln_subscription_plans_mst"
            referencedColumns: ["plan_code"]
          },
          {
            foreignKeyName: "hq_crm_marketing_leads_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "hq_crm_marketing_visitor_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      hq_crm_marketing_page: {
        Row: {
          content_jsonb: Json
          created_at: string
          id: string
          is_published: boolean
          locale: string
          page_key: string
          updated_at: string
        }
        Insert: {
          content_jsonb?: Json
          created_at?: string
          id?: string
          is_published?: boolean
          locale: string
          page_key: string
          updated_at?: string
        }
        Update: {
          content_jsonb?: Json
          created_at?: string
          id?: string
          is_published?: boolean
          locale?: string
          page_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      hq_crm_marketing_page_revision: {
        Row: {
          content_jsonb: Json
          created_at: string
          created_by: string | null
          id: string
          locale: string
          page_key: string
          published_at: string | null
          published_by: string | null
          revision_number: number
          revision_status: string
          updated_at: string
        }
        Insert: {
          content_jsonb?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          locale: string
          page_key: string
          published_at?: string | null
          published_by?: string | null
          revision_number: number
          revision_status?: string
          updated_at?: string
        }
        Update: {
          content_jsonb?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          locale?: string
          page_key?: string
          published_at?: string | null
          published_by?: string | null
          revision_number?: number
          revision_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      hq_crm_marketing_plan_overlay: {
        Row: {
          created_at: string
          cta_label: string | null
          footnote: string | null
          highlights_jsonb: Json
          id: string
          is_published: boolean
          locale: string
          plan_code: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          footnote?: string | null
          highlights_jsonb?: Json
          id?: string
          is_published?: boolean
          locale: string
          plan_code: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          footnote?: string | null
          highlights_jsonb?: Json
          id?: string
          is_published?: boolean
          locale?: string
          plan_code?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_crm_marketing_plan_overlay_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "sys_pln_subscription_plans_mst"
            referencedColumns: ["plan_code"]
          },
        ]
      }
      hq_crm_marketing_plan_overlay_revision: {
        Row: {
          created_at: string
          created_by: string | null
          cta_label: string | null
          footnote: string | null
          highlights_jsonb: Json
          id: string
          locale: string
          plan_code: string
          published_at: string | null
          published_by: string | null
          revision_number: number
          revision_status: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          footnote?: string | null
          highlights_jsonb?: Json
          id?: string
          locale: string
          plan_code: string
          published_at?: string | null
          published_by?: string | null
          revision_number: number
          revision_status?: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          footnote?: string | null
          highlights_jsonb?: Json
          id?: string
          locale?: string
          plan_code?: string
          published_at?: string | null
          published_by?: string | null
          revision_number?: number
          revision_status?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hq_crm_marketing_plan_overlay_revision_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "sys_pln_subscription_plans_mst"
            referencedColumns: ["plan_code"]
          },
        ]
      }
      hq_crm_marketing_tracking_config: {
        Row: {
          debounce_ms: number
          description: string | null
          events_jsonb_max_items: number
          inject_ga4: boolean
          inject_posthog: boolean
          is_active: boolean
          is_global_enabled: boolean
          level: number
          level_name: string
          notes: string | null
          requires_consent: boolean
          sampling_rate: number
          track_battery_level: boolean
          track_browser_name: boolean
          track_browser_version: boolean
          track_consent_timestamp: boolean
          track_cookie_enabled: boolean
          track_device_model: boolean
          track_device_pixel_ratio: boolean
          track_device_type: boolean
          track_events_jsonb: boolean
          track_fbclid: boolean
          track_forwarded_for: boolean
          track_gclid: boolean
          track_geo_city: boolean
          track_geo_country: boolean
          track_geo_lat_lon: boolean
          track_ip_address: boolean
          track_landing_page: boolean
          track_locale: boolean
          track_max_scroll_pct: boolean
          track_max_touch_points: boolean
          track_network_downlink: boolean
          track_network_rtt: boolean
          track_network_type: boolean
          track_os_name: boolean
          track_os_version: boolean
          track_page_views: boolean
          track_preferred_languages: boolean
          track_referrer: boolean
          track_screen_resolution: boolean
          track_timezone: boolean
          track_total_dwell_ms: boolean
          track_user_agent: boolean
          track_utm_campaign: boolean
          track_utm_content: boolean
          track_utm_medium: boolean
          track_utm_source: boolean
          track_utm_term: boolean
          track_viewport: boolean
          track_visitor_id: boolean
          updated_at: string
          updated_by: string | null
          use_bot_detection: boolean
        }
        Insert: {
          debounce_ms?: number
          description?: string | null
          events_jsonb_max_items?: number
          inject_ga4?: boolean
          inject_posthog?: boolean
          is_active?: boolean
          is_global_enabled?: boolean
          level: number
          level_name: string
          notes?: string | null
          requires_consent?: boolean
          sampling_rate?: number
          track_battery_level?: boolean
          track_browser_name?: boolean
          track_browser_version?: boolean
          track_consent_timestamp?: boolean
          track_cookie_enabled?: boolean
          track_device_model?: boolean
          track_device_pixel_ratio?: boolean
          track_device_type?: boolean
          track_events_jsonb?: boolean
          track_fbclid?: boolean
          track_forwarded_for?: boolean
          track_gclid?: boolean
          track_geo_city?: boolean
          track_geo_country?: boolean
          track_geo_lat_lon?: boolean
          track_ip_address?: boolean
          track_landing_page?: boolean
          track_locale?: boolean
          track_max_scroll_pct?: boolean
          track_max_touch_points?: boolean
          track_network_downlink?: boolean
          track_network_rtt?: boolean
          track_network_type?: boolean
          track_os_name?: boolean
          track_os_version?: boolean
          track_page_views?: boolean
          track_preferred_languages?: boolean
          track_referrer?: boolean
          track_screen_resolution?: boolean
          track_timezone?: boolean
          track_total_dwell_ms?: boolean
          track_user_agent?: boolean
          track_utm_campaign?: boolean
          track_utm_content?: boolean
          track_utm_medium?: boolean
          track_utm_source?: boolean
          track_utm_term?: boolean
          track_viewport?: boolean
          track_visitor_id?: boolean
          updated_at?: string
          updated_by?: string | null
          use_bot_detection?: boolean
        }
        Update: {
          debounce_ms?: number
          description?: string | null
          events_jsonb_max_items?: number
          inject_ga4?: boolean
          inject_posthog?: boolean
          is_active?: boolean
          is_global_enabled?: boolean
          level?: number
          level_name?: string
          notes?: string | null
          requires_consent?: boolean
          sampling_rate?: number
          track_battery_level?: boolean
          track_browser_name?: boolean
          track_browser_version?: boolean
          track_consent_timestamp?: boolean
          track_cookie_enabled?: boolean
          track_device_model?: boolean
          track_device_pixel_ratio?: boolean
          track_device_type?: boolean
          track_events_jsonb?: boolean
          track_fbclid?: boolean
          track_forwarded_for?: boolean
          track_gclid?: boolean
          track_geo_city?: boolean
          track_geo_country?: boolean
          track_geo_lat_lon?: boolean
          track_ip_address?: boolean
          track_landing_page?: boolean
          track_locale?: boolean
          track_max_scroll_pct?: boolean
          track_max_touch_points?: boolean
          track_network_downlink?: boolean
          track_network_rtt?: boolean
          track_network_type?: boolean
          track_os_name?: boolean
          track_os_version?: boolean
          track_page_views?: boolean
          track_preferred_languages?: boolean
          track_referrer?: boolean
          track_screen_resolution?: boolean
          track_timezone?: boolean
          track_total_dwell_ms?: boolean
          track_user_agent?: boolean
          track_utm_campaign?: boolean
          track_utm_content?: boolean
          track_utm_medium?: boolean
          track_utm_source?: boolean
          track_utm_term?: boolean
          track_viewport?: boolean
          track_visitor_id?: boolean
          updated_at?: string
          updated_by?: string | null
          use_bot_detection?: boolean
        }
        Relationships: []
      }
      hq_crm_marketing_visitor_sessions: {
        Row: {
          battery_level: number | null
          browser_name: string | null
          browser_version: string | null
          consent_level: number | null
          consent_timestamp: string | null
          cookie_enabled: boolean | null
          created_at: string
          device_model: string | null
          device_pixel_ratio: number | null
          device_type: string | null
          events_jsonb: Json
          fbclid: string | null
          first_seen_at: string
          forwarded_for: string | null
          gclid: string | null
          geo_city: string | null
          geo_country: string | null
          geo_latitude: string | null
          geo_longitude: string | null
          id: string
          ip_address: string | null
          is_bot: boolean
          landing_page: string | null
          last_seen_at: string
          lead_id: string | null
          locale: string | null
          max_scroll_pct: number
          max_touch_points: number | null
          network_downlink: number | null
          network_effective_type: string | null
          network_rtt: number | null
          os_name: string | null
          os_version: string | null
          page_views: number
          preferred_languages: Json | null
          referrer: string | null
          screen_h: number | null
          screen_w: number | null
          session_id: string
          timezone: string | null
          total_dwell_ms: number
          tracking_level: number
          ua_mobile: boolean | null
          ua_platform: string | null
          ua_platform_version: string | null
          updated_at: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          viewport_h: number | null
          viewport_w: number | null
          visitor_id: string | null
        }
        Insert: {
          battery_level?: number | null
          browser_name?: string | null
          browser_version?: string | null
          consent_level?: number | null
          consent_timestamp?: string | null
          cookie_enabled?: boolean | null
          created_at?: string
          device_model?: string | null
          device_pixel_ratio?: number | null
          device_type?: string | null
          events_jsonb?: Json
          fbclid?: string | null
          first_seen_at?: string
          forwarded_for?: string | null
          gclid?: string | null
          geo_city?: string | null
          geo_country?: string | null
          geo_latitude?: string | null
          geo_longitude?: string | null
          id?: string
          ip_address?: string | null
          is_bot?: boolean
          landing_page?: string | null
          last_seen_at?: string
          lead_id?: string | null
          locale?: string | null
          max_scroll_pct?: number
          max_touch_points?: number | null
          network_downlink?: number | null
          network_effective_type?: string | null
          network_rtt?: number | null
          os_name?: string | null
          os_version?: string | null
          page_views?: number
          preferred_languages?: Json | null
          referrer?: string | null
          screen_h?: number | null
          screen_w?: number | null
          session_id: string
          timezone?: string | null
          total_dwell_ms?: number
          tracking_level?: number
          ua_mobile?: boolean | null
          ua_platform?: string | null
          ua_platform_version?: string | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          viewport_h?: number | null
          viewport_w?: number | null
          visitor_id?: string | null
        }
        Update: {
          battery_level?: number | null
          browser_name?: string | null
          browser_version?: string | null
          consent_level?: number | null
          consent_timestamp?: string | null
          cookie_enabled?: boolean | null
          created_at?: string
          device_model?: string | null
          device_pixel_ratio?: number | null
          device_type?: string | null
          events_jsonb?: Json
          fbclid?: string | null
          first_seen_at?: string
          forwarded_for?: string | null
          gclid?: string | null
          geo_city?: string | null
          geo_country?: string | null
          geo_latitude?: string | null
          geo_longitude?: string | null
          id?: string
          ip_address?: string | null
          is_bot?: boolean
          landing_page?: string | null
          last_seen_at?: string
          lead_id?: string | null
          locale?: string | null
          max_scroll_pct?: number
          max_touch_points?: number | null
          network_downlink?: number | null
          network_effective_type?: string | null
          network_rtt?: number | null
          os_name?: string | null
          os_version?: string | null
          page_views?: number
          preferred_languages?: Json | null
          referrer?: string | null
          screen_h?: number | null
          screen_w?: number | null
          session_id?: string
          timezone?: string | null
          total_dwell_ms?: number
          tracking_level?: number
          ua_mobile?: boolean | null
          ua_platform?: string | null
          ua_platform_version?: string | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          viewport_h?: number | null
          viewport_w?: number | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_crm_marketing_visitor_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "hq_crm_marketing_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      hq_ff_audit_history_tr: {
        Row: {
          action: string
          after_value: Json | null
          before_value: Json | null
          bulk_operation_id: string | null
          change_type: string | null
          changed_fields: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          flag_key: string
          id: string
          ip_address: unknown
          performed_by: string | null
          performed_by_email: string | null
          performed_info: string | null
          tenant_org_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          after_value?: Json | null
          before_value?: Json | null
          bulk_operation_id?: string | null
          change_type?: string | null
          changed_fields?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          flag_key: string
          id?: string
          ip_address?: unknown
          performed_by?: string | null
          performed_by_email?: string | null
          performed_info?: string | null
          tenant_org_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          after_value?: Json | null
          before_value?: Json | null
          bulk_operation_id?: string | null
          change_type?: string | null
          changed_fields?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          flag_key?: string
          id?: string
          ip_address?: unknown
          performed_by?: string | null
          performed_by_email?: string | null
          performed_info?: string | null
          tenant_org_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      hq_ff_feature_flags_mst: {
        Row: {
          allowed_values: Json | null
          allows_tenant_override: boolean | null
          comp_code: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          data_type: string
          default_value: Json
          enabled_plan_codes: Json | null
          flag_description: string | null
          flag_description2: string | null
          flag_key: string
          flag_name: string
          flag_name2: string | null
          governance_category: string
          is_active: boolean | null
          is_billable: boolean
          is_kill_switch: boolean
          is_sensitive: boolean
          json_schema: Json | null
          max_value: number | null
          min_value: number | null
          override_requires_approval: boolean | null
          plan_binding_type: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          ui_color: string | null
          ui_display_order: number | null
          ui_group: string | null
          ui_icon: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          validation_rules: Json | null
        }
        Insert: {
          allowed_values?: Json | null
          allows_tenant_override?: boolean | null
          comp_code?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          data_type: string
          default_value: Json
          enabled_plan_codes?: Json | null
          flag_description?: string | null
          flag_description2?: string | null
          flag_key: string
          flag_name: string
          flag_name2?: string | null
          governance_category: string
          is_active?: boolean | null
          is_billable?: boolean
          is_kill_switch?: boolean
          is_sensitive?: boolean
          json_schema?: Json | null
          max_value?: number | null
          min_value?: number | null
          override_requires_approval?: boolean | null
          plan_binding_type?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          ui_color?: string | null
          ui_display_order?: number | null
          ui_group?: string | null
          ui_icon?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          validation_rules?: Json | null
        }
        Update: {
          allowed_values?: Json | null
          allows_tenant_override?: boolean | null
          comp_code?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          data_type?: string
          default_value?: Json
          enabled_plan_codes?: Json | null
          flag_description?: string | null
          flag_description2?: string | null
          flag_key?: string
          flag_name?: string
          flag_name2?: string | null
          governance_category?: string
          is_active?: boolean | null
          is_billable?: boolean
          is_kill_switch?: boolean
          is_sensitive?: boolean
          json_schema?: Json | null
          max_value?: number | null
          min_value?: number | null
          override_requires_approval?: boolean | null
          plan_binding_type?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          ui_color?: string | null
          ui_display_order?: number | null
          ui_group?: string | null
          ui_icon?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          validation_rules?: Json | null
        }
        Relationships: []
      }
      hq_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          is_active: boolean | null
          is_system_role: boolean | null
          permissions: Json
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          role_code: string
          role_description: string | null
          role_description_ar: string | null
          role_name: string
          role_name_ar: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean | null
          is_system_role?: boolean | null
          permissions?: Json
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          role_code: string
          role_description?: string | null
          role_description_ar?: string | null
          role_name: string
          role_name_ar?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean | null
          is_system_role?: boolean | null
          permissions?: Json
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          role_code?: string
          role_description?: string | null
          role_description_ar?: string | null
          role_name?: string
          role_name_ar?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      hq_session_tokens: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          expires_at: string
          id: string
          ip_address: unknown
          last_used_at: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          refresh_token_hash: string | null
          token_hash: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          expires_at: string
          id?: string
          ip_address?: unknown
          last_used_at?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          refresh_token_hash?: string | null
          token_hash: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          expires_at?: string
          id?: string
          ip_address?: unknown
          last_used_at?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          refresh_token_hash?: string | null
          token_hash?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          created_at: string | null
          created_by: string | null
          created_info: string | null
          from_status: string | null
          id: string
          lifecycle_stage_from: string | null
          lifecycle_stage_to: string | null
          metadata: Json | null
          reason: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          tenant_id: string
          to_status: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          from_status?: string | null
          id?: string
          lifecycle_stage_from?: string | null
          lifecycle_stage_to?: string | null
          metadata?: Json | null
          reason?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_id: string
          to_status: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          from_status?: string | null
          id?: string
          lifecycle_stage_from?: string | null
          lifecycle_stage_to?: string | null
          metadata?: Json | null
          reason?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_id?: string
          to_status?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hq_tenant_status_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hq_tenant_status_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "hq_tenant_status_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
          last_login_ip: unknown
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
          last_login_ip?: unknown
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
          last_login_ip?: unknown
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
      org_asm_exceptions_tr: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          description: string
          description2: string | null
          exception_status: string | null
          exception_type_code: string
          id: string
          is_active: boolean
          notes: string | null
          photo_urls: Json | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          refund_amount: number | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string | null
          task_id: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          description: string
          description2?: string | null
          exception_status?: string | null
          exception_type_code: string
          id?: string
          is_active?: boolean
          notes?: string | null
          photo_urls?: Json | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          refund_amount?: number | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          task_id: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          description?: string
          description2?: string | null
          exception_status?: string | null
          exception_type_code?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          photo_urls?: Json | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          refund_amount?: number | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          task_id?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_asm_exc_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_asm_exception_task"
            columns: ["task_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_asm_tasks_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
        ]
      }
      org_asm_items_dtl: {
        Row: {
          barcode: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          exception_id: string | null
          has_exception: boolean | null
          id: string
          is_active: boolean
          item_name: string | null
          item_name2: string | null
          item_status: string | null
          order_item_id: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          scanned_at: string | null
          scanned_by: string | null
          task_id: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          barcode?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          exception_id?: string | null
          has_exception?: boolean | null
          id?: string
          is_active?: boolean
          item_name?: string | null
          item_name2?: string | null
          item_status?: string | null
          order_item_id: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          scanned_at?: string | null
          scanned_by?: string | null
          task_id: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          barcode?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          exception_id?: string | null
          has_exception?: boolean | null
          id?: string
          is_active?: boolean
          item_name?: string | null
          item_name2?: string | null
          item_status?: string | null
          order_item_id?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          scanned_at?: string | null
          scanned_by?: string | null
          task_id?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_asm_item_order_item"
            columns: ["order_item_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_order_items_dtl"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_asm_item_task"
            columns: ["task_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_asm_tasks_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
        ]
      }
      org_asm_locations_mst: {
        Row: {
          branch_id: string | null
          capacity: number | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          current_load: number | null
          id: string
          is_active: boolean
          location_code: string
          location_name: string
          location_name2: string | null
          location_type_code: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          branch_id?: string | null
          capacity?: number | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          current_load?: number | null
          id?: string
          is_active?: boolean
          location_code: string
          location_name: string
          location_name2?: string | null
          location_type_code: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          branch_id?: string | null
          capacity?: number | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          current_load?: number | null
          id?: string
          is_active?: boolean
          location_code?: string
          location_name?: string
          location_name2?: string | null
          location_type_code?: string
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
            foreignKeyName: "fk_asm_location_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_asm_location_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_asm_location_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_asm_location_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_asm_tasks_mst: {
        Row: {
          assigned_to: string | null
          branch_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          exception_items: number | null
          id: string
          is_active: boolean
          location_id: string | null
          order_id: string
          packaging_type_code: string | null
          packed_at: string | null
          packed_by: string | null
          packing_note: string | null
          qa_at: string | null
          qa_by: string | null
          qa_note: string | null
          qa_photo_url: string | null
          qa_status: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          scanned_items: number | null
          started_at: string | null
          task_status: string | null
          tenant_org_id: string
          total_items: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          assigned_to?: string | null
          branch_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          exception_items?: number | null
          id?: string
          is_active?: boolean
          location_id?: string | null
          order_id: string
          packaging_type_code?: string | null
          packed_at?: string | null
          packed_by?: string | null
          packing_note?: string | null
          qa_at?: string | null
          qa_by?: string | null
          qa_note?: string | null
          qa_photo_url?: string | null
          qa_status?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          scanned_items?: number | null
          started_at?: string | null
          task_status?: string | null
          tenant_org_id: string
          total_items?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          assigned_to?: string | null
          branch_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          exception_items?: number | null
          id?: string
          is_active?: boolean
          location_id?: string | null
          order_id?: string
          packaging_type_code?: string | null
          packed_at?: string | null
          packed_by?: string | null
          packing_note?: string | null
          qa_at?: string | null
          qa_by?: string | null
          qa_note?: string | null
          qa_photo_url?: string | null
          qa_status?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          scanned_items?: number | null
          started_at?: string | null
          task_status?: string | null
          tenant_org_id?: string
          total_items?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_asm_task_location"
            columns: ["location_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_asm_locations_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_asm_task_order"
            columns: ["order_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_asm_task_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_asm_task_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_asm_task_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_auth_user_permissions: {
        Row: {
          allow: boolean
          created_at: string | null
          created_by: string | null
          created_info: string | null
          id: string
          permission_code: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          user_id: string
        }
        Insert: {
          allow?: boolean
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          permission_code: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          user_id: string
        }
        Update: {
          allow?: boolean
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          permission_code?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          created_info: string | null
          id: string
          permission_code: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          resource_id: string
          resource_type: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          user_id: string
        }
        Insert: {
          allow?: boolean
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          permission_code: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          resource_id: string
          resource_type: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          user_id: string
        }
        Update: {
          allow?: boolean
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          permission_code?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          resource_id?: string
          resource_type?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          created_info: string | null
          id: string
          is_active: boolean
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          resource_id: string
          resource_type: string
          role_code: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          resource_id: string
          resource_type: string
          role_code: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          resource_id?: string
          resource_type?: string
          role_code?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          created_info: string | null
          id: string
          is_active: boolean
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          role_code: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          role_code: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          role_code?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          created_info: string | null
          id: string
          is_active: boolean
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          user_id: string
          workflow_role: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          user_id: string
          workflow_role: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          user_id?: string
          workflow_role?: string
        }
        Relationships: []
      }
      org_b2b_contacts_dtl: {
        Row: {
          contact_name: string | null
          contact_name2: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          customer_id: string
          email: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          phone: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          role_cd: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          contact_name?: string | null
          contact_name2?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          customer_id: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          phone?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          role_cd?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          contact_name?: string | null
          contact_name2?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          customer_id?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          phone?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          role_cd?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_b2b_contacts_dtl_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "org_customers_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_b2b_contacts_dtl_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_b2b_contacts_dtl_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_b2b_contacts_dtl_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_b2b_contracts_mst: {
        Row: {
          contract_no: string
          created_at: string | null
          created_by: string | null
          created_info: string | null
          customer_id: string
          effective_from: string | null
          effective_to: string | null
          id: string
          is_active: boolean | null
          pricing_terms: Json | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          contract_no: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          customer_id: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          pricing_terms?: Json | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          contract_no?: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          customer_id?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          pricing_terms?: Json | null
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
            foreignKeyName: "org_b2b_contracts_mst_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "org_customers_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_b2b_contracts_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_b2b_contracts_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_b2b_contracts_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_b2b_statements_mst: {
        Row: {
          balance_amount: number | null
          contract_id: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          currency_cd: string | null
          customer_id: string
          due_date: string | null
          id: string
          is_active: boolean | null
          paid_amount: number | null
          period_from: string | null
          period_to: string | null
          rec_status: number | null
          statement_no: string
          status_cd: string | null
          tenant_org_id: string
          total_amount: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          balance_amount?: number | null
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          currency_cd?: string | null
          customer_id: string
          due_date?: string | null
          id?: string
          is_active?: boolean | null
          paid_amount?: number | null
          period_from?: string | null
          period_to?: string | null
          rec_status?: number | null
          statement_no: string
          status_cd?: string | null
          tenant_org_id: string
          total_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          balance_amount?: number | null
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          currency_cd?: string | null
          customer_id?: string
          due_date?: string | null
          id?: string
          is_active?: boolean | null
          paid_amount?: number | null
          period_from?: string | null
          period_to?: string | null
          rec_status?: number | null
          statement_no?: string
          status_cd?: string | null
          tenant_org_id?: string
          total_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_b2b_statements_mst_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "org_b2b_contracts_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_b2b_statements_mst_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "org_customers_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_b2b_statements_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_b2b_statements_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_b2b_statements_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
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
          {
            foreignKeyName: "fk_org_branch_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_org_branch_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          street: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
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
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          street?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          street?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          {
            foreignKeyName: "fk_address_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_address_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_customer_category_cf: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          created_info: string | null
          display_order: number | null
          id: string
          is_active: boolean
          is_b2b: boolean
          is_individual: boolean
          name: string
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          system_category_code: string | null
          system_type: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          is_b2b?: boolean
          is_individual?: boolean
          name: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          system_category_code?: string | null
          system_type?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          is_b2b?: boolean
          is_individual?: boolean
          name?: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          system_category_code?: string | null
          system_type?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_customer_category_cf_system_category_code_fkey"
            columns: ["system_category_code"]
            isOneToOne: false
            referencedRelation: "sys_customer_category_cd"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "org_customer_category_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_customer_category_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_customer_category_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_customer_merge_log: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          id: string
          loyalty_points_merged: number | null
          merge_reason: string | null
          merged_by: string
          orders_moved: number | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          source_customer_id: string
          target_customer_id: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          loyalty_points_merged?: number | null
          merge_reason?: string | null
          merged_by: string
          orders_moved?: number | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          source_customer_id: string
          target_customer_id: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          loyalty_points_merged?: number | null
          merge_reason?: string | null
          merged_by?: string
          orders_moved?: number | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          source_customer_id?: string
          target_customer_id?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_customer_merge_log_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_customer_merge_log_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_customer_merge_log_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_customer_pref_changelog: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string | null
          changed_info: string | null
          customer_id: string
          id: string
          new_value: Json | null
          old_value: Json | null
          preference_code: string
          tenant_org_id: string
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by?: string | null
          changed_info?: string | null
          customer_id: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          preference_code: string
          tenant_org_id: string
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: string | null
          changed_info?: string | null
          customer_id?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          preference_code?: string
          tenant_org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_customer_pref_changelog_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_customer_pref_changelog_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_customer_pref_changelog_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_customer_service_prefs: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          customer_id: string
          id: string
          is_active: boolean | null
          preference_cf_id: string | null
          preference_code: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          source: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          customer_id: string
          id?: string
          is_active?: boolean | null
          preference_cf_id?: string | null
          preference_code: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          source?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          customer_id?: string
          id?: string
          is_active?: boolean | null
          preference_cf_id?: string | null
          preference_code?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          source?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_customer_service_prefs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "org_customers_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_customer_service_prefs_preference_cf_id_fkey"
            columns: ["preference_cf_id"]
            isOneToOne: false
            referencedRelation: "org_service_preference_cf"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_customer_service_prefs_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_customer_service_prefs_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_customer_service_prefs_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_customers_mst: {
        Row: {
          address: string | null
          area: string | null
          building: string | null
          company_name: string | null
          company_name2: string | null
          cost_center_code: string | null
          cr_id: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          credit_limit: number | null
          customer_category_id: string | null
          customer_id: string | null
          customer_source_type: string
          display_name: string | null
          email: string | null
          first_name: string | null
          floor: string | null
          id: string
          is_active: boolean
          is_credit_hold: boolean | null
          last_name: string | null
          loyalty_points: number | null
          name: string | null
          name2: string | null
          payment_terms_days: number | null
          phone: string | null
          preferences: Json | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          s_date: string
          tax_id: string | null
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
          company_name?: string | null
          company_name2?: string | null
          cost_center_code?: string | null
          cr_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          credit_limit?: number | null
          customer_category_id?: string | null
          customer_id?: string | null
          customer_source_type?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          floor?: string | null
          id?: string
          is_active?: boolean
          is_credit_hold?: boolean | null
          last_name?: string | null
          loyalty_points?: number | null
          name?: string | null
          name2?: string | null
          payment_terms_days?: number | null
          phone?: string | null
          preferences?: Json | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          s_date?: string
          tax_id?: string | null
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
          company_name?: string | null
          company_name2?: string | null
          cost_center_code?: string | null
          cr_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          credit_limit?: number | null
          customer_category_id?: string | null
          customer_id?: string | null
          customer_source_type?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          floor?: string | null
          id?: string
          is_active?: boolean
          is_credit_hold?: boolean | null
          last_name?: string | null
          loyalty_points?: number | null
          name?: string | null
          name2?: string | null
          payment_terms_days?: number | null
          phone?: string | null
          preferences?: Json | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          s_date?: string
          tax_id?: string | null
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
          {
            foreignKeyName: "fk_org_cust_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_org_cust_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_customers_mst_customer_category_id_fkey"
            columns: ["customer_category_id"]
            isOneToOne: false
            referencedRelation: "org_customer_category_cf"
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
          {
            foreignKeyName: "org_discount_rules_tenant_fk"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_discount_rules_tenant_fk"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_dlv_pod_tr: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          otp_code: string | null
          otp_verified: boolean | null
          photo_urls: Json | null
          pod_method_code: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          signature_url: string | null
          stop_id: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          otp_code?: string | null
          otp_verified?: boolean | null
          photo_urls?: Json | null
          pod_method_code: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          signature_url?: string | null
          stop_id: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          otp_code?: string | null
          otp_verified?: boolean | null
          photo_urls?: Json | null
          pod_method_code?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          signature_url?: string | null
          stop_id?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_dlv_pod_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_dlv_pod_stop"
            columns: ["stop_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_dlv_stops_dtl"
            referencedColumns: ["id", "tenant_org_id"]
          },
        ]
      }
      org_dlv_routes_mst: {
        Row: {
          branch_id: string | null
          completed_at: string | null
          completed_stops: number | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          driver_id: string | null
          estimated_duration_minutes: number | null
          id: string
          is_active: boolean
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          route_number: string
          route_status_code: string | null
          started_at: string | null
          tenant_org_id: string
          total_distance_km: number | null
          total_stops: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          branch_id?: string | null
          completed_at?: string | null
          completed_stops?: number | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          driver_id?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          route_number: string
          route_status_code?: string | null
          started_at?: string | null
          tenant_org_id: string
          total_distance_km?: number | null
          total_stops?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          branch_id?: string | null
          completed_at?: string | null
          completed_stops?: number | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          driver_id?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          route_number?: string
          route_status_code?: string | null
          started_at?: string | null
          tenant_org_id?: string
          total_distance_km?: number | null
          total_stops?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_dlv_route_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_dlv_route_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_dlv_route_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_dlv_route_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_dlv_slots_mst: {
        Row: {
          booked_count: number | null
          branch_id: string | null
          capacity: number | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          id: string
          is_active: boolean
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          slot_date: string
          slot_type: string
          tenant_org_id: string
          time_range_end: string
          time_range_start: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          booked_count?: number | null
          branch_id?: string | null
          capacity?: number | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          slot_date: string
          slot_type: string
          tenant_org_id: string
          time_range_end: string
          time_range_start: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          booked_count?: number | null
          branch_id?: string | null
          capacity?: number | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          slot_date?: string
          slot_type?: string
          tenant_org_id?: string
          time_range_end?: string
          time_range_start?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_dlv_slot_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_dlv_slot_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_dlv_slot_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_dlv_slot_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_dlv_stops_dtl: {
        Row: {
          actual_time: string | null
          address: string
          address_lat: number | null
          address_lng: number | null
          branch_id: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          estimated_arrival: string | null
          id: string
          is_active: boolean
          notes: string | null
          order_id: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          route_id: string
          scheduled_time: string | null
          sequence: number
          stop_status_code: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          actual_time?: string | null
          address: string
          address_lat?: number | null
          address_lng?: number | null
          branch_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          estimated_arrival?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          order_id: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          route_id: string
          scheduled_time?: string | null
          sequence: number
          stop_status_code?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          actual_time?: string | null
          address?: string
          address_lat?: number | null
          address_lng?: number | null
          branch_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          estimated_arrival?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          order_id?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          route_id?: string
          scheduled_time?: string | null
          sequence?: number
          stop_status_code?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_dlv_stop_order"
            columns: ["order_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_dlv_stop_route"
            columns: ["route_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_dlv_routes_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_dlv_stops_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
        ]
      }
      org_ff_overrides_cf: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          data_type: string
          effective_from: string | null
          effective_until: string | null
          flag_key: string
          id: string
          is_active: boolean | null
          override_reason: string | null
          override_type: string | null
          override_value: Json
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          rejection_reason: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          data_type: string
          effective_from?: string | null
          effective_until?: string | null
          flag_key: string
          id?: string
          is_active?: boolean | null
          override_reason?: string | null
          override_type?: string | null
          override_value: Json
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          rejection_reason?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          data_type?: string
          effective_from?: string | null
          effective_until?: string | null
          flag_key?: string
          id?: string
          is_active?: boolean | null
          override_reason?: string | null
          override_type?: string | null
          override_value?: Json
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          rejection_reason?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_ff_overrides_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_ff_overrides_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_ff_overrides_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_acct_mst: {
        Row: {
          acc_group_id: string | null
          acc_type_id: string
          account_code: string
          account_level: number
          allow_tenant_children: boolean
          branch_id: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          description: string | null
          description2: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          is_active: boolean
          is_control_account: boolean
          is_locked: boolean
          is_postable: boolean
          is_system_linked: boolean
          is_system_seeded: boolean
          manual_post_allowed: boolean
          name: string
          name2: string | null
          parent_account_id: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          source_tpl_line_id: string | null
          source_tpl_pkg_id: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          acc_group_id?: string | null
          acc_type_id: string
          account_code: string
          account_level: number
          allow_tenant_children?: boolean
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          is_control_account?: boolean
          is_locked?: boolean
          is_postable?: boolean
          is_system_linked?: boolean
          is_system_seeded?: boolean
          manual_post_allowed?: boolean
          name: string
          name2?: string | null
          parent_account_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          source_tpl_line_id?: string | null
          source_tpl_pkg_id?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          acc_group_id?: string | null
          acc_type_id?: string
          account_code?: string
          account_level?: number
          allow_tenant_children?: boolean
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          is_control_account?: boolean
          is_locked?: boolean
          is_postable?: boolean
          is_system_linked?: boolean
          is_system_seeded?: boolean
          manual_post_allowed?: boolean
          name?: string
          name2?: string | null
          parent_account_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          source_tpl_line_id?: string | null
          source_tpl_pkg_id?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofa_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofa_group"
            columns: ["acc_group_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_acc_group_cd"
            referencedColumns: ["acc_group_id"]
          },
          {
            foreignKeyName: "fk_ofa_parent"
            columns: ["parent_account_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_acct_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofa_parent"
            columns: ["parent_account_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_coa_explorer"
            referencedColumns: ["account_id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofa_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofa_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofa_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofa_tplline"
            columns: ["source_tpl_line_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_coa_tpl_dtl"
            referencedColumns: ["coa_tpl_line_id"]
          },
          {
            foreignKeyName: "fk_ofa_tplpkg"
            columns: ["source_tpl_pkg_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_tpl_pkg_mst"
            referencedColumns: ["tpl_pkg_id"]
          },
          {
            foreignKeyName: "fk_ofa_type"
            columns: ["acc_type_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_acc_type_cd"
            referencedColumns: ["acc_type_id"]
          },
        ]
      }
      org_fin_alloc_rule_mst: {
        Row: {
          alloc_scope_code: string
          basis_code: string
          created_at: string
          created_by: string | null
          created_info: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          is_active: boolean
          name: string
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          rule_code: string
          source_filter_json: Json | null
          status_code: string
          target_filter_json: Json | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          alloc_scope_code: string
          basis_code: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          name: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          rule_code: string
          source_filter_json?: Json | null
          status_code?: string
          target_filter_json?: Json | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          alloc_scope_code?: string
          basis_code?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          rule_code?: string
          source_filter_json?: Json | null
          status_code?: string
          target_filter_json?: Json | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofar_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofar_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofar_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_alloc_run_dtl: {
        Row: {
          alloc_amount: number
          alloc_rule_id: string | null
          alloc_run_id: string
          basis_value: number | null
          created_at: string
          created_by: string | null
          created_info: string | null
          id: string
          is_active: boolean
          line_no: number
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          source_amount: number
          source_branch_id: string | null
          source_ref_json: Json | null
          target_branch_id: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          alloc_amount?: number
          alloc_rule_id?: string | null
          alloc_run_id: string
          basis_value?: number | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          line_no: number
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          source_amount?: number
          source_branch_id?: string | null
          source_ref_json?: Json | null
          target_branch_id?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          alloc_amount?: number
          alloc_rule_id?: string | null
          alloc_run_id?: string
          basis_value?: number | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          line_no?: number
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          source_amount?: number
          source_branch_id?: string | null
          source_ref_json?: Json | null
          target_branch_id?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofrd_rul"
            columns: ["alloc_rule_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_alloc_rule_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofrd_run"
            columns: ["alloc_run_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_alloc_run_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofrd_sbr"
            columns: ["source_branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofrd_tbr"
            columns: ["target_branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofrd_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofrd_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofrd_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_alloc_run_mst: {
        Row: {
          alloc_scope_code: string
          basis_snapshot_json: Json | null
          created_at: string
          created_by: string | null
          created_info: string | null
          id: string
          is_active: boolean
          period_id: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          run_date: string
          run_no: string
          status_code: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          alloc_scope_code: string
          basis_snapshot_json?: Json | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          period_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          run_date: string
          run_no: string
          status_code?: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          alloc_scope_code?: string
          basis_snapshot_json?: Json | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          period_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          run_date?: string
          run_no?: string
          status_code?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofrn_per"
            columns: ["period_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_period_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofrn_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofrn_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofrn_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_ap_alloc_tr: {
        Row: {
          alloc_amount: number
          alloc_no: number
          ap_invoice_id: string
          ap_payment_id: string
          created_at: string
          created_by: string | null
          created_info: string | null
          id: string
          is_active: boolean
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          alloc_amount?: number
          alloc_no: number
          ap_invoice_id: string
          ap_payment_id: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          alloc_amount?: number
          alloc_no?: number
          ap_invoice_id?: string
          ap_payment_id?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofaa_inv"
            columns: ["ap_invoice_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_ap_inv_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofaa_pmt"
            columns: ["ap_payment_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_ap_pmt_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofaa_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofaa_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofaa_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_ap_inv_dtl: {
        Row: {
          ap_inv_id: string
          branch_id: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          description: string
          description2: string | null
          gross_amount: number
          id: string
          is_active: boolean
          line_no: number
          net_amount: number
          po_line_id: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          tax_amount: number
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          usage_code_id: string | null
        }
        Insert: {
          ap_inv_id: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description: string
          description2?: string | null
          gross_amount?: number
          id?: string
          is_active?: boolean
          line_no: number
          net_amount?: number
          po_line_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          tax_amount?: number
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          usage_code_id?: string | null
        }
        Update: {
          ap_inv_id?: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string
          description2?: string | null
          gross_amount?: number
          id?: string
          is_active?: boolean
          line_no?: number
          net_amount?: number
          po_line_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          tax_amount?: number
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          usage_code_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofad_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofad_inv"
            columns: ["ap_inv_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_ap_inv_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofad_po"
            columns: ["po_line_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_po_dtl"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofad_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofad_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofad_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofad_usage"
            columns: ["usage_code_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_usage_code_cd"
            referencedColumns: ["usage_code_id"]
          },
          {
            foreignKeyName: "fk_ofad_usage"
            columns: ["usage_code_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["usage_code_id"]
          },
        ]
      }
      org_fin_ap_inv_mst: {
        Row: {
          ap_inv_no: string
          branch_id: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          currency_code: string
          due_date: string | null
          exchange_rate: number
          id: string
          invoice_date: string
          is_active: boolean
          open_amount: number
          po_id: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          status_code: string
          subtotal_amount: number
          supplier_id: string
          supplier_inv_no: string | null
          tax_amount: number
          tenant_org_id: string
          total_amount: number
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          ap_inv_no: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code: string
          due_date?: string | null
          exchange_rate?: number
          id?: string
          invoice_date: string
          is_active?: boolean
          open_amount?: number
          po_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          subtotal_amount?: number
          supplier_id: string
          supplier_inv_no?: string | null
          tax_amount?: number
          tenant_org_id: string
          total_amount?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          ap_inv_no?: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code?: string
          due_date?: string | null
          exchange_rate?: number
          id?: string
          invoice_date?: string
          is_active?: boolean
          open_amount?: number
          po_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          subtotal_amount?: number
          supplier_id?: string
          supplier_inv_no?: string | null
          tax_amount?: number
          tenant_org_id?: string
          total_amount?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofai_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofai_po"
            columns: ["po_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_po_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofai_supp"
            columns: ["supplier_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_supp_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofai_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofai_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofai_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_ap_pmt_mst: {
        Row: {
          amount_total: number
          ap_pmt_no: string
          bank_account_id: string | null
          branch_id: string | null
          cashbox_id: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          currency_code: string
          exchange_rate: number
          ext_ref_no: string | null
          id: string
          is_active: boolean
          payment_date: string
          payment_method_code: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          settlement_code: string
          status_code: string
          supplier_id: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          amount_total?: number
          ap_pmt_no: string
          bank_account_id?: string | null
          branch_id?: string | null
          cashbox_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code: string
          exchange_rate?: number
          ext_ref_no?: string | null
          id?: string
          is_active?: boolean
          payment_date: string
          payment_method_code?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          settlement_code: string
          status_code?: string
          supplier_id: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          amount_total?: number
          ap_pmt_no?: string
          bank_account_id?: string | null
          branch_id?: string | null
          cashbox_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code?: string
          exchange_rate?: number
          ext_ref_no?: string | null
          id?: string
          is_active?: boolean
          payment_date?: string
          payment_method_code?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          settlement_code?: string
          status_code?: string
          supplier_id?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofap_bank"
            columns: ["bank_account_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_bank_acct_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofap_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofap_cash"
            columns: ["cashbox_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_cashbox_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofap_supp"
            columns: ["supplier_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_supp_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofap_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofap_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofap_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_bank_acct_mst: {
        Row: {
          account_id: string
          allow_auto_match: boolean
          bank_account_no: string
          bank_code: string
          bank_name: string | null
          bank_name2: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          currency_code: string
          iban_no: string | null
          id: string
          is_active: boolean
          last_stmt_date: string | null
          match_mode: string
          name: string
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          status_code: string
          stmt_import_mode: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          account_id: string
          allow_auto_match?: boolean
          bank_account_no: string
          bank_code: string
          bank_name?: string | null
          bank_name2?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code: string
          iban_no?: string | null
          id?: string
          is_active?: boolean
          last_stmt_date?: string | null
          match_mode?: string
          name: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          stmt_import_mode?: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          account_id?: string
          allow_auto_match?: boolean
          bank_account_no?: string
          bank_code?: string
          bank_name?: string | null
          bank_name2?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code?: string
          iban_no?: string | null
          id?: string
          is_active?: boolean
          last_stmt_date?: string | null
          match_mode?: string
          name?: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          stmt_import_mode?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofba_acct"
            columns: ["account_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_acct_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofba_acct"
            columns: ["account_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_coa_explorer"
            referencedColumns: ["account_id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofba_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofba_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofba_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofba_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_bank_match_tr: {
        Row: {
          bank_recon_id: string | null
          bank_stmt_line_id: string
          created_at: string
          created_by: string | null
          created_info: string | null
          id: string
          is_active: boolean
          match_amount: number
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          source_doc_id: string
          source_doc_type: string
          status_code: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          bank_recon_id?: string | null
          bank_stmt_line_id: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          match_amount?: number
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          source_doc_id: string
          source_doc_type: string
          status_code?: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          bank_recon_id?: string | null
          bank_stmt_line_id?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          match_amount?: number
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          source_doc_id?: string
          source_doc_type?: string
          status_code?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofbm_rec"
            columns: ["bank_recon_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_bank_recon_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofbm_stmt"
            columns: ["bank_stmt_line_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_bank_stmt_dtl"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofbm_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofbm_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofbm_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_bank_recon_mst: {
        Row: {
          bank_account_id: string
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          gl_balance: number | null
          id: string
          is_active: boolean
          period_id: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          recon_code: string
          recon_date: string
          status_code: string
          stmt_balance: number | null
          stmt_date_from: string
          stmt_date_to: string
          tenant_org_id: string
          unmatched_amount: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          bank_account_id: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          gl_balance?: number | null
          id?: string
          is_active?: boolean
          period_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          recon_code: string
          recon_date: string
          status_code?: string
          stmt_balance?: number | null
          stmt_date_from: string
          stmt_date_to: string
          tenant_org_id: string
          unmatched_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          bank_account_id?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          gl_balance?: number | null
          id?: string
          is_active?: boolean
          period_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          recon_code?: string
          recon_date?: string
          status_code?: string
          stmt_balance?: number | null
          stmt_date_from?: string
          stmt_date_to?: string
          tenant_org_id?: string
          unmatched_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofbr_bank"
            columns: ["bank_account_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_bank_acct_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofbr_per"
            columns: ["period_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_period_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofbr_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofbr_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofbr_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_bank_stmt_dtl: {
        Row: {
          balance_amount: number | null
          bank_account_id: string
          bank_stmt_id: string
          created_at: string
          created_by: string | null
          created_info: string | null
          credit_amount: number
          debit_amount: number
          description: string | null
          description2: string | null
          ext_ref_no: string | null
          id: string
          is_active: boolean
          line_no: number
          match_status: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          source_hash: string
          tenant_org_id: string
          txn_date: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          value_date: string | null
        }
        Insert: {
          balance_amount?: number | null
          bank_account_id: string
          bank_stmt_id: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          credit_amount?: number
          debit_amount?: number
          description?: string | null
          description2?: string | null
          ext_ref_no?: string | null
          id?: string
          is_active?: boolean
          line_no: number
          match_status?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          source_hash: string
          tenant_org_id: string
          txn_date: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          value_date?: string | null
        }
        Update: {
          balance_amount?: number | null
          bank_account_id?: string
          bank_stmt_id?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          credit_amount?: number
          debit_amount?: number
          description?: string | null
          description2?: string | null
          ext_ref_no?: string | null
          id?: string
          is_active?: boolean
          line_no?: number
          match_status?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          source_hash?: string
          tenant_org_id?: string
          txn_date?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofbd_bank"
            columns: ["bank_account_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_bank_acct_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofbd_stmt"
            columns: ["bank_stmt_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_bank_stmt_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofbd_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofbd_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofbd_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_bank_stmt_mst: {
        Row: {
          bank_account_id: string
          closing_balance: number | null
          created_at: string
          created_by: string | null
          created_info: string | null
          id: string
          import_batch_no: string
          imported_at: string
          is_active: boolean
          line_count: number
          opening_balance: number | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          source_code: string
          source_file_name: string | null
          status_code: string
          stmt_date_from: string
          stmt_date_to: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          bank_account_id: string
          closing_balance?: number | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          import_batch_no: string
          imported_at?: string
          is_active?: boolean
          line_count?: number
          opening_balance?: number | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          source_code?: string
          source_file_name?: string | null
          status_code?: string
          stmt_date_from: string
          stmt_date_to: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          bank_account_id?: string
          closing_balance?: number | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          import_batch_no?: string
          imported_at?: string
          is_active?: boolean
          line_count?: number
          opening_balance?: number | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          source_code?: string
          source_file_name?: string | null
          status_code?: string
          stmt_date_from?: string
          stmt_date_to?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofbs_bank"
            columns: ["bank_account_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_bank_acct_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofbs_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofbs_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofbs_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_cash_exc_tr: {
        Row: {
          amount: number
          cash_recon_id: string
          created_at: string
          created_by: string | null
          created_info: string | null
          id: string
          is_active: boolean
          line_no: number
          note: string | null
          note2: string | null
          reason_code: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          amount?: number
          cash_recon_id: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          line_no: number
          note?: string | null
          note2?: string | null
          reason_code: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          amount?: number
          cash_recon_id?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          line_no?: number
          note?: string | null
          note2?: string | null
          reason_code?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofce_rec"
            columns: ["cash_recon_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_cash_rec_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofce_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofce_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofce_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_cash_rec_mst: {
        Row: {
          branch_id: string | null
          cashbox_id: string
          closed_at: string | null
          closed_by: string | null
          counted_balance: number
          created_at: string
          created_by: string | null
          created_info: string | null
          expected_balance: number
          id: string
          is_active: boolean
          opening_balance: number
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          recon_date: string
          recon_no: string
          status_code: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          variance_amount: number
        }
        Insert: {
          branch_id?: string | null
          cashbox_id: string
          closed_at?: string | null
          closed_by?: string | null
          counted_balance?: number
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          expected_balance?: number
          id?: string
          is_active?: boolean
          opening_balance?: number
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          recon_date: string
          recon_no: string
          status_code?: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          variance_amount?: number
        }
        Update: {
          branch_id?: string | null
          cashbox_id?: string
          closed_at?: string | null
          closed_by?: string | null
          counted_balance?: number
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          expected_balance?: number
          id?: string
          is_active?: boolean
          opening_balance?: number
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          recon_date?: string
          recon_no?: string
          status_code?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          variance_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofcr_brn"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofcr_cash"
            columns: ["cashbox_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_cashbox_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofcr_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofcr_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofcr_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_cash_txn_tr: {
        Row: {
          amount_total: number
          branch_id: string | null
          cashbox_id: string
          created_at: string
          created_by: string | null
          created_info: string | null
          currency_code: string
          description: string | null
          description2: string | null
          exchange_rate: number
          expense_usage_code_id: string | null
          funding_usage_code_id: string | null
          id: string
          is_active: boolean
          party_name: string | null
          party_name2: string | null
          posting_date: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          reference_no: string | null
          status_code: string
          tenant_org_id: string
          txn_date: string
          txn_no: string
          txn_type_code: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          amount_total: number
          branch_id?: string | null
          cashbox_id: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code: string
          description?: string | null
          description2?: string | null
          exchange_rate?: number
          expense_usage_code_id?: string | null
          funding_usage_code_id?: string | null
          id?: string
          is_active?: boolean
          party_name?: string | null
          party_name2?: string | null
          posting_date?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          reference_no?: string | null
          status_code?: string
          tenant_org_id: string
          txn_date: string
          txn_no: string
          txn_type_code: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          amount_total?: number
          branch_id?: string | null
          cashbox_id?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code?: string
          description?: string | null
          description2?: string | null
          exchange_rate?: number
          expense_usage_code_id?: string | null
          funding_usage_code_id?: string | null
          id?: string
          is_active?: boolean
          party_name?: string | null
          party_name2?: string | null
          posting_date?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          reference_no?: string | null
          status_code?: string
          tenant_org_id?: string
          txn_date?: string
          txn_no?: string
          txn_type_code?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofct_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofct_cash"
            columns: ["cashbox_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_cashbox_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofct_exp"
            columns: ["expense_usage_code_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_usage_code_cd"
            referencedColumns: ["usage_code_id"]
          },
          {
            foreignKeyName: "fk_ofct_exp"
            columns: ["expense_usage_code_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["usage_code_id"]
          },
          {
            foreignKeyName: "fk_ofct_fund"
            columns: ["funding_usage_code_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_usage_code_cd"
            referencedColumns: ["usage_code_id"]
          },
          {
            foreignKeyName: "fk_ofct_fund"
            columns: ["funding_usage_code_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["usage_code_id"]
          },
          {
            foreignKeyName: "fk_ofct_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofct_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofct_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_cashbox_mst: {
        Row: {
          account_id: string
          branch_id: string | null
          cashbox_code: string
          created_at: string
          created_by: string | null
          created_info: string | null
          currency_code: string
          description: string | null
          description2: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          name2: string | null
          opening_balance: number
          opening_date: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          account_id: string
          branch_id?: string | null
          cashbox_code: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code: string
          description?: string | null
          description2?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          name2?: string | null
          opening_balance?: number
          opening_date?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          account_id?: string
          branch_id?: string | null
          cashbox_code?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code?: string
          description?: string | null
          description2?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          name2?: string | null
          opening_balance?: number
          opening_date?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofc_acct"
            columns: ["account_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_acct_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofc_acct"
            columns: ["account_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_coa_explorer"
            referencedColumns: ["account_id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofc_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofc_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofc_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofc_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_cost_cmp_cd: {
        Row: {
          basis_code: string
          comp_code: string
          cost_class_code: string
          created_at: string
          created_by: string | null
          created_info: string | null
          id: string
          is_active: boolean
          name: string
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          status_code: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          basis_code: string
          comp_code: string
          cost_class_code: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          name: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          basis_code?: string
          comp_code?: string
          cost_class_code?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofcc_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofcc_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofcc_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_cost_run_dtl: {
        Row: {
          alloc_amount: number
          basis_value: number | null
          branch_id: string | null
          cost_comp_id: string
          cost_run_id: string
          created_at: string
          created_by: string | null
          created_info: string | null
          id: string
          is_active: boolean
          line_no: number
          order_id: string | null
          order_item_id: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          source_ref_json: Json | null
          tenant_org_id: string
          total_cost: number
          unit_cost: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          alloc_amount?: number
          basis_value?: number | null
          branch_id?: string | null
          cost_comp_id: string
          cost_run_id: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          line_no: number
          order_id?: string | null
          order_item_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          source_ref_json?: Json | null
          tenant_org_id: string
          total_cost?: number
          unit_cost?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          alloc_amount?: number
          basis_value?: number | null
          branch_id?: string | null
          cost_comp_id?: string
          cost_run_id?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          line_no?: number
          order_id?: string | null
          order_item_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          source_ref_json?: Json | null
          tenant_org_id?: string
          total_cost?: number
          unit_cost?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofcd_brn"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofcd_cmp"
            columns: ["cost_comp_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_cost_cmp_cd"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofcd_run"
            columns: ["cost_run_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_cost_run_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofcd_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofcd_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofcd_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_cost_run_mst: {
        Row: {
          basis_snapshot_json: Json | null
          created_at: string
          created_by: string | null
          created_info: string | null
          id: string
          is_active: boolean
          period_id: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          run_date: string
          run_no: string
          status_code: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          basis_snapshot_json?: Json | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          period_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          run_date: string
          run_no: string
          status_code?: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          basis_snapshot_json?: Json | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          period_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          run_date?: string
          run_no?: string
          status_code?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofcm_per"
            columns: ["period_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_period_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofcm_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofcm_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofcm_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_doc_appr_tr: {
        Row: {
          action_at: string | null
          action_note: string | null
          action_note2: string | null
          approver_user_id: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          id: string
          is_active: boolean
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          source_doc_id: string
          source_doc_type: string
          status_code: string
          step_no: number
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          action_at?: string | null
          action_note?: string | null
          action_note2?: string | null
          approver_user_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          source_doc_id: string
          source_doc_type: string
          status_code?: string
          step_no: number
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          action_at?: string | null
          action_note?: string | null
          action_note2?: string | null
          approver_user_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          source_doc_id?: string
          source_doc_type?: string
          status_code?: string
          step_no?: number
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofda_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofda_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofda_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_doc_seq_mst: {
        Row: {
          created_at: string
          created_by: string | null
          created_info: string | null
          doc_type_code: string
          id: string
          is_active: boolean
          last_no: number
          padding_len: number
          prefix: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          doc_type_code: string
          id?: string
          is_active?: boolean
          last_no?: number
          padding_len?: number
          prefix?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          doc_type_code?: string
          id?: string
          is_active?: boolean
          last_no?: number
          padding_len?: number
          prefix?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofds_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofds_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofds_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_exp_dtl: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          expense_id: string
          gross_amount: number
          id: string
          is_active: boolean
          line_description: string | null
          line_description2: string | null
          line_no: number
          net_amount: number
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          tax_amount: number
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          usage_code_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          expense_id: string
          gross_amount?: number
          id?: string
          is_active?: boolean
          line_description?: string | null
          line_description2?: string | null
          line_no: number
          net_amount?: number
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          tax_amount?: number
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          usage_code_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          expense_id?: string
          gross_amount?: number
          id?: string
          is_active?: boolean
          line_description?: string | null
          line_description2?: string | null
          line_no?: number
          net_amount?: number
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          tax_amount?: number
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          usage_code_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofed_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofed_exp"
            columns: ["expense_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_exp_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofed_usage"
            columns: ["usage_code_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_usage_code_cd"
            referencedColumns: ["usage_code_id"]
          },
          {
            foreignKeyName: "fk_ofed_usage"
            columns: ["usage_code_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["usage_code_id"]
          },
        ]
      }
      org_fin_exp_mst: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          currency_code: string
          description: string | null
          description2: string | null
          exchange_rate: number
          expense_date: string
          expense_no: string
          id: string
          is_active: boolean
          payee_name: string | null
          payee_name2: string | null
          posting_date: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          settlement_code: string
          source_ref_no: string | null
          status_code: string
          subtotal_amount: number
          tax_amount: number
          tenant_org_id: string
          total_amount: number
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code: string
          description?: string | null
          description2?: string | null
          exchange_rate?: number
          expense_date: string
          expense_no: string
          id?: string
          is_active?: boolean
          payee_name?: string | null
          payee_name2?: string | null
          posting_date?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          settlement_code?: string
          source_ref_no?: string | null
          status_code?: string
          subtotal_amount?: number
          tax_amount?: number
          tenant_org_id: string
          total_amount?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code?: string
          description?: string | null
          description2?: string | null
          exchange_rate?: number
          expense_date?: string
          expense_no?: string
          id?: string
          is_active?: boolean
          payee_name?: string | null
          payee_name2?: string | null
          posting_date?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          settlement_code?: string
          source_ref_no?: string | null
          status_code?: string
          subtotal_amount?: number
          tax_amount?: number
          tenant_org_id?: string
          total_amount?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofe_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofe_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofe_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofe_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_gov_assign_mst: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assignment_mode: string
          created_at: string
          created_by: string | null
          created_info: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          is_active: boolean
          is_current: boolean
          pkg_id: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          status_code: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assignment_mode?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          is_current?: boolean
          pkg_id: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assignment_mode?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          is_current?: boolean
          pkg_id?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofga_pkg"
            columns: ["pkg_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_gov_pkg_mst"
            referencedColumns: ["pkg_id"]
          },
          {
            foreignKeyName: "fk_ofga_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofga_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofga_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_journal_dtl: {
        Row: {
          account_id: string
          amount_base_currency: number
          amount_txn_currency: number
          branch_id: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          entry_side: string
          id: string
          is_active: boolean
          journal_id: string
          line_description: string | null
          line_description2: string | null
          line_no: number
          party_id: string | null
          party_type_code: string | null
          profit_center_id: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          tax_code: string | null
          tax_rate: number | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          account_id: string
          amount_base_currency: number
          amount_txn_currency: number
          branch_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          entry_side: string
          id?: string
          is_active?: boolean
          journal_id: string
          line_description?: string | null
          line_description2?: string | null
          line_no: number
          party_id?: string | null
          party_type_code?: string | null
          profit_center_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          tax_code?: string | null
          tax_rate?: number | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          account_id?: string
          amount_base_currency?: number
          amount_txn_currency?: number
          branch_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          entry_side?: string
          id?: string
          is_active?: boolean
          journal_id?: string
          line_description?: string | null
          line_description2?: string | null
          line_no?: number
          party_id?: string | null
          party_type_code?: string | null
          profit_center_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          tax_code?: string | null
          tax_rate?: number | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofjd_acct"
            columns: ["account_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_acct_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofjd_acct"
            columns: ["account_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_coa_explorer"
            referencedColumns: ["account_id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofjd_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofjd_jrnl"
            columns: ["journal_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_journal_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofjd_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofjd_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofjd_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_journal_mst: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          currency_code: string
          exchange_rate: number
          id: string
          is_active: boolean
          journal_date: string
          journal_no: string
          mapping_rule_id: string | null
          mapping_rule_version_no: number | null
          narration: string | null
          narration2: string | null
          posted_at: string | null
          posted_by: string | null
          posting_date: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          reversal_of_journal_id: string | null
          source_doc_id: string
          source_doc_no: string | null
          source_doc_type_code: string
          source_module_code: string
          status_code: string
          tenant_org_id: string
          total_credit: number
          total_debit: number
          txn_event_code: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code: string
          exchange_rate?: number
          id?: string
          is_active?: boolean
          journal_date: string
          journal_no: string
          mapping_rule_id?: string | null
          mapping_rule_version_no?: number | null
          narration?: string | null
          narration2?: string | null
          posted_at?: string | null
          posted_by?: string | null
          posting_date: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          reversal_of_journal_id?: string | null
          source_doc_id: string
          source_doc_no?: string | null
          source_doc_type_code: string
          source_module_code: string
          status_code?: string
          tenant_org_id: string
          total_credit?: number
          total_debit?: number
          txn_event_code: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code?: string
          exchange_rate?: number
          id?: string
          is_active?: boolean
          journal_date?: string
          journal_no?: string
          mapping_rule_id?: string | null
          mapping_rule_version_no?: number | null
          narration?: string | null
          narration2?: string | null
          posted_at?: string | null
          posted_by?: string | null
          posting_date?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          reversal_of_journal_id?: string | null
          source_doc_id?: string
          source_doc_no?: string | null
          source_doc_type_code?: string
          source_module_code?: string
          status_code?: string
          tenant_org_id?: string
          total_credit?: number
          total_debit?: number
          txn_event_code?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofj_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofj_evt"
            columns: ["txn_event_code"]
            isOneToOne: false
            referencedRelation: "sys_fin_evt_cd"
            referencedColumns: ["evt_code"]
          },
          {
            foreignKeyName: "fk_ofj_rev"
            columns: ["reversal_of_journal_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_journal_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofj_rule"
            columns: ["mapping_rule_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_map_rule_mst"
            referencedColumns: ["rule_id"]
          },
          {
            foreignKeyName: "fk_ofj_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofj_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofj_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_period_mst: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          description: string | null
          description2: string | null
          end_date: string
          id: string
          is_active: boolean
          lock_reason: string | null
          name: string
          name2: string | null
          period_code: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          start_date: string
          status_code: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          end_date: string
          id?: string
          is_active?: boolean
          lock_reason?: string | null
          name: string
          name2?: string | null
          period_code: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          start_date: string
          status_code?: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          end_date?: string
          id?: string
          is_active?: boolean
          lock_reason?: string | null
          name?: string
          name2?: string | null
          period_code?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          start_date?: string
          status_code?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofp_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofp_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofp_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_po_dtl: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          description: string
          description2: string | null
          gross_amount: number
          id: string
          is_active: boolean
          line_no: number
          net_amount: number
          po_id: string
          qty_ordered: number
          qty_received: number
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          tax_amount: number
          tenant_org_id: string
          unit_price: number
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          usage_code_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description: string
          description2?: string | null
          gross_amount?: number
          id?: string
          is_active?: boolean
          line_no: number
          net_amount?: number
          po_id: string
          qty_ordered?: number
          qty_received?: number
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          tax_amount?: number
          tenant_org_id: string
          unit_price?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          usage_code_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string
          description2?: string | null
          gross_amount?: number
          id?: string
          is_active?: boolean
          line_no?: number
          net_amount?: number
          po_id?: string
          qty_ordered?: number
          qty_received?: number
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          tax_amount?: number
          tenant_org_id?: string
          unit_price?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          usage_code_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofpd_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpd_po"
            columns: ["po_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_po_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpd_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofpd_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpd_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpd_usage"
            columns: ["usage_code_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_usage_code_cd"
            referencedColumns: ["usage_code_id"]
          },
          {
            foreignKeyName: "fk_ofpd_usage"
            columns: ["usage_code_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["usage_code_id"]
          },
        ]
      }
      org_fin_po_mst: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          currency_code: string
          exchange_rate: number
          expected_date: string | null
          id: string
          is_active: boolean
          po_date: string
          po_no: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          status_code: string
          subtotal_amount: number
          supplier_id: string
          tax_amount: number
          tenant_org_id: string
          total_amount: number
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code: string
          exchange_rate?: number
          expected_date?: string | null
          id?: string
          is_active?: boolean
          po_date: string
          po_no: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          subtotal_amount?: number
          supplier_id: string
          tax_amount?: number
          tenant_org_id: string
          total_amount?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code?: string
          exchange_rate?: number
          expected_date?: string | null
          id?: string
          is_active?: boolean
          po_date?: string
          po_no?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          subtotal_amount?: number
          supplier_id?: string
          tax_amount?: number
          tenant_org_id?: string
          total_amount?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofpo_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpo_supp"
            columns: ["supplier_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_supp_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpo_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofpo_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpo_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_post_action_tr: {
        Row: {
          action_code: string
          action_domain: string
          action_notes: string | null
          actor_ip: string | null
          actor_user_agent: string | null
          actor_user_id: string
          created_at: string
          created_by: string | null
          created_info: string | null
          exception_id: string | null
          id: string
          is_active: boolean
          new_status_code: string | null
          period_id: string | null
          posting_log_id: string | null
          prev_status_code: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          result_code: string
          tenant_org_id: string
          triggered_log_id: string | null
          usage_map_id: string | null
        }
        Insert: {
          action_code: string
          action_domain: string
          action_notes?: string | null
          actor_ip?: string | null
          actor_user_agent?: string | null
          actor_user_id: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          exception_id?: string | null
          id?: string
          is_active?: boolean
          new_status_code?: string | null
          period_id?: string | null
          posting_log_id?: string | null
          prev_status_code?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          result_code?: string
          tenant_org_id: string
          triggered_log_id?: string | null
          usage_map_id?: string | null
        }
        Update: {
          action_code?: string
          action_domain?: string
          action_notes?: string | null
          actor_ip?: string | null
          actor_user_agent?: string | null
          actor_user_id?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          exception_id?: string | null
          id?: string
          is_active?: boolean
          new_status_code?: string | null
          period_id?: string | null
          posting_log_id?: string | null
          prev_status_code?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          result_code?: string
          tenant_org_id?: string
          triggered_log_id?: string | null
          usage_map_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofpa_exc"
            columns: ["exception_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_post_exc_tr"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpa_exc"
            columns: ["exception_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_open_exceptions"
            referencedColumns: ["exception_id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpa_log"
            columns: ["posting_log_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_post_log_tr"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpa_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofpa_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpa_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_post_exc_tr: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          error_message: string
          exception_type_code: string
          id: string
          is_active: boolean
          posting_log_id: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          source_doc_id: string
          source_doc_type_code: string
          status_code: string
          tenant_org_id: string
          txn_event_code: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          error_message: string
          exception_type_code: string
          id?: string
          is_active?: boolean
          posting_log_id: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_doc_id: string
          source_doc_type_code: string
          status_code?: string
          tenant_org_id: string
          txn_event_code: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          error_message?: string
          exception_type_code?: string
          id?: string
          is_active?: boolean
          posting_log_id?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_doc_id?: string
          source_doc_type_code?: string
          status_code?: string
          tenant_org_id?: string
          txn_event_code?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofpe_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpe_evt"
            columns: ["txn_event_code"]
            isOneToOne: false
            referencedRelation: "sys_fin_evt_cd"
            referencedColumns: ["evt_code"]
          },
          {
            foreignKeyName: "fk_ofpe_log"
            columns: ["posting_log_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_post_log_tr"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpe_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofpe_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpe_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_post_log_tr: {
        Row: {
          attempt_no: number
          attempt_status_code: string
          branch_id: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          error_code: string | null
          error_message: string | null
          execute_result_json: Json | null
          id: string
          idempotency_key: string
          is_active: boolean
          journal_id: string | null
          log_status_code: string
          mapping_rule_id: string | null
          mapping_rule_version_no: number | null
          preview_result_json: Json | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          repost_of_log_id: string | null
          request_payload_json: Json
          resolved_payload_json: Json | null
          retry_of_log_id: string | null
          source_doc_id: string
          source_doc_no: string | null
          source_doc_type_code: string
          source_module_code: string
          tenant_org_id: string
          txn_event_code: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          attempt_no?: number
          attempt_status_code?: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          error_code?: string | null
          error_message?: string | null
          execute_result_json?: Json | null
          id?: string
          idempotency_key: string
          is_active?: boolean
          journal_id?: string | null
          log_status_code?: string
          mapping_rule_id?: string | null
          mapping_rule_version_no?: number | null
          preview_result_json?: Json | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          repost_of_log_id?: string | null
          request_payload_json?: Json
          resolved_payload_json?: Json | null
          retry_of_log_id?: string | null
          source_doc_id: string
          source_doc_no?: string | null
          source_doc_type_code: string
          source_module_code: string
          tenant_org_id: string
          txn_event_code: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          attempt_no?: number
          attempt_status_code?: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          error_code?: string | null
          error_message?: string | null
          execute_result_json?: Json | null
          id?: string
          idempotency_key?: string
          is_active?: boolean
          journal_id?: string | null
          log_status_code?: string
          mapping_rule_id?: string | null
          mapping_rule_version_no?: number | null
          preview_result_json?: Json | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          repost_of_log_id?: string | null
          request_payload_json?: Json
          resolved_payload_json?: Json | null
          retry_of_log_id?: string | null
          source_doc_id?: string
          source_doc_no?: string | null
          source_doc_type_code?: string
          source_module_code?: string
          tenant_org_id?: string
          txn_event_code?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofpl_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpl_evt"
            columns: ["txn_event_code"]
            isOneToOne: false
            referencedRelation: "sys_fin_evt_cd"
            referencedColumns: ["evt_code"]
          },
          {
            foreignKeyName: "fk_ofpl_jrnl"
            columns: ["journal_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_journal_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpl_repost"
            columns: ["repost_of_log_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_post_log_tr"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpl_retry"
            columns: ["retry_of_log_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_post_log_tr"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpl_rule"
            columns: ["mapping_rule_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_map_rule_mst"
            referencedColumns: ["rule_id"]
          },
          {
            foreignKeyName: "fk_ofpl_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofpl_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpl_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_post_snapshot_tr: {
        Row: {
          actor_type: string | null
          actor_user_id: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          gov_pkg_code: string | null
          gov_pkg_id: string | null
          gov_pkg_version: number | null
          gov_policy_id: string | null
          gov_policy_version: number | null
          gov_rule_code: string | null
          gov_rule_id: string | null
          gov_rule_version: number | null
          id: string
          is_active: boolean
          journal_header_json: Json
          journal_id: string | null
          journal_lines_json: Json
          normalized_request_json: Json
          posting_log_id: string
          rec_status: number
          resolved_accounts_json: Json
          resolved_lines_json: Json
          resolved_mappings_json: Json
          resolved_rule_json: Json
          source_doc_id: string | null
          source_doc_type_code: string | null
          source_module_code: string | null
          tenant_org_id: string
          txn_event_code: string | null
        }
        Insert: {
          actor_type?: string | null
          actor_user_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          gov_pkg_code?: string | null
          gov_pkg_id?: string | null
          gov_pkg_version?: number | null
          gov_policy_id?: string | null
          gov_policy_version?: number | null
          gov_rule_code?: string | null
          gov_rule_id?: string | null
          gov_rule_version?: number | null
          id?: string
          is_active?: boolean
          journal_header_json?: Json
          journal_id?: string | null
          journal_lines_json?: Json
          normalized_request_json?: Json
          posting_log_id: string
          rec_status?: number
          resolved_accounts_json?: Json
          resolved_lines_json?: Json
          resolved_mappings_json?: Json
          resolved_rule_json?: Json
          source_doc_id?: string | null
          source_doc_type_code?: string | null
          source_module_code?: string | null
          tenant_org_id: string
          txn_event_code?: string | null
        }
        Update: {
          actor_type?: string | null
          actor_user_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          gov_pkg_code?: string | null
          gov_pkg_id?: string | null
          gov_pkg_version?: number | null
          gov_policy_id?: string | null
          gov_policy_version?: number | null
          gov_rule_code?: string | null
          gov_rule_id?: string | null
          gov_rule_version?: number | null
          id?: string
          is_active?: boolean
          journal_header_json?: Json
          journal_id?: string | null
          journal_lines_json?: Json
          normalized_request_json?: Json
          posting_log_id?: string
          rec_status?: number
          resolved_accounts_json?: Json
          resolved_lines_json?: Json
          resolved_mappings_json?: Json
          resolved_rule_json?: Json
          source_doc_id?: string | null
          source_doc_type_code?: string | null
          source_module_code?: string | null
          tenant_org_id?: string
          txn_event_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofps_jrnl"
            columns: ["journal_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_journal_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofps_log"
            columns: ["posting_log_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_post_log_tr"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofps_pkg"
            columns: ["gov_pkg_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_gov_pkg_mst"
            referencedColumns: ["pkg_id"]
          },
          {
            foreignKeyName: "fk_ofps_rule"
            columns: ["gov_rule_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_map_rule_mst"
            referencedColumns: ["rule_id"]
          },
          {
            foreignKeyName: "fk_ofps_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofps_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofps_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_supp_ctc_dtl: {
        Row: {
          created_at: string
          created_by: string | null
          created_info: string | null
          email: string | null
          id: string
          is_active: boolean
          is_primary: boolean
          line_no: number
          name: string
          name2: string | null
          phone: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          role_name: string | null
          supplier_id: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          line_no: number
          name: string
          name2?: string | null
          phone?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          role_name?: string | null
          supplier_id: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          line_no?: number
          name?: string
          name2?: string | null
          phone?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          role_name?: string | null
          supplier_id?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofsc_supp"
            columns: ["supplier_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_supp_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofsc_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofsc_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofsc_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_supp_mst: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          currency_code: string
          default_usage_id: string | null
          description: string | null
          description2: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          name2: string | null
          payable_acct_id: string | null
          payment_terms_days: number
          phone: string | null
          posting_hold: boolean
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          status_code: string
          supplier_code: string
          tax_reg_no: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code: string
          default_usage_id?: string | null
          description?: string | null
          description2?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          name2?: string | null
          payable_acct_id?: string | null
          payment_terms_days?: number
          phone?: string | null
          posting_hold?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          supplier_code: string
          tax_reg_no?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code?: string
          default_usage_id?: string | null
          description?: string | null
          description2?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name2?: string | null
          payable_acct_id?: string | null
          payment_terms_days?: number
          phone?: string | null
          posting_hold?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          supplier_code?: string
          tax_reg_no?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofs_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofs_pay"
            columns: ["payable_acct_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_acct_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofs_pay"
            columns: ["payable_acct_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_coa_explorer"
            referencedColumns: ["account_id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofs_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofs_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofs_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofs_usage"
            columns: ["default_usage_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_usage_code_cd"
            referencedColumns: ["usage_code_id"]
          },
          {
            foreignKeyName: "fk_ofs_usage"
            columns: ["default_usage_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["usage_code_id"]
          },
        ]
      }
      org_fin_tpl_apply_log: {
        Row: {
          applied_at: string
          applied_by: string | null
          apply_mode_code: string
          apply_result_code: string
          created_at: string
          created_by: string | null
          created_info: string | null
          id: string
          is_active: boolean
          notes: string | null
          notes2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          tenant_org_id: string
          tpl_pkg_code: string | null
          tpl_pkg_id: string | null
          tpl_pkg_version: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          applied_at?: string
          applied_by?: string | null
          apply_mode_code: string
          apply_result_code: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          notes2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          tenant_org_id: string
          tpl_pkg_code?: string | null
          tpl_pkg_id?: string | null
          tpl_pkg_version?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          applied_at?: string
          applied_by?: string | null
          apply_mode_code?: string
          apply_result_code?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          notes2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          tenant_org_id?: string
          tpl_pkg_code?: string | null
          tpl_pkg_id?: string | null
          tpl_pkg_version?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_oftal_pkg"
            columns: ["tpl_pkg_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_tpl_pkg_mst"
            referencedColumns: ["tpl_pkg_id"]
          },
          {
            foreignKeyName: "fk_oftal_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_oftal_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_oftal_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_fin_tpl_mat_tr: {
        Row: {
          action_code: string
          apply_log_id: string
          change_summary: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          error_message: string | null
          id: string
          is_active: boolean
          object_id: string
          object_snapshot_json: Json | null
          object_type: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          source_tpl_line_id: string | null
          source_tpl_pkg_id: string | null
          tenant_org_id: string
        }
        Insert: {
          action_code?: string
          apply_log_id: string
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          error_message?: string | null
          id?: string
          is_active?: boolean
          object_id: string
          object_snapshot_json?: Json | null
          object_type: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          source_tpl_line_id?: string | null
          source_tpl_pkg_id?: string | null
          tenant_org_id: string
        }
        Update: {
          action_code?: string
          apply_log_id?: string
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          error_message?: string | null
          id?: string
          is_active?: boolean
          object_id?: string
          object_snapshot_json?: Json | null
          object_type?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          source_tpl_line_id?: string | null
          source_tpl_pkg_id?: string | null
          tenant_org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_oftm_apply_log"
            columns: ["apply_log_id"]
            isOneToOne: false
            referencedRelation: "org_fin_tpl_apply_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_oftm_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_oftm_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_oftm_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_oftm_tpl_pkg"
            columns: ["source_tpl_pkg_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_tpl_pkg_mst"
            referencedColumns: ["tpl_pkg_id"]
          },
        ]
      }
      org_fin_usage_map_mst: {
        Row: {
          account_id: string
          branch_id: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          is_active: boolean
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          status_code: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          usage_code_id: string
        }
        Insert: {
          account_id: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          usage_code_id: string
        }
        Update: {
          account_id?: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          usage_code_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofum_acct"
            columns: ["account_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_acct_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofum_acct"
            columns: ["account_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_coa_explorer"
            referencedColumns: ["account_id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofum_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofum_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofum_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofum_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofum_usage"
            columns: ["usage_code_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_usage_code_cd"
            referencedColumns: ["usage_code_id"]
          },
          {
            foreignKeyName: "fk_ofum_usage"
            columns: ["usage_code_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["usage_code_id"]
          },
        ]
      }
      org_fin_voucher_audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          snapshot_or_reason: string | null
          tenant_org_id: string
          voucher_id: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          snapshot_or_reason?: string | null
          tenant_org_id: string
          voucher_id: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          snapshot_or_reason?: string | null
          tenant_org_id?: string
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_fin_voucher_audit_voucher"
            columns: ["voucher_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_vouchers_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
        ]
      }
      org_fin_vouchers_mst: {
        Row: {
          branch_id: string | null
          content_html: string | null
          content_text: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          currency_code: string | null
          customer_id: string | null
          id: string
          invoice_id: string | null
          is_active: boolean
          issued_at: string | null
          metadata: Json | null
          order_id: string | null
          reason_code: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          reversed_by_voucher_id: string | null
          status: string
          tenant_org_id: string
          total_amount: number
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          void_reason: string | null
          voided_at: string | null
          voucher_category: string
          voucher_no: string
          voucher_subtype: string | null
          voucher_type: string | null
        }
        Insert: {
          branch_id?: string | null
          content_html?: string | null
          content_text?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code?: string | null
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          is_active?: boolean
          issued_at?: string | null
          metadata?: Json | null
          order_id?: string | null
          reason_code?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          reversed_by_voucher_id?: string | null
          status?: string
          tenant_org_id: string
          total_amount: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voucher_category: string
          voucher_no: string
          voucher_subtype?: string | null
          voucher_type?: string | null
        }
        Update: {
          branch_id?: string | null
          content_html?: string | null
          content_text?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code?: string | null
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          is_active?: boolean
          issued_at?: string | null
          metadata?: Json | null
          order_id?: string | null
          reason_code?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          reversed_by_voucher_id?: string | null
          status?: string
          tenant_org_id?: string
          total_amount?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voucher_category?: string
          voucher_no?: string
          voucher_subtype?: string | null
          voucher_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_fin_voucher_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_fin_voucher_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "org_customers_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fin_voucher_invoice"
            columns: ["invoice_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_invoice_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_fin_voucher_order"
            columns: ["order_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_fin_voucher_reversed"
            columns: ["reversed_by_voucher_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_vouchers_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_fin_voucher_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fin_voucher_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_fin_voucher_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_gift_card_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          gift_card_id: string
          id: string
          invoice_id: string | null
          metadata: Json | null
          notes: string | null
          order_id: string | null
          processed_by: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          tenant_org_id: string
          transaction_date: string
          transaction_type: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          gift_card_id: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          notes?: string | null
          order_id?: string | null
          processed_by?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id: string
          transaction_date?: string
          transaction_type: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          gift_card_id?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          notes?: string | null
          order_id?: string | null
          processed_by?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id?: string
          transaction_date?: string
          transaction_type?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_org_gift_card_trans_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
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
          {
            foreignKeyName: "org_gift_card_trans_tenant_fk"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_gift_card_trans_tenant_fk"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
          {
            foreignKeyName: "org_gift_cards_tenant_fk"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_gift_cards_tenant_fk"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_inv_stock_by_branch: {
        Row: {
          branch_id: string
          created_at: string | null
          created_by: string | null
          id_sku: string | null
          last_purchase_cost: number | null
          max_stock_level: number | null
          min_stock_level: number | null
          product_id: string
          qty_on_hand: number | null
          reorder_point: number | null
          storage_location: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          created_by?: string | null
          id_sku?: string | null
          last_purchase_cost?: number | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          product_id: string
          qty_on_hand?: number | null
          reorder_point?: number | null
          storage_location?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          created_by?: string | null
          id_sku?: string | null
          last_purchase_cost?: number | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          product_id?: string
          qty_on_hand?: number | null
          reorder_point?: number | null
          storage_location?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_inv_stock_branch_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_inv_stock_branch_product"
            columns: ["product_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_product_data_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_inv_stock_branch_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_inv_stock_branch_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_inv_stock_branch_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_inv_stock_tr: {
        Row: {
          branch_id: string
          created_at: string | null
          created_by: string | null
          created_info: string | null
          id: string
          is_active: boolean
          notes: string | null
          processed_by: string | null
          product_id: string
          qty_after: number | null
          qty_before: number | null
          quantity: number
          reason: string | null
          rec_status: number | null
          reference_id: string | null
          reference_no: string | null
          reference_type: string | null
          tenant_org_id: string
          total_cost: number | null
          transaction_date: string
          transaction_no: string | null
          transaction_type: string
          unit_cost: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          processed_by?: string | null
          product_id: string
          qty_after?: number | null
          qty_before?: number | null
          quantity: number
          reason?: string | null
          rec_status?: number | null
          reference_id?: string | null
          reference_no?: string | null
          reference_type?: string | null
          tenant_org_id: string
          total_cost?: number | null
          transaction_date?: string
          transaction_no?: string | null
          transaction_type: string
          unit_cost?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          processed_by?: string | null
          product_id?: string
          qty_after?: number | null
          qty_before?: number | null
          quantity?: number
          reason?: string | null
          rec_status?: number | null
          reference_id?: string | null
          reference_no?: string | null
          reference_type?: string | null
          tenant_org_id?: string
          total_cost?: number | null
          transaction_date?: string
          transaction_no?: string | null
          transaction_type?: string
          unit_cost?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_inv_stock_product"
            columns: ["product_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_product_data_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_inv_stock_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_inv_stock_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_inv_stock_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_inv_stock_tr_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
        ]
      }
      org_invoice_mst: {
        Row: {
          b2b_contract_id: string | null
          branch_id: string | null
          cost_center_code: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          currency_code: string | null
          currency_ex_rate: number
          customer_id: string | null
          customer_reference: string | null
          discount: number | null
          discount_rate: number | null
          discount_type: string | null
          due_date: string | null
          gift_card_discount_amount: number | null
          gift_card_id: string | null
          handed_to_by_user: string | null
          handed_to_date: string | null
          handed_to_mobile_no: string | null
          handed_to_name: string | null
          id: string
          invoice_date: string | null
          invoice_no: string
          invoice_type_cd: string | null
          is_active: boolean | null
          metadata: Json | null
          order_id: string | null
          paid_amount: number | null
          paid_at: string | null
          paid_by: string | null
          paid_by_name: string | null
          payment_method_code: string | null
          payment_terms: string | null
          po_number: string | null
          promo_code_id: string | null
          promo_discount_amount: number | null
          rec_notes: string | null
          rec_status: number | null
          service_charge: number | null
          service_charge_type: string | null
          statement_id: string | null
          status: string | null
          subtotal: number | null
          tax: number | null
          tax_rate: number | null
          tenant_org_id: string
          total: number | null
          trans_desc: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          b2b_contract_id?: string | null
          branch_id?: string | null
          cost_center_code?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code?: string | null
          currency_ex_rate?: number
          customer_id?: string | null
          customer_reference?: string | null
          discount?: number | null
          discount_rate?: number | null
          discount_type?: string | null
          due_date?: string | null
          gift_card_discount_amount?: number | null
          gift_card_id?: string | null
          handed_to_by_user?: string | null
          handed_to_date?: string | null
          handed_to_mobile_no?: string | null
          handed_to_name?: string | null
          id?: string
          invoice_date?: string | null
          invoice_no: string
          invoice_type_cd?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          order_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_by?: string | null
          paid_by_name?: string | null
          payment_method_code?: string | null
          payment_terms?: string | null
          po_number?: string | null
          promo_code_id?: string | null
          promo_discount_amount?: number | null
          rec_notes?: string | null
          rec_status?: number | null
          service_charge?: number | null
          service_charge_type?: string | null
          statement_id?: string | null
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          tax_rate?: number | null
          tenant_org_id: string
          total?: number | null
          trans_desc?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          b2b_contract_id?: string | null
          branch_id?: string | null
          cost_center_code?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code?: string | null
          currency_ex_rate?: number
          customer_id?: string | null
          customer_reference?: string | null
          discount?: number | null
          discount_rate?: number | null
          discount_type?: string | null
          due_date?: string | null
          gift_card_discount_amount?: number | null
          gift_card_id?: string | null
          handed_to_by_user?: string | null
          handed_to_date?: string | null
          handed_to_mobile_no?: string | null
          handed_to_name?: string | null
          id?: string
          invoice_date?: string | null
          invoice_no?: string
          invoice_type_cd?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          order_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_by?: string | null
          paid_by_name?: string | null
          payment_method_code?: string | null
          payment_terms?: string | null
          po_number?: string | null
          promo_code_id?: string | null
          promo_discount_amount?: number | null
          rec_notes?: string | null
          rec_status?: number | null
          service_charge?: number | null
          service_charge_type?: string | null
          statement_id?: string | null
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          tax_rate?: number | null
          tenant_org_id?: string
          total?: number | null
          trans_desc?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoice_b2b_contract"
            columns: ["b2b_contract_id"]
            isOneToOne: false
            referencedRelation: "org_b2b_contracts_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_b2b_statement"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "org_b2b_statements_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_promo_code"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "org_promo_codes_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_org_invoice_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_org_invoice_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "org_customers_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_org_invoice_gift_card"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "org_gift_cards_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_org_invoice_handed_to_user"
            columns: ["handed_to_by_user"]
            isOneToOne: false
            referencedRelation: "org_users_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_org_invoice_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_org_invoice_payment_method"
            columns: ["payment_method_code"]
            isOneToOne: false
            referencedRelation: "sys_payment_method_cd"
            referencedColumns: ["payment_method_code"]
          },
          {
            foreignKeyName: "fk_org_invoice_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_org_invoice_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_org_invoice_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_ord_custom_validations_cf: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          screen_key: string
          tenant_org_id: string | null
          updated_at: string | null
          updated_by: string | null
          validation_config: Json | null
          validation_function: string | null
          validation_key: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          screen_key: string
          tenant_org_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          validation_config?: Json | null
          validation_function?: string | null
          validation_key: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          screen_key?: string
          tenant_org_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          validation_config?: Json | null
          validation_function?: string | null
          validation_key?: string
        }
        Relationships: []
      }
      org_ord_screen_contracts_cf: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          pre_conditions: Json
          required_permissions: Json
          screen_key: string
          tenant_org_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          pre_conditions: Json
          required_permissions: Json
          screen_key: string
          tenant_org_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          pre_conditions?: Json
          required_permissions?: Json
          screen_key?: string
          tenant_org_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      org_ord_transition_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          from_status: string | null
          id: string
          order_id: string
          screen: string
          tenant_org_id: string
          to_status: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          from_status?: string | null
          id?: string
          order_id: string
          screen: string
          tenant_org_id: string
          to_status?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          from_status?: string | null
          id?: string
          order_id?: string
          screen?: string
          tenant_org_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_transition_events_order"
            columns: ["order_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
        ]
      }
      org_ord_webhook_subscriptions_cf: {
        Row: {
          created_at: string | null
          created_by: string | null
          event_type: string
          id: string
          is_active: boolean | null
          retry_count: number | null
          screen_key: string | null
          tenant_org_id: string | null
          timeout_seconds: number | null
          updated_at: string | null
          updated_by: string | null
          webhook_secret: string | null
          webhook_url: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          event_type: string
          id?: string
          is_active?: boolean | null
          retry_count?: number | null
          screen_key?: string | null
          tenant_org_id?: string | null
          timeout_seconds?: number | null
          updated_at?: string | null
          updated_by?: string | null
          webhook_secret?: string | null
          webhook_url: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          event_type?: string
          id?: string
          is_active?: boolean | null
          retry_count?: number | null
          screen_key?: string | null
          tenant_org_id?: string | null
          timeout_seconds?: number | null
          updated_at?: string | null
          updated_by?: string | null
          webhook_secret?: string | null
          webhook_url?: string
        }
        Relationships: []
      }
      org_order_edit_history: {
        Row: {
          change_summary: string | null
          changes: Json
          edit_number: number
          edited_at: string
          edited_by: string
          edited_by_name: string | null
          id: string
          ip_address: string | null
          order_id: string
          order_no: string | null
          payment_adjusted: boolean | null
          payment_adjustment_amount: number | null
          payment_adjustment_type: string | null
          snapshot_after: Json
          snapshot_before: Json
          tenant_org_id: string
          user_agent: string | null
        }
        Insert: {
          change_summary?: string | null
          changes: Json
          edit_number: number
          edited_at?: string
          edited_by: string
          edited_by_name?: string | null
          id?: string
          ip_address?: string | null
          order_id: string
          order_no?: string | null
          payment_adjusted?: boolean | null
          payment_adjustment_amount?: number | null
          payment_adjustment_type?: string | null
          snapshot_after: Json
          snapshot_before: Json
          tenant_org_id: string
          user_agent?: string | null
        }
        Update: {
          change_summary?: string | null
          changes?: Json
          edit_number?: number
          edited_at?: string
          edited_by?: string
          edited_by_name?: string | null
          id?: string
          ip_address?: string | null
          order_id?: string
          order_no?: string | null
          payment_adjusted?: boolean | null
          payment_adjustment_amount?: number | null
          payment_adjustment_type?: string | null
          snapshot_after?: Json
          snapshot_before?: Json
          tenant_org_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_order_edit_history_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_order_edit_history_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_order_edit_history_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_order_edit_history_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_order_edit_history_user"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "admin_locked_accounts"
            referencedColumns: ["user_id"]
          },
        ]
      }
      org_order_edit_locks: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          expires_at: string
          ip_address: string | null
          locked_at: string
          locked_by: string
          locked_by_name: string | null
          order_id: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          session_id: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          expires_at: string
          ip_address?: string | null
          locked_at?: string
          locked_by: string
          locked_by_name?: string | null
          order_id: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          session_id?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          expires_at?: string
          ip_address?: string | null
          locked_at?: string
          locked_by?: string
          locked_by_name?: string | null
          order_id?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          session_id?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_order_edit_lock_order"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_order_edit_lock_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_order_edit_lock_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_order_edit_lock_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_order_edit_lock_user"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "admin_locked_accounts"
            referencedColumns: ["user_id"]
          },
        ]
      }
      org_order_history: {
        Row: {
          action_type: string
          created_at: string | null
          created_by: string | null
          created_info: string | null
          done_at: string | null
          done_by: string | null
          from_value: string | null
          id: string
          order_id: string
          payload: Json | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          tenant_org_id: string
          to_value: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          done_at?: string | null
          done_by?: string | null
          from_value?: string | null
          id?: string
          order_id: string
          payload?: Json | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id: string
          to_value?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          done_at?: string | null
          done_by?: string | null
          from_value?: string | null
          id?: string
          order_id?: string
          payload?: Json | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id?: string
          to_value?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
            foreignKeyName: "fk_history_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_history_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
          created_info: string | null
          id: string
          issue_code: string
          issue_text: string
          metadata: Json | null
          order_id: string
          order_item_id: string
          photo_url: string | null
          priority: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          solved_at: string | null
          solved_by: string | null
          solved_notes: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          issue_code: string
          issue_text: string
          metadata?: Json | null
          order_id: string
          order_item_id: string
          photo_url?: string | null
          priority?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          solved_at?: string | null
          solved_by?: string | null
          solved_notes?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          issue_code?: string
          issue_text?: string
          metadata?: Json | null
          order_id?: string
          order_item_id?: string
          photo_url?: string | null
          priority?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          solved_at?: string | null
          solved_by?: string | null
          solved_notes?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          {
            foreignKeyName: "fk_issue_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_issue_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_order_item_pieces_dtl: {
        Row: {
          barcode: string | null
          branch_id: string | null
          brand: string | null
          color: Json | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          has_damage: boolean | null
          has_stain: boolean | null
          id: string
          is_ready: boolean
          is_rejected: boolean | null
          issue_id: string | null
          last_step: string | null
          last_step_at: string | null
          last_step_by: string | null
          metadata: Json | null
          notes: string | null
          order_id: string
          order_item_id: string
          packing_pref_code: string | null
          piece_code: string | null
          piece_seq: number
          piece_stage: string | null
          piece_status: string | null
          price_per_unit: number
          product_id: string | null
          quantity: number | null
          rack_location: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          scan_state: string | null
          service_category_code: string | null
          service_pref_charge: number | null
          tenant_org_id: string
          total_price: number
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          barcode?: string | null
          branch_id?: string | null
          brand?: string | null
          color?: Json | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          has_damage?: boolean | null
          has_stain?: boolean | null
          id?: string
          is_ready?: boolean
          is_rejected?: boolean | null
          issue_id?: string | null
          last_step?: string | null
          last_step_at?: string | null
          last_step_by?: string | null
          metadata?: Json | null
          notes?: string | null
          order_id: string
          order_item_id: string
          packing_pref_code?: string | null
          piece_code?: string | null
          piece_seq: number
          piece_stage?: string | null
          piece_status?: string | null
          price_per_unit: number
          product_id?: string | null
          quantity?: number | null
          rack_location?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          scan_state?: string | null
          service_category_code?: string | null
          service_pref_charge?: number | null
          tenant_org_id: string
          total_price: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          barcode?: string | null
          branch_id?: string | null
          brand?: string | null
          color?: Json | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          has_damage?: boolean | null
          has_stain?: boolean | null
          id?: string
          is_ready?: boolean
          is_rejected?: boolean | null
          issue_id?: string | null
          last_step?: string | null
          last_step_at?: string | null
          last_step_by?: string | null
          metadata?: Json | null
          notes?: string | null
          order_id?: string
          order_item_id?: string
          packing_pref_code?: string | null
          piece_code?: string | null
          piece_seq?: number
          piece_stage?: string | null
          piece_status?: string | null
          price_per_unit?: number
          product_id?: string | null
          quantity?: number | null
          rack_location?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          scan_state?: string | null
          service_category_code?: string | null
          service_pref_charge?: number | null
          tenant_org_id?: string
          total_price?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ord_pieces_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_org_orde_reference_org_orde"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "org_order_items_dtl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_org_pieces_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_org_pieces_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "org_product_data_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_org_pieces_service_category"
            columns: ["tenant_org_id", "service_category_code"]
            isOneToOne: false
            referencedRelation: "org_service_category_cf"
            referencedColumns: ["tenant_org_id", "service_category_code"]
          },
          {
            foreignKeyName: "fk_org_pieces_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_org_pieces_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_org_pieces_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_order_item_pieces_dtl_packing_pref_code_fkey"
            columns: ["packing_pref_code"]
            isOneToOne: false
            referencedRelation: "sys_packing_preference_cd"
            referencedColumns: ["code"]
          },
        ]
      }
      org_order_item_processing_steps: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          done_at: string | null
          done_by: string | null
          id: string
          metadata: Json | null
          notes: string | null
          order_id: string
          order_item_id: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          step_code: string
          step_seq: number
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          done_at?: string | null
          done_by?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          order_id: string
          order_item_id: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          step_code: string
          step_seq: number
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          done_at?: string | null
          done_by?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          order_id?: string
          order_item_id?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          step_code?: string
          step_seq?: number
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ord_proc_steps_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
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
          {
            foreignKeyName: "fk_step_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_step_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_order_items_dtl: {
        Row: {
          barcode: string | null
          branch_id: string | null
          brand: string | null
          color: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
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
          override_by: string | null
          override_reason: string | null
          packing_pref_code: string | null
          packing_pref_is_override: boolean | null
          packing_pref_source: string | null
          price_override: number | null
          price_per_unit: number
          product_id: string | null
          product_name: string | null
          product_name2: string | null
          quantity: number | null
          quantity_ready: number | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          service_category_code: string | null
          service_pref_charge: number | null
          stain_notes: string | null
          status: string | null
          tenant_org_id: string
          total_price: number
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          barcode?: string | null
          branch_id?: string | null
          brand?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          override_by?: string | null
          override_reason?: string | null
          packing_pref_code?: string | null
          packing_pref_is_override?: boolean | null
          packing_pref_source?: string | null
          price_override?: number | null
          price_per_unit: number
          product_id?: string | null
          product_name?: string | null
          product_name2?: string | null
          quantity?: number | null
          quantity_ready?: number | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          service_category_code?: string | null
          service_pref_charge?: number | null
          stain_notes?: string | null
          status?: string | null
          tenant_org_id: string
          total_price: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          barcode?: string | null
          branch_id?: string | null
          brand?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          override_by?: string | null
          override_reason?: string | null
          packing_pref_code?: string | null
          packing_pref_is_override?: boolean | null
          packing_pref_source?: string | null
          price_override?: number | null
          price_per_unit?: number
          product_id?: string | null
          product_name?: string | null
          product_name2?: string | null
          quantity?: number | null
          quantity_ready?: number | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          service_category_code?: string | null
          service_pref_charge?: number | null
          stain_notes?: string | null
          status?: string | null
          tenant_org_id?: string
          total_price?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ord_items_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
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
          {
            foreignKeyName: "org_order_items_dtl_override_by_fkey"
            columns: ["override_by"]
            isOneToOne: false
            referencedRelation: "org_users_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_order_items_dtl_packing_pref_code_fkey"
            columns: ["packing_pref_code"]
            isOneToOne: false
            referencedRelation: "sys_packing_preference_cd"
            referencedColumns: ["code"]
          },
        ]
      }
      org_order_preferences_dtl: {
        Row: {
          branch_id: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          created_by: string | null
          extra_price: number | null
          id: string
          order_id: string
          order_item_id: string | null
          order_item_piece_id: string | null
          preference_category: string | null
          preference_code: string
          preference_id: string | null
          preference_sys_kind: string | null
          prefs_level: string
          prefs_no: number
          prefs_owner_type: string
          prefs_source: string
          processing_confirmed: boolean | null
          rec_status: number | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          extra_price?: number | null
          id?: string
          order_id: string
          order_item_id?: string | null
          order_item_piece_id?: string | null
          preference_category?: string | null
          preference_code: string
          preference_id?: string | null
          preference_sys_kind?: string | null
          prefs_level: string
          prefs_no: number
          prefs_owner_type?: string
          prefs_source?: string
          processing_confirmed?: boolean | null
          rec_status?: number | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          extra_price?: number | null
          id?: string
          order_id?: string
          order_item_id?: string | null
          order_item_piece_id?: string | null
          preference_category?: string | null
          preference_code?: string
          preference_id?: string | null
          preference_sys_kind?: string | null
          prefs_level?: string
          prefs_no?: number
          prefs_owner_type?: string
          prefs_source?: string
          processing_confirmed?: boolean | null
          rec_status?: number | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ord_pref_dtl_kind"
            columns: ["preference_sys_kind"]
            isOneToOne: false
            referencedRelation: "sys_preference_kind_cd"
            referencedColumns: ["kind_code"]
          },
          {
            foreignKeyName: "org_order_preferences_dtl_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_order_preferences_dtl_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "org_order_items_dtl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_order_preferences_dtl_order_item_piece_id_fkey"
            columns: ["order_item_piece_id"]
            isOneToOne: false
            referencedRelation: "org_order_item_pieces_dtl"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_order_preferences_dtl_preference_id_fkey"
            columns: ["preference_id"]
            isOneToOne: false
            referencedRelation: "org_service_preference_cf"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_order_preferences_dtl_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_order_preferences_dtl_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_order_preferences_dtl_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_order_status_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          changed_by_name: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          from_status: string | null
          id: string
          metadata: Json | null
          notes: string | null
          order_id: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          tenant_org_id: string
          to_status: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          order_id: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id: string
          to_status: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          order_id?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id?: string
          to_status?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
            foreignKeyName: "fk_status_history_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_status_history_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
          b2b_contract_id: string | null
          bag_count: number | null
          barcode: string | null
          branch_id: string | null
          cancellation_reason_code: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_note: string | null
          cost_center_code: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          credit_limit_override_at: string | null
          credit_limit_override_by: string | null
          currency_code: string | null
          currency_ex_rate: number
          current_stage: string | null
          current_status: string | null
          customer_details: Json | null
          customer_email: string | null
          customer_id: string
          customer_mobile_number: string | null
          customer_name: string | null
          customer_notes: string | null
          delivered_at: string | null
          discount: number | null
          discount_rate: number | null
          discount_type: string | null
          gift_card_discount_amount: number | null
          gift_card_id: string | null
          has_issue: boolean | null
          has_split: boolean | null
          id: string
          internal_notes: string | null
          is_default_customer: boolean | null
          is_order_quick_drop: boolean | null
          is_rejected: boolean | null
          is_retail: boolean
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
          payment_due_date: string | null
          payment_method_code: string | null
          payment_notes: string | null
          payment_status: string | null
          payment_terms: string | null
          payment_type_code: string | null
          photo_urls: Json | null
          po_number: string | null
          preparation_status: string | null
          prepared_at: string | null
          prepared_by: string | null
          priority: string | null
          priority_multiplier: number | null
          promo_code_id: string | null
          promo_discount_amount: number | null
          qr_code: string | null
          quick_drop_quantity: number | null
          rack_location: string | null
          ready_at: string | null
          ready_by: string | null
          ready_by_at_new: string | null
          ready_by_override: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          received_at: string | null
          rejected_from_stage: string | null
          return_reason: string | null
          return_reason_code: string | null
          returned_at: string | null
          returned_by: string | null
          service_category_code: string | null
          service_charge: number | null
          service_charge_type: string | null
          status: string | null
          subtotal: number | null
          tax: number | null
          tax_rate: number | null
          tenant_org_id: string
          total: number | null
          total_items: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          vat_amount: number | null
          vat_rate: number | null
          workflow_template_id: string | null
        }
        Insert: {
          b2b_contract_id?: string | null
          bag_count?: number | null
          barcode?: string | null
          branch_id?: string | null
          cancellation_reason_code?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_note?: string | null
          cost_center_code?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          credit_limit_override_at?: string | null
          credit_limit_override_by?: string | null
          currency_code?: string | null
          currency_ex_rate?: number
          current_stage?: string | null
          current_status?: string | null
          customer_details?: Json | null
          customer_email?: string | null
          customer_id: string
          customer_mobile_number?: string | null
          customer_name?: string | null
          customer_notes?: string | null
          delivered_at?: string | null
          discount?: number | null
          discount_rate?: number | null
          discount_type?: string | null
          gift_card_discount_amount?: number | null
          gift_card_id?: string | null
          has_issue?: boolean | null
          has_split?: boolean | null
          id?: string
          internal_notes?: string | null
          is_default_customer?: boolean | null
          is_order_quick_drop?: boolean | null
          is_rejected?: boolean | null
          is_retail?: boolean
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
          payment_due_date?: string | null
          payment_method_code?: string | null
          payment_notes?: string | null
          payment_status?: string | null
          payment_terms?: string | null
          payment_type_code?: string | null
          photo_urls?: Json | null
          po_number?: string | null
          preparation_status?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          priority?: string | null
          priority_multiplier?: number | null
          promo_code_id?: string | null
          promo_discount_amount?: number | null
          qr_code?: string | null
          quick_drop_quantity?: number | null
          rack_location?: string | null
          ready_at?: string | null
          ready_by?: string | null
          ready_by_at_new?: string | null
          ready_by_override?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          received_at?: string | null
          rejected_from_stage?: string | null
          return_reason?: string | null
          return_reason_code?: string | null
          returned_at?: string | null
          returned_by?: string | null
          service_category_code?: string | null
          service_charge?: number | null
          service_charge_type?: string | null
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          tax_rate?: number | null
          tenant_org_id: string
          total?: number | null
          total_items?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
          workflow_template_id?: string | null
        }
        Update: {
          b2b_contract_id?: string | null
          bag_count?: number | null
          barcode?: string | null
          branch_id?: string | null
          cancellation_reason_code?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_note?: string | null
          cost_center_code?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          credit_limit_override_at?: string | null
          credit_limit_override_by?: string | null
          currency_code?: string | null
          currency_ex_rate?: number
          current_stage?: string | null
          current_status?: string | null
          customer_details?: Json | null
          customer_email?: string | null
          customer_id?: string
          customer_mobile_number?: string | null
          customer_name?: string | null
          customer_notes?: string | null
          delivered_at?: string | null
          discount?: number | null
          discount_rate?: number | null
          discount_type?: string | null
          gift_card_discount_amount?: number | null
          gift_card_id?: string | null
          has_issue?: boolean | null
          has_split?: boolean | null
          id?: string
          internal_notes?: string | null
          is_default_customer?: boolean | null
          is_order_quick_drop?: boolean | null
          is_rejected?: boolean | null
          is_retail?: boolean
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
          payment_due_date?: string | null
          payment_method_code?: string | null
          payment_notes?: string | null
          payment_status?: string | null
          payment_terms?: string | null
          payment_type_code?: string | null
          photo_urls?: Json | null
          po_number?: string | null
          preparation_status?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          priority?: string | null
          priority_multiplier?: number | null
          promo_code_id?: string | null
          promo_discount_amount?: number | null
          qr_code?: string | null
          quick_drop_quantity?: number | null
          rack_location?: string | null
          ready_at?: string | null
          ready_by?: string | null
          ready_by_at_new?: string | null
          ready_by_override?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          received_at?: string | null
          rejected_from_stage?: string | null
          return_reason?: string | null
          return_reason_code?: string | null
          returned_at?: string | null
          returned_by?: string | null
          service_category_code?: string | null
          service_charge?: number | null
          service_charge_type?: string | null
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          tax_rate?: number | null
          tenant_org_id?: string
          total?: number | null
          total_items?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
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
            foreignKeyName: "fk_orders_b2b_contract"
            columns: ["b2b_contract_id"]
            isOneToOne: false
            referencedRelation: "org_b2b_contracts_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_orders_gift_card"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "org_gift_cards_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_orders_payment_type"
            columns: ["payment_type_code"]
            isOneToOne: false
            referencedRelation: "sys_payment_type_cd"
            referencedColumns: ["payment_type_code"]
          },
          {
            foreignKeyName: "fk_orders_promo_code"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "org_promo_codes_mst"
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
            foreignKeyName: "fk_org_order_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_org_order_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_org_order_type"
            columns: ["order_type_id"]
            isOneToOne: false
            referencedRelation: "sys_order_type_cd"
            referencedColumns: ["order_type_id"]
          },
          {
            foreignKeyName: "fk_org_orders_payment_method"
            columns: ["payment_method_code"]
            isOneToOne: false
            referencedRelation: "sys_payment_method_cd"
            referencedColumns: ["payment_method_code"]
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
      org_packing_preference_cf: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          display_order: number | null
          extra_price: number | null
          id: string
          is_active: boolean | null
          is_system_code: boolean | null
          name: string | null
          name2: string | null
          packing_pref_code: string
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
          display_order?: number | null
          extra_price?: number | null
          id?: string
          is_active?: boolean | null
          is_system_code?: boolean | null
          name?: string | null
          name2?: string | null
          packing_pref_code: string
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
          display_order?: number | null
          extra_price?: number | null
          id?: string
          is_active?: boolean | null
          is_system_code?: boolean | null
          name?: string | null
          name2?: string | null
          packing_pref_code?: string
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
            foreignKeyName: "org_packing_preference_cf_packing_pref_code_fkey"
            columns: ["packing_pref_code"]
            isOneToOne: false
            referencedRelation: "sys_packing_preference_cd"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "org_packing_preference_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_packing_preference_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_packing_preference_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_payment_audit_log: {
        Row: {
          action_type: string
          after_value: Json | null
          before_value: Json | null
          changed_at: string | null
          changed_by: string | null
          id: string
          metadata: Json | null
          payment_id: string
          tenant_org_id: string
        }
        Insert: {
          action_type: string
          after_value?: Json | null
          before_value?: Json | null
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          metadata?: Json | null
          payment_id: string
          tenant_org_id: string
        }
        Update: {
          action_type?: string
          after_value?: Json | null
          before_value?: Json | null
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          metadata?: Json | null
          payment_id?: string
          tenant_org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_payment_audit_payment"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "org_payments_dtl_tr"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_payment_audit_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_payment_audit_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_payment_audit_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_payment_reconciliation_log: {
        Row: {
          actual_amount: number
          created_at: string
          created_by: string | null
          expected_amount: number
          id: string
          notes: string | null
          payment_method_code: string
          reconciled_at: string | null
          reconciled_by: string | null
          reconciliation_date: string
          status: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          variance: number | null
        }
        Insert: {
          actual_amount: number
          created_at?: string
          created_by?: string | null
          expected_amount: number
          id?: string
          notes?: string | null
          payment_method_code: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_date: string
          status?: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          variance?: number | null
        }
        Update: {
          actual_amount?: number
          created_at?: string
          created_by?: string | null
          expected_amount?: number
          id?: string
          notes?: string | null
          payment_method_code?: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_date?: string
          status?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "org_payment_reconciliation_log_payment_method_code_fkey"
            columns: ["payment_method_code"]
            isOneToOne: false
            referencedRelation: "sys_payment_method_cd"
            referencedColumns: ["payment_method_code"]
          },
          {
            foreignKeyName: "org_payment_reconciliation_log_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_payment_reconciliation_log_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_payment_reconciliation_log_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_payments_dtl_tr: {
        Row: {
          branch_id: string | null
          check_bank: string | null
          check_date: string | null
          check_number: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          currency_code: string
          currency_ex_rate: number
          customer_id: string | null
          discount_amount: number | null
          discount_rate: number | null
          due_date: string | null
          gateway: string | null
          gift_card_applied_amount: number | null
          gift_card_id: string | null
          id: string
          invoice_id: string | null
          manual_discount_amount: number | null
          metadata: Json | null
          order_id: string | null
          paid_amount: number | null
          paid_at: string | null
          paid_by: string | null
          payment_channel: string | null
          payment_method_code: string
          payment_type_code: string | null
          promo_code_id: string | null
          promo_discount_amount: number | null
          rec_notes: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          tenant_org_id: string
          trans_desc: string | null
          transaction_id: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          vat_amount: number | null
          vat_rate: number | null
          voucher_id: string | null
        }
        Insert: {
          branch_id?: string | null
          check_bank?: string | null
          check_date?: string | null
          check_number?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code: string
          currency_ex_rate?: number
          customer_id?: string | null
          discount_amount?: number | null
          discount_rate?: number | null
          due_date?: string | null
          gateway?: string | null
          gift_card_applied_amount?: number | null
          gift_card_id?: string | null
          id?: string
          invoice_id?: string | null
          manual_discount_amount?: number | null
          metadata?: Json | null
          order_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_by?: string | null
          payment_channel?: string | null
          payment_method_code: string
          payment_type_code?: string | null
          promo_code_id?: string | null
          promo_discount_amount?: number | null
          rec_notes?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tenant_org_id: string
          trans_desc?: string | null
          transaction_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
          voucher_id?: string | null
        }
        Update: {
          branch_id?: string | null
          check_bank?: string | null
          check_date?: string | null
          check_number?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          currency_code?: string
          currency_ex_rate?: number
          customer_id?: string | null
          discount_amount?: number | null
          discount_rate?: number | null
          due_date?: string | null
          gateway?: string | null
          gift_card_applied_amount?: number | null
          gift_card_id?: string | null
          id?: string
          invoice_id?: string | null
          manual_discount_amount?: number | null
          metadata?: Json | null
          order_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_by?: string | null
          payment_channel?: string | null
          payment_method_code?: string
          payment_type_code?: string | null
          promo_code_id?: string | null
          promo_discount_amount?: number | null
          rec_notes?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tenant_org_id?: string
          trans_desc?: string | null
          transaction_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_org_payment_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_org_payment_invoice"
            columns: ["invoice_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_invoice_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_org_payment_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_org_payment_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_org_payment_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_org_payments_payment_method"
            columns: ["payment_method_code"]
            isOneToOne: false
            referencedRelation: "sys_payment_method_cd"
            referencedColumns: ["payment_method_code"]
          },
          {
            foreignKeyName: "fk_org_payments_payment_type"
            columns: ["payment_type_code"]
            isOneToOne: false
            referencedRelation: "sys_payment_type_cd"
            referencedColumns: ["payment_type_code"]
          },
          {
            foreignKeyName: "fk_org_payments_voucher"
            columns: ["voucher_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_vouchers_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_payments_gift_card"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "org_gift_cards_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_payments_promo_code"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "org_promo_codes_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_payments_dtl_tr_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "org_customers_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_payments_dtl_tr_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_payments_dtl_tr_payment_type_code_fkey"
            columns: ["payment_type_code"]
            isOneToOne: false
            referencedRelation: "sys_payment_type_cd"
            referencedColumns: ["payment_type_code"]
          },
        ]
      }
      org_pck_packing_lists_mst: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          generated_at: string | null
          generated_by: string
          id: string
          is_active: boolean
          item_count: number | null
          items_summary: Json
          list_number: string
          order_id: string
          packaging_type_code: string
          print_count: number | null
          printed_at: string | null
          qr_code: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          task_id: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          generated_at?: string | null
          generated_by: string
          id?: string
          is_active?: boolean
          item_count?: number | null
          items_summary?: Json
          list_number: string
          order_id: string
          packaging_type_code: string
          print_count?: number | null
          printed_at?: string | null
          qr_code?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          task_id: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          generated_at?: string | null
          generated_by?: string
          id?: string
          is_active?: boolean
          item_count?: number | null
          items_summary?: Json
          list_number?: string
          order_id?: string
          packaging_type_code?: string
          print_count?: number | null
          printed_at?: string | null
          qr_code?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          task_id?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pck_list_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_pck_list_order"
            columns: ["order_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_pck_list_task"
            columns: ["task_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_asm_tasks_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_pck_list_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pck_list_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_pck_list_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_pln_change_history_tr: {
        Row: {
          change_reason: string | null
          change_type: string
          created_at: string | null
          created_by: string | null
          created_info: string | null
          effective_date: string
          from_plan_code: string | null
          id: string
          proration_amount: number | null
          proration_invoice_id: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          subscription_id: string
          tenant_org_id: string
          to_plan_code: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          change_reason?: string | null
          change_type: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          effective_date: string
          from_plan_code?: string | null
          id?: string
          proration_amount?: number | null
          proration_invoice_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          subscription_id: string
          tenant_org_id: string
          to_plan_code: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          change_reason?: string | null
          change_type?: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          effective_date?: string
          from_plan_code?: string | null
          id?: string
          proration_amount?: number | null
          proration_invoice_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          subscription_id?: string
          tenant_org_id?: string
          to_plan_code?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
            foreignKeyName: "org_pln_change_history_tr_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_pln_change_history_tr_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
          {
            foreignKeyName: "org_pln_subscriptions_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_pln_subscriptions_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_preference_bundles_cf: {
        Row: {
          bundle_code: string
          created_at: string | null
          created_by: string | null
          created_info: string | null
          discount_amount: number | null
          discount_percent: number | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          name2: string | null
          preference_codes: string[]
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          bundle_code: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          name2?: string | null
          preference_codes: string[]
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          bundle_code?: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          name2?: string | null
          preference_codes?: string[]
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
            foreignKeyName: "org_preference_bundles_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_preference_bundles_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_preference_bundles_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_preference_kind_cf: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          id: string
          is_active: boolean
          is_show_for_customer: boolean
          is_show_in_quick_bar: boolean
          is_stopped_by_saas: boolean
          kind_bg_color: string | null
          kind_code: string
          name: string | null
          name2: string | null
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
          id?: string
          is_active?: boolean
          is_show_for_customer?: boolean
          is_show_in_quick_bar?: boolean
          is_stopped_by_saas?: boolean
          kind_bg_color?: string | null
          kind_code: string
          name?: string | null
          name2?: string | null
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
          id?: string
          is_active?: boolean
          is_show_for_customer?: boolean
          is_show_in_quick_bar?: boolean
          is_stopped_by_saas?: boolean
          kind_bg_color?: string | null
          kind_code?: string
          name?: string | null
          name2?: string | null
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
            foreignKeyName: "org_preference_kind_cf_kind_code_fkey"
            columns: ["kind_code"]
            isOneToOne: false
            referencedRelation: "sys_preference_kind_cd"
            referencedColumns: ["kind_code"]
          },
          {
            foreignKeyName: "org_preference_kind_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_preference_kind_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_preference_kind_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_price_history_audit: {
        Row: {
          change_reason: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          effective_from: string | null
          effective_to: string | null
          entity_id: string
          entity_type: string
          id: string
          new_discount_percent: number | null
          new_price: number | null
          old_discount_percent: number | null
          old_price: number | null
          price_list_id: string | null
          product_id: string | null
          tenant_org_id: string
        }
        Insert: {
          change_reason?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          effective_from?: string | null
          effective_to?: string | null
          entity_id: string
          entity_type: string
          id?: string
          new_discount_percent?: number | null
          new_price?: number | null
          old_discount_percent?: number | null
          old_price?: number | null
          price_list_id?: string | null
          product_id?: string | null
          tenant_org_id: string
        }
        Update: {
          change_reason?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          effective_from?: string | null
          effective_to?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          new_discount_percent?: number | null
          new_price?: number | null
          old_discount_percent?: number | null
          old_price?: number | null
          price_list_id?: string | null
          product_id?: string | null
          tenant_org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_price_history_audit_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "org_price_lists_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_price_history_audit_product_id_tenant_org_id_fkey"
            columns: ["product_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_product_data_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "org_price_history_audit_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_price_history_audit_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_price_history_audit_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
            foreignKeyName: "org_price_list_items_dtl_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_price_list_items_dtl_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
          {
            foreignKeyName: "org_price_lists_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_price_lists_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_product_data_mst: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          default_express_sell_price: number | null
          default_packing_pref: string | null
          default_sell_price: number | null
          extra_days: number | null
          hint_text: string | null
          id: string
          id_sku: string | null
          is_active: boolean
          is_retail_item: boolean | null
          is_tax_exempt: number | null
          item_type_code: string | null
          last_purchase_cost: number | null
          max_stock_level: number | null
          min_quantity: number | null
          min_sell_price: number | null
          min_stock_level: number | null
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
          qty_on_hand: number | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          reorder_point: number | null
          service_category_code: string | null
          storage_location: string | null
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
          default_packing_pref?: string | null
          default_sell_price?: number | null
          extra_days?: number | null
          hint_text?: string | null
          id?: string
          id_sku?: string | null
          is_active?: boolean
          is_retail_item?: boolean | null
          is_tax_exempt?: number | null
          item_type_code?: string | null
          last_purchase_cost?: number | null
          max_stock_level?: number | null
          min_quantity?: number | null
          min_sell_price?: number | null
          min_stock_level?: number | null
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
          qty_on_hand?: number | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          reorder_point?: number | null
          service_category_code?: string | null
          storage_location?: string | null
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
          default_packing_pref?: string | null
          default_sell_price?: number | null
          extra_days?: number | null
          hint_text?: string | null
          id?: string
          id_sku?: string | null
          is_active?: boolean
          is_retail_item?: boolean | null
          is_tax_exempt?: number | null
          item_type_code?: string | null
          last_purchase_cost?: number | null
          max_stock_level?: number | null
          min_quantity?: number | null
          min_sell_price?: number | null
          min_stock_level?: number | null
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
          qty_on_hand?: number | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          reorder_point?: number | null
          service_category_code?: string | null
          storage_location?: string | null
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
            foreignKeyName: "fk_org_prod_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_org_prod_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_product_item_type"
            columns: ["item_type_code"]
            isOneToOne: false
            referencedRelation: "sys_item_type_cd"
            referencedColumns: ["item_type_code"]
          },
          {
            foreignKeyName: "org_product_data_mst_default_packing_pref_fkey"
            columns: ["default_packing_pref"]
            isOneToOne: false
            referencedRelation: "sys_packing_preference_cd"
            referencedColumns: ["code"]
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
          {
            foreignKeyName: "org_promo_codes_tenant_fk"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_promo_codes_tenant_fk"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_promo_usage_log: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          customer_id: string | null
          discount_amount: number
          id: string
          invoice_id: string | null
          metadata: Json | null
          order_id: string | null
          order_total_after: number
          order_total_before: number
          promo_code_id: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          used_at: string
          used_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          customer_id?: string | null
          discount_amount: number
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          order_id?: string | null
          order_total_after: number
          order_total_before: number
          promo_code_id: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          used_at?: string
          used_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          customer_id?: string | null
          discount_amount?: number
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          order_id?: string | null
          order_total_after?: number
          order_total_before?: number
          promo_code_id?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          {
            foreignKeyName: "org_promo_usage_tenant_fk"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_promo_usage_tenant_fk"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_qa_decisions_tr: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          decision_type_code: string
          id: string
          is_active: boolean
          order_id: string
          qa_at: string | null
          qa_by: string
          qa_note: string | null
          qa_photo_url: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          task_id: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          decision_type_code: string
          id?: string
          is_active?: boolean
          order_id: string
          qa_at?: string | null
          qa_by: string
          qa_note?: string | null
          qa_photo_url?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          task_id: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          decision_type_code?: string
          id?: string
          is_active?: boolean
          order_id?: string
          qa_at?: string | null
          qa_by?: string
          qa_note?: string | null
          qa_photo_url?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          task_id?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_qa_dec_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_qa_decision_order"
            columns: ["order_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_qa_decision_task"
            columns: ["task_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_asm_tasks_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
        ]
      }
      org_rcpt_receipts_mst: {
        Row: {
          branch_id: string | null
          content_html: string | null
          content_text: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          delivered_at: string | null
          delivery_channel_code: string
          delivery_status_code: string | null
          id: string
          is_active: boolean
          max_retries: number | null
          metadata: Json | null
          order_id: string | null
          qr_code: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          receipt_type_code: string
          recipient_email: string | null
          recipient_phone: string | null
          retry_count: number | null
          sent_at: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          voucher_id: string | null
        }
        Insert: {
          branch_id?: string | null
          content_html?: string | null
          content_text?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          delivered_at?: string | null
          delivery_channel_code: string
          delivery_status_code?: string | null
          id?: string
          is_active?: boolean
          max_retries?: number | null
          metadata?: Json | null
          order_id?: string | null
          qr_code?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          receipt_type_code: string
          recipient_email?: string | null
          recipient_phone?: string | null
          retry_count?: number | null
          sent_at?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          voucher_id?: string | null
        }
        Update: {
          branch_id?: string | null
          content_html?: string | null
          content_text?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          delivered_at?: string | null
          delivery_channel_code?: string
          delivery_status_code?: string | null
          id?: string
          is_active?: boolean
          max_retries?: number | null
          metadata?: Json | null
          order_id?: string | null
          qr_code?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          receipt_type_code?: string
          recipient_email?: string | null
          recipient_phone?: string | null
          retry_count?: number | null
          sent_at?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_org_rcpt_receipt_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_org_rcpt_receipts_voucher"
            columns: ["voucher_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_vouchers_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_rcpt_receipt_order"
            columns: ["order_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_orders_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_rcpt_receipt_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_rcpt_receipt_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_rcpt_receipt_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_rcpt_templates_cf: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          id: string
          is_active: boolean
          language: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          template_content: string
          template_type: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          language: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          template_content: string
          template_type: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          language?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          template_content?: string
          template_type?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_rcpt_template_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_rcpt_template_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_rcpt_template_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
          {
            foreignKeyName: "fk_org_ctg_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_org_ctg_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_service_preference_cf: {
        Row: {
          applies_to_products: string[] | null
          applies_to_services: string[] | null
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          display_order: number | null
          extra_price: number | null
          extra_turnaround_minutes: number | null
          id: string
          is_active: boolean | null
          is_included_in_base: boolean | null
          is_show_in_all_stages: boolean | null
          is_show_in_quick_bar: boolean | null
          is_system_code: boolean | null
          name: string | null
          name2: string | null
          preference_code: string
          preference_sys_kind: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          applies_to_products?: string[] | null
          applies_to_services?: string[] | null
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          display_order?: number | null
          extra_price?: number | null
          extra_turnaround_minutes?: number | null
          id?: string
          is_active?: boolean | null
          is_included_in_base?: boolean | null
          is_show_in_all_stages?: boolean | null
          is_show_in_quick_bar?: boolean | null
          is_system_code?: boolean | null
          name?: string | null
          name2?: string | null
          preference_code: string
          preference_sys_kind: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          applies_to_products?: string[] | null
          applies_to_services?: string[] | null
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          display_order?: number | null
          extra_price?: number | null
          extra_turnaround_minutes?: number | null
          id?: string
          is_active?: boolean | null
          is_included_in_base?: boolean | null
          is_show_in_all_stages?: boolean | null
          is_show_in_quick_bar?: boolean | null
          is_system_code?: boolean | null
          name?: string | null
          name2?: string | null
          preference_code?: string
          preference_sys_kind?: string
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
            foreignKeyName: "org_service_preference_cf_preference_code_fkey"
            columns: ["preference_code"]
            isOneToOne: false
            referencedRelation: "sys_service_preference_cd"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "org_service_preference_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_service_preference_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_service_preference_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_stng_audit_log_tr: {
        Row: {
          branch_id: string | null
          changed_at: string | null
          changed_by: string | null
          changed_by_name: string | null
          created_at: string | null
          created_info: string | null
          id: string
          is_active: boolean
          rec_status: number | null
          stng_after_value_jsonb: Json | null
          stng_audit_action: string
          stng_audit_scope: string
          stng_before_value_jsonb: Json | null
          stng_change_reason: string | null
          stng_code: string
          stng_ip_address: string | null
          stng_request_id: string | null
          tenant_org_id: string
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          changed_at?: string | null
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          rec_status?: number | null
          stng_after_value_jsonb?: Json | null
          stng_audit_action: string
          stng_audit_scope: string
          stng_before_value_jsonb?: Json | null
          stng_change_reason?: string | null
          stng_code: string
          stng_ip_address?: string | null
          stng_request_id?: string | null
          tenant_org_id: string
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          changed_at?: string | null
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          rec_status?: number | null
          stng_after_value_jsonb?: Json | null
          stng_audit_action?: string
          stng_audit_scope?: string
          stng_before_value_jsonb?: Json | null
          stng_change_reason?: string | null
          stng_code?: string
          stng_ip_address?: string | null
          stng_request_id?: string | null
          tenant_org_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_org_stng_audit_log_tr_branches"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "org_stng_audit_log_tr_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_stng_audit_log_tr_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_stng_audit_log_tr_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_stng_audit_log_tr_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "org_users_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_stng_effective_cache_cf: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean
          rec_status: number | null
          stng_cache_jsonb: Json
          stng_compute_hash: string
          stng_computed_at: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          rec_status?: number | null
          stng_cache_jsonb: Json
          stng_compute_hash: string
          stng_computed_at?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          rec_status?: number | null
          stng_cache_jsonb?: Json
          stng_compute_hash?: string
          stng_computed_at?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_org_stng_effective_cache_cf_branches"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "org_stng_effective_cache_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_stng_effective_cache_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_stng_effective_cache_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_stng_effective_cache_cf_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "org_users_mst"
            referencedColumns: ["id"]
          },
        ]
      }
      org_stng_settings_cf: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          is_active: boolean
          notes: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          service_category_id: string | null
          setting_code: string
          stng_scope: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          user_id: string | null
          value_jsonb: Json
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          service_category_id?: string | null
          setting_code: string
          stng_scope: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          user_id?: string | null
          value_jsonb: Json
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          service_category_id?: string | null
          setting_code?: string
          stng_scope?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          user_id?: string | null
          value_jsonb?: Json
        }
        Relationships: [
          {
            foreignKeyName: "org_stng_settings_cf_setting_code_fkey"
            columns: ["setting_code"]
            isOneToOne: false
            referencedRelation: "sys_stng_settings_cd"
            referencedColumns: ["setting_code"]
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
          last_payment_method_code: string | null
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
          last_payment_method_code?: string | null
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
          last_payment_method_code?: string | null
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
            foreignKeyName: "fk_org_subs_payment_method"
            columns: ["last_payment_method_code"]
            isOneToOne: false
            referencedRelation: "sys_payment_method_cd"
            referencedColumns: ["payment_method_code"]
          },
          {
            foreignKeyName: "fk_org_subs_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_org_subs_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_org_subs_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_svc_cat_proc_steps_cf: {
        Row: {
          created_at: string | null
          created_by: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          service_category_code: string
          step_code: string
          step_color: string | null
          step_icon: string | null
          step_name: string
          step_name2: string | null
          step_seq: number
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          service_category_code: string
          step_code: string
          step_color?: string | null
          step_icon?: string | null
          step_name: string
          step_name2?: string | null
          step_seq: number
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          service_category_code?: string
          step_code?: string
          step_color?: string | null
          step_icon?: string | null
          step_name?: string
          step_name2?: string | null
          step_seq?: number
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_org_steps_category"
            columns: ["tenant_org_id", "service_category_code"]
            isOneToOne: false
            referencedRelation: "org_service_category_cf"
            referencedColumns: ["tenant_org_id", "service_category_code"]
          },
          {
            foreignKeyName: "fk_org_steps_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_org_steps_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_org_steps_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_tenant_service_category_workflow_cf: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          id: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          service_category_code: string
          tenant_org_id: string
          track_individual_piece: boolean | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          use_assembly_screen: boolean | null
          use_preparation_screen: boolean | null
          use_qa_screen: boolean | null
          workflow_template_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          service_category_code: string
          tenant_org_id: string
          track_individual_piece?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          use_assembly_screen?: boolean | null
          use_preparation_screen?: boolean | null
          use_qa_screen?: boolean | null
          workflow_template_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          service_category_code?: string
          tenant_org_id?: string
          track_individual_piece?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          stng_locked_by_profile: boolean | null
          stng_override_reason: string | null
          stng_override_source: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          user_id: string | null
          value_jsonb: Json | null
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
          stng_locked_by_profile?: boolean | null
          stng_override_reason?: string | null
          stng_override_source?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          user_id?: string | null
          value_jsonb?: Json | null
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
          stng_locked_by_profile?: boolean | null
          stng_override_reason?: string | null
          stng_override_source?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          user_id?: string | null
          value_jsonb?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ots_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ots_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ots_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_tenant_workflow_settings_cf: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          orders_split_enabled: boolean | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          tenant_org_id: string
          track_individual_piece: boolean | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          use_assembly_screen: boolean | null
          use_preparation_screen: boolean | null
          use_qa_screen: boolean | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          orders_split_enabled?: boolean | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id: string
          track_individual_piece?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          use_assembly_screen?: boolean | null
          use_preparation_screen?: boolean | null
          use_qa_screen?: boolean | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          orders_split_enabled?: boolean | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id?: string
          track_individual_piece?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          {
            foreignKeyName: "org_tenant_workflow_settings_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: true
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_tenant_workflow_settings_cf_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: true
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_tenant_workflow_templates_cf: {
        Row: {
          allow_back_steps: boolean | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          extra_config: Json | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          template_id: string
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          allow_back_steps?: boolean | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          extra_config?: Json | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          template_id: string
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          allow_back_steps?: boolean | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          extra_config?: Json | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          template_id?: string
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
            foreignKeyName: "fk_tenant_workflow_templates_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_tenant_workflow_templates_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
          created_by: string | null
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          s_current_plan: string | null
          slug: string
          status: string | null
          stng_profile_code: string | null
          stng_profile_locked: boolean | null
          stng_profile_version_applied: number | null
          time_format: string | null
          timezone: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
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
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          s_current_plan?: string | null
          slug: string
          status?: string | null
          stng_profile_code?: string | null
          stng_profile_locked?: boolean | null
          stng_profile_version_applied?: number | null
          time_format?: string | null
          timezone?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          s_current_plan?: string | null
          slug?: string
          status?: string | null
          stng_profile_code?: string | null
          stng_profile_locked?: boolean | null
          stng_profile_version_applied?: number | null
          time_format?: string | null
          timezone?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tenant_business_type"
            columns: ["business_type_code"]
            isOneToOne: false
            referencedRelation: "sys_main_business_type_cd"
            referencedColumns: ["business_type_code"]
          },
          {
            foreignKeyName: "org_tenants_mst_stng_profile_code_fkey"
            columns: ["stng_profile_code"]
            isOneToOne: false
            referencedRelation: "sys_stng_profiles_mst"
            referencedColumns: ["stng_profile_code"]
          },
        ]
      }
      org_usage_tracking: {
        Row: {
          api_calls: number | null
          branches_count: number | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          id: string
          orders_count: number | null
          period_end: string
          period_start: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          storage_mb: number | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          users_count: number | null
        }
        Insert: {
          api_calls?: number | null
          branches_count?: number | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          orders_count?: number | null
          period_end: string
          period_start: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          storage_mb?: number | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          users_count?: number | null
        }
        Update: {
          api_calls?: number | null
          branches_count?: number | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          orders_count?: number | null
          period_end?: string
          period_start?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          storage_mb?: number | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          {
            foreignKeyName: "org_usage_tracking_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_usage_tracking_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
            foreignKeyName: "org_users_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_users_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
          created_by: string | null
          created_info: string | null
          from_status: string
          id: string
          is_allowed: boolean | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          requires_role: string | null
          tenant_org_id: string
          to_status: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          validation_rules: Json | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          from_status: string
          id?: string
          is_allowed?: boolean | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_role?: string | null
          tenant_org_id: string
          to_status: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          validation_rules?: Json | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          from_status?: string
          id?: string
          is_allowed?: boolean | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_role?: string | null
          tenant_org_id?: string
          to_status?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          {
            foreignKeyName: "fk_workflow_rules_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_workflow_rules_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      org_workflow_settings_cf: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          id: string
          is_active: boolean | null
          quality_gate_rules: Json | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          service_category_code: string | null
          status_transitions: Json
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          workflow_steps: Json
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean | null
          quality_gate_rules?: Json | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          service_category_code?: string | null
          status_transitions?: Json
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          workflow_steps?: Json
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean | null
          quality_gate_rules?: Json | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          service_category_code?: string | null
          status_transitions?: Json
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          {
            foreignKeyName: "fk_workflow_settings_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_workflow_settings_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      sys_asm_exception_type_cd: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          is_active: boolean
          name: string
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          requires_action: boolean | null
          severity_level: string | null
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
          name: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_action?: boolean | null
          severity_level?: string | null
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
          name?: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_action?: boolean | null
          severity_level?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_asm_location_type_cd: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          default_capacity: number | null
          description: string | null
          description2: string | null
          is_active: boolean
          name: string
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          default_capacity?: number | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          name: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          default_capacity?: number | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          name?: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_audit_log: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          ip_address: unknown
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
          ip_address?: unknown
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
          ip_address?: unknown
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
            foreignKeyName: "sys_audit_log_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "sys_audit_log_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
          created_info: string | null
          description: string | null
          description2: string | null
          is_active: boolean
          is_system: boolean
          name: string
          name2: string | null
          old_role_id: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          is_system?: boolean
          name: string
          name2?: string | null
          old_role_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          is_system?: boolean
          name?: string
          name2?: string | null
          old_role_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          created_at: string | null
          created_by: string | null
          created_info: string | null
          discount_amount: number | null
          discount_code: string
          id: string
          invoice_id: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          redeemed_at: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          discount_amount?: number | null
          discount_code: string
          id?: string
          invoice_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          redeemed_at?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          discount_amount?: number | null
          discount_code?: string
          id?: string
          invoice_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          redeemed_at?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          {
            foreignKeyName: "sys_bill_discount_redemptions_tr_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "sys_bill_discount_redemptions_tr_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      sys_bill_dunning_mst: {
        Row: {
          calls_made: number | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          emails_sent: number | null
          first_failure_date: string
          id: string
          invoice_id: string
          last_retry_date: string | null
          max_retries: number | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          resolution_method: string | null
          resolved_at: string | null
          retry_count: number | null
          status: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          calls_made?: number | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          emails_sent?: number | null
          first_failure_date: string
          id?: string
          invoice_id: string
          last_retry_date?: string | null
          max_retries?: number | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          resolution_method?: string | null
          resolved_at?: string | null
          retry_count?: number | null
          status?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          calls_made?: number | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          emails_sent?: number | null
          first_failure_date?: string
          id?: string
          invoice_id?: string
          last_retry_date?: string | null
          max_retries?: number | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          resolution_method?: string | null
          resolved_at?: string | null
          retry_count?: number | null
          status?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
            foreignKeyName: "sys_bill_dunning_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "sys_bill_dunning_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
          currency_code: string
          failure_reason: string | null
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_gateway: string | null
          payment_gateway_fee: number | null
          payment_gateway_ref: string | null
          payment_method_code: string
          payment_type_code: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          status: string | null
          tax: number | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          vat: number | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          currency_code: string
          failure_reason?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date: string
          payment_gateway?: string | null
          payment_gateway_fee?: number | null
          payment_gateway_ref?: string | null
          payment_method_code: string
          payment_type_code?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          status?: string | null
          tax?: number | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          vat?: number | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          currency_code?: string
          failure_reason?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_gateway?: string | null
          payment_gateway_fee?: number | null
          payment_gateway_ref?: string | null
          payment_method_code?: string
          payment_type_code?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          status?: string | null
          tax?: number | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          vat?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sys_bill_pay_method"
            columns: ["payment_method_code"]
            isOneToOne: false
            referencedRelation: "sys_payment_method_cd"
            referencedColumns: ["payment_method_code"]
          },
          {
            foreignKeyName: "sys_bill_invoice_payments_tr_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sys_bill_invoices_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_bill_invoice_payments_tr_payment_type_code_fkey"
            columns: ["payment_type_code"]
            isOneToOne: false
            referencedRelation: "sys_payment_type_cd"
            referencedColumns: ["payment_type_code"]
          },
          {
            foreignKeyName: "sys_bill_invoice_payments_tr_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_bill_invoice_payments_tr_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "sys_bill_invoice_payments_tr_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
          payment_method_code: string | null
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
          payment_method_code?: string | null
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
          payment_method_code?: string | null
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
            foreignKeyName: "fk_sys_bill_inv_payment_method"
            columns: ["payment_method_code"]
            isOneToOne: false
            referencedRelation: "sys_payment_method_cd"
            referencedColumns: ["payment_method_code"]
          },
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
          {
            foreignKeyName: "sys_bill_invoices_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "sys_bill_invoices_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      sys_bill_payment_gateways_cf: {
        Row: {
          auto_capture: boolean | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          regions: Json | null
          retry_enabled: boolean | null
          transaction_fee_fixed: number | null
          transaction_fee_percentage: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          auto_capture?: boolean | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          regions?: Json | null
          retry_enabled?: boolean | null
          transaction_fee_fixed?: number | null
          transaction_fee_percentage?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          auto_capture?: boolean | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          regions?: Json | null
          retry_enabled?: boolean | null
          transaction_fee_fixed?: number | null
          transaction_fee_percentage?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_bill_payment_method_codes_cd: {
        Row: {
          auto_approve: boolean | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
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
          rec_order: number | null
          rec_status: number | null
          requires_verification: boolean | null
          type: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          auto_approve?: boolean | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_order?: number | null
          rec_status?: number | null
          requires_verification?: boolean | null
          type: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          auto_approve?: boolean | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_order?: number | null
          rec_status?: number | null
          requires_verification?: boolean | null
          type?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          created_info: string | null
          gateway: string | null
          gateway_customer_id: string | null
          gateway_payment_method_id: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          is_verified: boolean | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          tenant_org_id: string
          type: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
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
          created_info?: string | null
          gateway?: string | null
          gateway_customer_id?: string | null
          gateway_payment_method_id?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_verified?: boolean | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id: string
          type: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          created_info?: string | null
          gateway?: string | null
          gateway_customer_id?: string | null
          gateway_payment_method_id?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_verified?: boolean | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          tenant_org_id?: string
          type?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_bill_payment_methods_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_bill_payment_methods_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "sys_bill_payment_methods_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
          created_by: string | null
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          total_customers: number | null
          trial_customers: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
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
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          total_customers?: number | null
          trial_customers?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          total_customers?: number | null
          trial_customers?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_bill_usage_metrics_daily: {
        Row: {
          active_users: number | null
          api_calls: number | null
          branches_count: number | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          id: string
          metric_date: string
          orders_cancelled: number | null
          orders_completed: number | null
          orders_count: number | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          revenue: number | null
          storage_mb_used: number | null
          tenant_org_id: string
          total_users: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          active_users?: number | null
          api_calls?: number | null
          branches_count?: number | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          metric_date: string
          orders_cancelled?: number | null
          orders_completed?: number | null
          orders_count?: number | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          revenue?: number | null
          storage_mb_used?: number | null
          tenant_org_id: string
          total_users?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          active_users?: number | null
          api_calls?: number | null
          branches_count?: number | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          metric_date?: string
          orders_cancelled?: number | null
          orders_completed?: number | null
          orders_count?: number | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          revenue?: number | null
          storage_mb_used?: number | null
          tenant_org_id?: string
          total_users?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_bill_usage_metrics_daily_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_bill_usage_metrics_daily_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "sys_bill_usage_metrics_daily_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      sys_billing_cycle_cd: {
        Row: {
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          created_by: string | null
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          requires_unique_name: boolean | null
          supports_tenant_override: boolean | null
          table_name: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          category?: string | null
          code_pattern?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_unique_name?: boolean | null
          supports_tenant_override?: boolean | null
          table_name: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          category?: string | null
          code_pattern?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_unique_name?: boolean | null
          supports_tenant_override?: boolean | null
          table_name?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
      sys_customer_category_cd: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          created_info: string | null
          display_order: number | null
          is_active: boolean
          is_b2b: boolean
          is_individual: boolean
          is_reserved_system: boolean
          name: string
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          system_type: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          display_order?: number | null
          is_active?: boolean
          is_b2b?: boolean
          is_individual?: boolean
          is_reserved_system?: boolean
          name: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          system_type: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          display_order?: number | null
          is_active?: boolean
          is_b2b?: boolean
          is_individual?: boolean
          is_reserved_system?: boolean
          name?: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          system_type?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
      sys_dlv_pod_method_cd: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          is_active: boolean
          name: string
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          requires_verification: boolean | null
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
          name: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_verification?: boolean | null
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
          name?: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_verification?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_dlv_route_status_cd: {
        Row: {
          allows_modification: boolean | null
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          is_active: boolean
          name: string
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          allows_modification?: boolean | null
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          name: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          allows_modification?: boolean | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          name?: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_dlv_stop_status_cd: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          is_active: boolean
          is_final: boolean | null
          name: string
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
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
          is_final?: boolean | null
          name: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
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
          is_final?: boolean | null
          name?: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
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
      sys_ff_pln_flag_mappings_dtl: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          flag_key: string
          id: string
          is_active: boolean | null
          is_enabled: boolean | null
          notes: string | null
          plan_code: string
          plan_specific_value: Json | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          flag_key: string
          id?: string
          is_active?: boolean | null
          is_enabled?: boolean | null
          notes?: string | null
          plan_code: string
          plan_specific_value?: Json | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          flag_key?: string
          id?: string
          is_active?: boolean | null
          is_enabled?: boolean | null
          notes?: string | null
          plan_code?: string
          plan_specific_value?: Json | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sys_ff_pln_flag_mappings_flag_key"
            columns: ["flag_key"]
            isOneToOne: false
            referencedRelation: "hq_ff_feature_flags_mst"
            referencedColumns: ["flag_key"]
          },
          {
            foreignKeyName: "sys_pln_flag_mappings_dtl_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "sys_pln_subscription_plans_mst"
            referencedColumns: ["plan_code"]
          },
        ]
      }
      sys_fin_acc_group_cd: {
        Row: {
          acc_group_code: string
          acc_group_id: string
          acc_type_id: string
          created_at: string
          created_by: string | null
          created_info: string | null
          description: string | null
          description2: string | null
          group_level: number
          is_active: boolean
          name: string
          name2: string | null
          parent_group_id: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          report_role_code: string | null
          stmt_section: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          acc_group_code: string
          acc_group_id?: string
          acc_type_id: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          group_level?: number
          is_active?: boolean
          name: string
          name2?: string | null
          parent_group_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          report_role_code?: string | null
          stmt_section: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          acc_group_code?: string
          acc_group_id?: string
          acc_type_id?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          group_level?: number
          is_active?: boolean
          name?: string
          name2?: string | null
          parent_group_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          report_role_code?: string | null
          stmt_section?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sfag_prnt"
            columns: ["parent_group_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_acc_group_cd"
            referencedColumns: ["acc_group_id"]
          },
          {
            foreignKeyName: "fk_sfag_type"
            columns: ["acc_type_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_acc_type_cd"
            referencedColumns: ["acc_type_id"]
          },
        ]
      }
      sys_fin_acc_type_cd: {
        Row: {
          acc_type_code: string
          acc_type_id: string
          created_at: string
          created_by: string | null
          created_info: string | null
          description: string | null
          description2: string | null
          is_active: boolean
          name: string
          name2: string | null
          normal_balance: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          statement_family: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          acc_type_code: string
          acc_type_id?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          name: string
          name2?: string | null
          normal_balance: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          statement_family: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          acc_type_code?: string
          acc_type_id?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          name?: string
          name2?: string | null
          normal_balance?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          statement_family?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_fin_auto_post_mst: {
        Row: {
          auto_post_id: string
          blocking_mode: string
          created_at: string
          created_by: string | null
          created_info: string | null
          effective_from: string | null
          effective_to: string | null
          evt_id: string
          failure_action_code: string
          is_active: boolean
          is_enabled: boolean
          notes: string | null
          notes2: string | null
          pkg_id: string
          policy_ver: number
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          repost_allowed: boolean
          required_success: boolean
          retry_allowed: boolean
          status_code: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          auto_post_id?: string
          blocking_mode: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          effective_from?: string | null
          effective_to?: string | null
          evt_id: string
          failure_action_code: string
          is_active?: boolean
          is_enabled?: boolean
          notes?: string | null
          notes2?: string | null
          pkg_id: string
          policy_ver?: number
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          repost_allowed?: boolean
          required_success?: boolean
          retry_allowed?: boolean
          status_code?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          auto_post_id?: string
          blocking_mode?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          effective_from?: string | null
          effective_to?: string | null
          evt_id?: string
          failure_action_code?: string
          is_active?: boolean
          is_enabled?: boolean
          notes?: string | null
          notes2?: string | null
          pkg_id?: string
          policy_ver?: number
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          repost_allowed?: boolean
          required_success?: boolean
          retry_allowed?: boolean
          status_code?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sfap_evt"
            columns: ["evt_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_evt_cd"
            referencedColumns: ["evt_id"]
          },
          {
            foreignKeyName: "fk_sfap_pkg"
            columns: ["pkg_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_gov_pkg_mst"
            referencedColumns: ["pkg_id"]
          },
        ]
      }
      sys_fin_coa_tpl_dtl: {
        Row: {
          acc_group_id: string | null
          acc_type_id: string
          account_code: string
          account_level: number
          allow_code_change: boolean
          allow_rename: boolean
          allow_tenant_children: boolean
          branch_mode_code: string
          coa_tpl_id: string
          coa_tpl_line_id: string
          created_at: string
          created_by: string | null
          created_info: string | null
          description: string | null
          description2: string | null
          effective_from: string | null
          effective_to: string | null
          is_active: boolean
          is_control_account: boolean
          is_locked: boolean
          is_postable: boolean
          is_system_linked: boolean
          is_system_seeded: boolean
          manual_post_allowed: boolean
          name: string
          name2: string | null
          parent_tpl_line_id: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          usage_hint_code: string | null
        }
        Insert: {
          acc_group_id?: string | null
          acc_type_id: string
          account_code: string
          account_level: number
          allow_code_change?: boolean
          allow_rename?: boolean
          allow_tenant_children?: boolean
          branch_mode_code?: string
          coa_tpl_id: string
          coa_tpl_line_id?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          effective_from?: string | null
          effective_to?: string | null
          is_active?: boolean
          is_control_account?: boolean
          is_locked?: boolean
          is_postable?: boolean
          is_system_linked?: boolean
          is_system_seeded?: boolean
          manual_post_allowed?: boolean
          name: string
          name2?: string | null
          parent_tpl_line_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          usage_hint_code?: string | null
        }
        Update: {
          acc_group_id?: string | null
          acc_type_id?: string
          account_code?: string
          account_level?: number
          allow_code_change?: boolean
          allow_rename?: boolean
          allow_tenant_children?: boolean
          branch_mode_code?: string
          coa_tpl_id?: string
          coa_tpl_line_id?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          effective_from?: string | null
          effective_to?: string | null
          is_active?: boolean
          is_control_account?: boolean
          is_locked?: boolean
          is_postable?: boolean
          is_system_linked?: boolean
          is_system_seeded?: boolean
          manual_post_allowed?: boolean
          name?: string
          name2?: string | null
          parent_tpl_line_id?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          usage_hint_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sfcd_grp"
            columns: ["acc_group_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_acc_group_cd"
            referencedColumns: ["acc_group_id"]
          },
          {
            foreignKeyName: "fk_sfcd_prnt"
            columns: ["parent_tpl_line_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_coa_tpl_dtl"
            referencedColumns: ["coa_tpl_line_id"]
          },
          {
            foreignKeyName: "fk_sfcd_tpl"
            columns: ["coa_tpl_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_coa_tpl_mst"
            referencedColumns: ["coa_tpl_id"]
          },
          {
            foreignKeyName: "fk_sfcd_type"
            columns: ["acc_type_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_acc_type_cd"
            referencedColumns: ["acc_type_id"]
          },
        ]
      }
      sys_fin_coa_tpl_mst: {
        Row: {
          coa_template_code: string
          coa_tpl_id: string
          created_at: string
          created_by: string | null
          created_info: string | null
          description: string | null
          description2: string | null
          is_active: boolean
          name: string
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          status_code: string
          tpl_pkg_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          coa_template_code: string
          coa_tpl_id?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          name: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          tpl_pkg_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          coa_template_code?: string
          coa_tpl_id?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          name?: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          tpl_pkg_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sfct_pkg"
            columns: ["tpl_pkg_id"]
            isOneToOne: true
            referencedRelation: "sys_fin_tpl_pkg_mst"
            referencedColumns: ["tpl_pkg_id"]
          },
        ]
      }
      sys_fin_evt_cd: {
        Row: {
          created_at: string
          created_by: string | null
          created_info: string | null
          description: string | null
          description2: string | null
          evt_code: string
          evt_id: string
          is_active: boolean
          is_locked: boolean
          name: string
          name2: string | null
          phase_code: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          evt_code: string
          evt_id?: string
          is_active?: boolean
          is_locked?: boolean
          name: string
          name2?: string | null
          phase_code: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          evt_code?: string
          evt_id?: string
          is_active?: boolean
          is_locked?: boolean
          name?: string
          name2?: string | null
          phase_code?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_fin_gov_pkg_mst: {
        Row: {
          acc_type_cat_ver: number
          approved_at: string | null
          approved_by: string | null
          auto_post_ver: number
          compat_version: string
          created_at: string
          created_by: string | null
          created_info: string | null
          description: string | null
          description2: string | null
          effective_from: string | null
          effective_to: string | null
          evt_cat_ver: number
          is_active: boolean
          name: string
          name2: string | null
          phase_code: string
          pkg_code: string
          pkg_id: string
          published_at: string | null
          published_by: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          resolver_cat_ver: number
          rule_set_ver: number
          status_code: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          usage_cat_ver: number
          version_no: number
        }
        Insert: {
          acc_type_cat_ver?: number
          approved_at?: string | null
          approved_by?: string | null
          auto_post_ver?: number
          compat_version: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          effective_from?: string | null
          effective_to?: string | null
          evt_cat_ver?: number
          is_active?: boolean
          name: string
          name2?: string | null
          phase_code: string
          pkg_code: string
          pkg_id?: string
          published_at?: string | null
          published_by?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          resolver_cat_ver?: number
          rule_set_ver?: number
          status_code: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          usage_cat_ver?: number
          version_no?: number
        }
        Update: {
          acc_type_cat_ver?: number
          approved_at?: string | null
          approved_by?: string | null
          auto_post_ver?: number
          compat_version?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          effective_from?: string | null
          effective_to?: string | null
          evt_cat_ver?: number
          is_active?: boolean
          name?: string
          name2?: string | null
          phase_code?: string
          pkg_code?: string
          pkg_id?: string
          published_at?: string | null
          published_by?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          resolver_cat_ver?: number
          rule_set_ver?: number
          status_code?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          usage_cat_ver?: number
          version_no?: number
        }
        Relationships: []
      }
      sys_fin_map_rule_dtl: {
        Row: {
          amount_source_code: string
          condition_json: Json
          created_at: string
          created_by: string | null
          created_info: string | null
          entry_side: string
          is_active: boolean
          line_no: number
          line_type_code: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          resolver_id: string | null
          rule_id: string
          rule_line_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          usage_code_id: string | null
        }
        Insert: {
          amount_source_code: string
          condition_json?: Json
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          entry_side: string
          is_active?: boolean
          line_no: number
          line_type_code?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          resolver_id?: string | null
          rule_id: string
          rule_line_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          usage_code_id?: string | null
        }
        Update: {
          amount_source_code?: string
          condition_json?: Json
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          entry_side?: string
          is_active?: boolean
          line_no?: number
          line_type_code?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          resolver_id?: string | null
          rule_id?: string
          rule_line_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          usage_code_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sfml_res"
            columns: ["resolver_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_resolver_cd"
            referencedColumns: ["resolver_id"]
          },
          {
            foreignKeyName: "fk_sfml_rule"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_map_rule_mst"
            referencedColumns: ["rule_id"]
          },
          {
            foreignKeyName: "fk_sfml_uc"
            columns: ["usage_code_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_usage_code_cd"
            referencedColumns: ["usage_code_id"]
          },
          {
            foreignKeyName: "fk_sfml_uc"
            columns: ["usage_code_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["usage_code_id"]
          },
        ]
      }
      sys_fin_map_rule_mst: {
        Row: {
          condition_json: Json
          created_at: string
          created_by: string | null
          created_info: string | null
          description: string | null
          description2: string | null
          evt_id: string
          is_active: boolean
          is_fallback: boolean
          name: string
          name2: string | null
          pkg_id: string
          priority_no: number
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          rule_code: string
          rule_id: string
          status_code: string
          stop_on_match: boolean
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          version_no: number
        }
        Insert: {
          condition_json?: Json
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          evt_id: string
          is_active?: boolean
          is_fallback?: boolean
          name: string
          name2?: string | null
          pkg_id: string
          priority_no?: number
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          rule_code: string
          rule_id?: string
          status_code?: string
          stop_on_match?: boolean
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          version_no?: number
        }
        Update: {
          condition_json?: Json
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          evt_id?: string
          is_active?: boolean
          is_fallback?: boolean
          name?: string
          name2?: string | null
          pkg_id?: string
          priority_no?: number
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          rule_code?: string
          rule_id?: string
          status_code?: string
          stop_on_match?: boolean
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_sfmr_evt"
            columns: ["evt_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_evt_cd"
            referencedColumns: ["evt_id"]
          },
          {
            foreignKeyName: "fk_sfmr_pkg"
            columns: ["pkg_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_gov_pkg_mst"
            referencedColumns: ["pkg_id"]
          },
        ]
      }
      sys_fin_oper_tpl_dtl: {
        Row: {
          config_json: Json
          created_at: string
          created_by: string | null
          created_info: string | null
          is_active: boolean
          oper_code: string
          oper_tpl_id: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          status_code: string
          target_account_code: string | null
          tpl_pkg_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          config_json?: Json
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean
          oper_code: string
          oper_tpl_id?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          target_account_code?: string | null
          tpl_pkg_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          config_json?: Json
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean
          oper_code?: string
          oper_tpl_id?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          target_account_code?: string | null
          tpl_pkg_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sfot_pkg"
            columns: ["tpl_pkg_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_tpl_pkg_mst"
            referencedColumns: ["tpl_pkg_id"]
          },
        ]
      }
      sys_fin_period_tpl_dtl: {
        Row: {
          created_at: string
          created_by: string | null
          created_info: string | null
          is_active: boolean
          label_text: string | null
          line_no: number
          month_no: number
          period_tpl_id: string
          period_tpl_line_id: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean
          label_text?: string | null
          line_no: number
          month_no: number
          period_tpl_id: string
          period_tpl_line_id?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean
          label_text?: string | null
          line_no?: number
          month_no?: number
          period_tpl_id?: string
          period_tpl_line_id?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sfpd_tpl"
            columns: ["period_tpl_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_period_tpl_mst"
            referencedColumns: ["period_tpl_id"]
          },
        ]
      }
      sys_fin_period_tpl_mst: {
        Row: {
          created_at: string
          created_by: string | null
          created_info: string | null
          default_open_status: string
          fiscal_start_month: number
          is_active: boolean
          period_style_code: string
          period_tpl_id: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          seed_horizon_months: number
          tpl_pkg_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          default_open_status?: string
          fiscal_start_month?: number
          is_active?: boolean
          period_style_code?: string
          period_tpl_id?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          seed_horizon_months?: number
          tpl_pkg_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          default_open_status?: string
          fiscal_start_month?: number
          is_active?: boolean
          period_style_code?: string
          period_tpl_id?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          seed_horizon_months?: number
          tpl_pkg_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sfpm_pkg"
            columns: ["tpl_pkg_id"]
            isOneToOne: true
            referencedRelation: "sys_fin_tpl_pkg_mst"
            referencedColumns: ["tpl_pkg_id"]
          },
        ]
      }
      sys_fin_resolver_cd: {
        Row: {
          created_at: string
          created_by: string | null
          created_info: string | null
          description: string | null
          description2: string | null
          is_active: boolean
          is_locked: boolean
          name: string
          name2: string | null
          phase_code: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          resolver_code: string
          resolver_id: string
          resolver_kind: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          is_locked?: boolean
          name: string
          name2?: string | null
          phase_code: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          resolver_code: string
          resolver_id?: string
          resolver_kind?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          is_locked?: boolean
          name?: string
          name2?: string | null
          phase_code?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          resolver_code?: string
          resolver_id?: string
          resolver_kind?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_fin_tpl_assign_mst: {
        Row: {
          assign_id: string
          assignment_mode: string
          country_code: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          is_active: boolean
          is_default_fallback: boolean
          main_business_type_code: string | null
          plan_code: string | null
          priority_no: number
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          status_code: string
          tenant_org_id: string | null
          tpl_pkg_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          assign_id?: string
          assignment_mode: string
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean
          is_default_fallback?: boolean
          main_business_type_code?: string | null
          plan_code?: string | null
          priority_no?: number
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          tenant_org_id?: string | null
          tpl_pkg_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          assign_id?: string
          assignment_mode?: string
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean
          is_default_fallback?: boolean
          main_business_type_code?: string | null
          plan_code?: string | null
          priority_no?: number
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          tenant_org_id?: string | null
          tpl_pkg_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sfta_btype"
            columns: ["main_business_type_code"]
            isOneToOne: false
            referencedRelation: "sys_main_business_type_cd"
            referencedColumns: ["business_type_code"]
          },
          {
            foreignKeyName: "fk_sfta_pkg"
            columns: ["tpl_pkg_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_tpl_pkg_mst"
            referencedColumns: ["tpl_pkg_id"]
          },
          {
            foreignKeyName: "fk_sfta_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sfta_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_sfta_tnt"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      sys_fin_tpl_pkg_mst: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          compat_version: string
          country_code: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          description: string | null
          description2: string | null
          effective_from: string | null
          effective_to: string | null
          is_active: boolean
          main_business_type_code: string | null
          name: string
          name2: string | null
          phase_scope_code: string
          plan_code: string | null
          published_at: string | null
          published_by: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          status_code: string
          tpl_pkg_code: string
          tpl_pkg_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          version_no: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          compat_version: string
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          effective_from?: string | null
          effective_to?: string | null
          is_active?: boolean
          main_business_type_code?: string | null
          name: string
          name2?: string | null
          phase_scope_code?: string
          plan_code?: string | null
          published_at?: string | null
          published_by?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          tpl_pkg_code: string
          tpl_pkg_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          version_no?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          compat_version?: string
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          effective_from?: string | null
          effective_to?: string | null
          is_active?: boolean
          main_business_type_code?: string | null
          name?: string
          name2?: string | null
          phase_scope_code?: string
          plan_code?: string | null
          published_at?: string | null
          published_by?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          status_code?: string
          tpl_pkg_code?: string
          tpl_pkg_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_sftp_btype"
            columns: ["main_business_type_code"]
            isOneToOne: false
            referencedRelation: "sys_main_business_type_cd"
            referencedColumns: ["business_type_code"]
          },
        ]
      }
      sys_fin_usage_code_cd: {
        Row: {
          created_at: string
          created_by: string | null
          created_info: string | null
          description: string | null
          description2: string | null
          is_active: boolean
          is_required_v1: boolean
          name: string
          name2: string | null
          normal_balance: string
          phase_code: string
          primary_acc_type_id: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          usage_code: string
          usage_code_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          is_required_v1?: boolean
          name: string
          name2?: string | null
          normal_balance: string
          phase_code: string
          primary_acc_type_id: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          usage_code: string
          usage_code_id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          is_required_v1?: boolean
          name?: string
          name2?: string | null
          normal_balance?: string
          phase_code?: string
          primary_acc_type_id?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          usage_code?: string
          usage_code_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_sfuc_type"
            columns: ["primary_acc_type_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_acc_type_cd"
            referencedColumns: ["acc_type_id"]
          },
        ]
      }
      sys_fin_usage_tpl_dtl: {
        Row: {
          branch_scope_code: string
          coa_tpl_line_id: string | null
          created_at: string
          created_by: string | null
          created_info: string | null
          effective_from: string | null
          effective_to: string | null
          is_active: boolean
          is_required: boolean
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          target_account_code: string
          tpl_pkg_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          usage_code_id: string
          usage_tpl_id: string
        }
        Insert: {
          branch_scope_code?: string
          coa_tpl_line_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          effective_from?: string | null
          effective_to?: string | null
          is_active?: boolean
          is_required?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          target_account_code: string
          tpl_pkg_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          usage_code_id: string
          usage_tpl_id?: string
        }
        Update: {
          branch_scope_code?: string
          coa_tpl_line_id?: string | null
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          effective_from?: string | null
          effective_to?: string | null
          is_active?: boolean
          is_required?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          target_account_code?: string
          tpl_pkg_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          usage_code_id?: string
          usage_tpl_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_sfutd_line"
            columns: ["coa_tpl_line_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_coa_tpl_dtl"
            referencedColumns: ["coa_tpl_line_id"]
          },
          {
            foreignKeyName: "fk_sfutd_pkg"
            columns: ["tpl_pkg_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_tpl_pkg_mst"
            referencedColumns: ["tpl_pkg_id"]
          },
          {
            foreignKeyName: "fk_sfutd_use"
            columns: ["usage_code_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_usage_code_cd"
            referencedColumns: ["usage_code_id"]
          },
          {
            foreignKeyName: "fk_sfutd_use"
            columns: ["usage_code_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["usage_code_id"]
          },
        ]
      }
      sys_fin_usage_type_dtl: {
        Row: {
          acc_type_id: string
          created_at: string
          created_by: string | null
          created_info: string | null
          is_active: boolean
          is_primary: boolean
          rec_notes: string | null
          rec_order: number | null
          rec_status: number
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          usage_code_id: string
          usage_type_id: string
        }
        Insert: {
          acc_type_id: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean
          is_primary?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          usage_code_id: string
          usage_type_id?: string
        }
        Update: {
          acc_type_id?: string
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean
          is_primary?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          usage_code_id?: string
          usage_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_sfut_type"
            columns: ["acc_type_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_acc_type_cd"
            referencedColumns: ["acc_type_id"]
          },
          {
            foreignKeyName: "fk_sfut_usage"
            columns: ["usage_code_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_usage_code_cd"
            referencedColumns: ["usage_code_id"]
          },
          {
            foreignKeyName: "fk_sfut_usage"
            columns: ["usage_code_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["usage_code_id"]
          },
        ]
      }
      sys_fin_voucher_category_cd: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          is_active: boolean
          name: string
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
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
          name: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
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
          name?: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_fin_voucher_subtype_cd: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          is_active: boolean
          name: string
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          updated_at: string | null
          updated_by: string | null
          voucher_category_code: string
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          name: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          voucher_category_code: string
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          name?: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          voucher_category_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_fin_voucher_subtype_cat"
            columns: ["voucher_category_code"]
            isOneToOne: false
            referencedRelation: "sys_fin_voucher_category_cd"
            referencedColumns: ["code"]
          },
        ]
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
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
      sys_jwt_tenant_health_log: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          error_message: string | null
          event_type: string
          had_tenant_context: boolean
          id: string
          metadata: Json | null
          org_user_id: string | null
          repair_attempted: boolean | null
          repair_successful: boolean | null
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type: string
          had_tenant_context: boolean
          id?: string
          metadata?: Json | null
          org_user_id?: string | null
          repair_attempted?: boolean | null
          repair_successful?: boolean | null
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          had_tenant_context?: boolean
          id?: string
          metadata?: Json | null
          org_user_id?: string | null
          repair_attempted?: boolean | null
          repair_successful?: boolean | null
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sys_language_cd: {
        Row: {
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          time_format: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          time_format?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          time_format?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          requires_date_range: boolean | null
          show_percentage: boolean | null
          show_trend: boolean | null
          target_value: number | null
          unit: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
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
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_date_range?: boolean | null
          show_percentage?: boolean | null
          show_trend?: boolean | null
          target_value?: number | null
          unit?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_date_range?: boolean | null
          show_percentage?: boolean | null
          show_trend?: boolean | null
          target_value?: number | null
          unit?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          requires_configuration: boolean | null
          supports_attachments: boolean | null
          supports_rich_content: boolean | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          channel_type?: string | null
          code: string
          color?: string | null
          cost_per_message?: number | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_configuration?: boolean | null
          supports_attachments?: boolean | null
          supports_rich_content?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          channel_type?: string | null
          code?: string
          color?: string | null
          cost_per_message?: number | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_configuration?: boolean | null
          supports_attachments?: boolean | null
          supports_rich_content?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          requires_action: boolean | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          auto_send?: boolean | null
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_action?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          auto_send?: boolean | null
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_action?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_ord_workflow_template_versions: {
        Row: {
          change_description: string | null
          created_at: string | null
          created_by: string | null
          id: string
          template_id: string
          template_snapshot: Json
          version_number: number
        }
        Insert: {
          change_description?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          template_id: string
          template_snapshot: Json
          version_number: number
        }
        Update: {
          change_description?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          template_id?: string
          template_snapshot?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "sys_ord_workflow_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sys_workflow_template_cd"
            referencedColumns: ["template_id"]
          },
        ]
      }
      sys_order_status_cd: {
        Row: {
          allowed_next_statuses: string[] | null
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          allowed_next_statuses?: string[] | null
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          allowed_next_statuses?: string[] | null
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_order_type_cd: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
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
          rec_order: number | null
          rec_status: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_otp_codes: {
        Row: {
          attempts: number | null
          code: string
          created_at: string | null
          created_by: string | null
          created_info: string | null
          expires_at: string
          id: string
          phone: string
          purpose: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          verified_at: string | null
        }
        Insert: {
          attempts?: number | null
          code: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          expires_at: string
          id?: string
          phone: string
          purpose: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          verified_at?: string | null
        }
        Update: {
          attempts?: number | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          expires_at?: string
          id?: string
          phone?: string
          purpose?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      sys_packing_preference_cd: {
        Row: {
          code: string
          consumes_inventory_item: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          display_order: number | null
          icon: string | null
          is_active: boolean
          keywords: string[] | null
          maps_to_packaging_type: string | null
          name: string
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          requires_equipment: string | null
          sustainability_score: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          code: string
          consumes_inventory_item?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean
          keywords?: string[] | null
          maps_to_packaging_type?: string | null
          name: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_equipment?: string | null
          sustainability_score?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          code?: string
          consumes_inventory_item?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          icon?: string | null
          is_active?: boolean
          keywords?: string[] | null
          maps_to_packaging_type?: string | null
          name?: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_equipment?: string | null
          sustainability_score?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_packing_preference_cd_maps_to_packaging_type_fkey"
            columns: ["maps_to_packaging_type"]
            isOneToOne: false
            referencedRelation: "sys_pck_packaging_type_cd"
            referencedColumns: ["code"]
          },
        ]
      }
      sys_payment_gateway_cd: {
        Row: {
          available_for_plans: string[] | null
          code: string
          created_at: string | null
          created_by: string | null
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          requires_api_key: boolean | null
          supported_currencies: string[] | null
          supported_payment_methods: string[] | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          available_for_plans?: string[] | null
          code: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_api_key?: boolean | null
          supported_currencies?: string[] | null
          supported_payment_methods?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          available_for_plans?: string[] | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_api_key?: boolean | null
          supported_currencies?: string[] | null
          supported_payment_methods?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_payment_method_cd: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          is_active: boolean
          is_enabled: boolean
          payment_method_code: string
          payment_method_color1: string | null
          payment_method_color2: string | null
          payment_method_color3: string | null
          payment_method_icon: string | null
          payment_method_image: string | null
          payment_method_name: string | null
          payment_method_name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
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
          payment_method_code: string
          payment_method_color1?: string | null
          payment_method_color2?: string | null
          payment_method_color3?: string | null
          payment_method_icon?: string | null
          payment_method_image?: string | null
          payment_method_name?: string | null
          payment_method_name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
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
          payment_method_code?: string
          payment_method_color1?: string | null
          payment_method_color2?: string | null
          payment_method_color3?: string | null
          payment_method_icon?: string | null
          payment_method_image?: string | null
          payment_method_name?: string | null
          payment_method_name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          allows_retry?: boolean | null
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          allows_retry?: boolean | null
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_payment_type_cd: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          has_plan: boolean
          is_active: boolean
          is_enabled: boolean
          payment_type_code: string
          payment_type_color1: string | null
          payment_type_color2: string | null
          payment_type_color3: string | null
          payment_type_icon: string | null
          payment_type_image: string | null
          payment_type_name: string | null
          payment_type_name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          has_plan?: boolean
          is_active?: boolean
          is_enabled?: boolean
          payment_type_code: string
          payment_type_color1?: string | null
          payment_type_color2?: string | null
          payment_type_color3?: string | null
          payment_type_icon?: string | null
          payment_type_image?: string | null
          payment_type_name?: string | null
          payment_type_name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          has_plan?: boolean
          is_active?: boolean
          is_enabled?: boolean
          payment_type_code?: string
          payment_type_color1?: string | null
          payment_type_color2?: string | null
          payment_type_color3?: string | null
          payment_type_icon?: string | null
          payment_type_image?: string | null
          payment_type_name?: string | null
          payment_type_name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_pck_packaging_type_cd: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          is_active: boolean
          name: string
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
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
          name: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
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
          name?: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_permission_cd: {
        Row: {
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          resource_name: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          resource_name?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          resource_name?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_plan_features_cd: {
        Row: {
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          unit: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          unit?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          unit?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_plan_limits: {
        Row: {
          branches_limit: number
          created_at: string | null
          created_by: string | null
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          storage_mb_limit: number
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
          users_limit: number
        }
        Insert: {
          branches_limit: number
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          storage_mb_limit: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          users_limit: number
        }
        Update: {
          branches_limit?: number
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          storage_mb_limit?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
          users_limit?: number
        }
        Relationships: []
      }
      sys_plan_setting_constraints: {
        Row: {
          constraint_reason: string | null
          constraint_type: string
          constraint_value: Json | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          id: string
          is_active: boolean
          plan_code: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          stng_code: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          constraint_reason?: string | null
          constraint_type: string
          constraint_value?: Json | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          plan_code: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          stng_code: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          constraint_reason?: string | null
          constraint_type?: string
          constraint_value?: Json | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          plan_code?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          stng_code?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          base_price_annual?: number | null
          base_price_monthly?: number | null
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          base_price_annual?: number | null
          base_price_monthly?: number | null
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
      sys_preference_kind_cd: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          description: string | null
          description2: string | null
          icon: string | null
          is_active: boolean
          is_show_for_customer: boolean
          is_show_in_quick_bar: boolean
          kind_bg_color: string | null
          kind_code: string
          main_type_code: string | null
          name: string | null
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
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
          icon?: string | null
          is_active?: boolean
          is_show_for_customer?: boolean
          is_show_in_quick_bar?: boolean
          kind_bg_color?: string | null
          kind_code: string
          main_type_code?: string | null
          name?: string | null
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
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
          icon?: string | null
          is_active?: boolean
          is_show_for_customer?: boolean
          is_show_in_quick_bar?: boolean
          kind_bg_color?: string | null
          kind_code?: string
          main_type_code?: string | null
          name?: string | null
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_qa_decision_type_cd: {
        Row: {
          allows_proceed: boolean | null
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          is_active: boolean
          name: string
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          requires_rework: boolean | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          allows_proceed?: boolean | null
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          name: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_rework?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          allows_proceed?: boolean | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          name?: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_rework?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
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
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          requires_action: boolean | null
          status_type: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          allows_proceed?: boolean | null
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_action?: boolean | null
          status_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          allows_proceed?: boolean | null
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_action?: boolean | null
          status_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_rcpt_delivery_channel_cd: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          is_active: boolean
          name: string
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          requires_api_key: boolean | null
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
          name: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_api_key?: boolean | null
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
          name?: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_api_key?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_rcpt_delivery_status_cd: {
        Row: {
          allows_retry: boolean | null
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          is_active: boolean
          is_final: boolean | null
          name: string
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          allows_retry?: boolean | null
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          is_final?: boolean | null
          name: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          allows_retry?: boolean | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          description2?: string | null
          is_active?: boolean
          is_final?: boolean | null
          name?: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sys_rcpt_receipt_type_cd: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          is_active: boolean
          name: string
          name2: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          supports_bilingual: boolean | null
          supports_qr_code: boolean | null
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
          name: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          supports_bilingual?: boolean | null
          supports_qr_code?: boolean | null
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
          name?: string
          name2?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          supports_bilingual?: boolean | null
          supports_qr_code?: boolean | null
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
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          report_type: string | null
          requires_admin_access: boolean | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          allowed_user_roles?: string[] | null
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          report_type?: string | null
          requires_admin_access?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          allowed_user_roles?: string[] | null
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          report_type?: string | null
          requires_admin_access?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_service_category_cd: {
        Row: {
          code: string
          color: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
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
          updated_info: string | null
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          updated_info?: string | null
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_service_preference_cd: {
        Row: {
          applies_to_fabric_types: string[] | null
          code: string
          color_hex: string | null
          created_at: string | null
          created_by: string | null
          default_extra_price: number | null
          description: string | null
          description2: string | null
          display_order: number | null
          extra_turnaround_minutes: number | null
          icon: string | null
          is_active: boolean
          is_allow_to_show_for_user: boolean | null
          is_color_prefs: boolean | null
          is_incompatible_with: string[] | null
          is_note_prefs: boolean | null
          is_show_in_all_stages: boolean | null
          is_show_in_quick_bar: boolean | null
          is_used_by_system: boolean | null
          keywords: string[] | null
          name: string
          name2: string | null
          preference_category: string
          preference_sys_kind: string
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          sustainability_score: number | null
          system_type_code: string | null
          updated_at: string | null
          updated_by: string | null
          workflow_impact: string | null
        }
        Insert: {
          applies_to_fabric_types?: string[] | null
          code: string
          color_hex?: string | null
          created_at?: string | null
          created_by?: string | null
          default_extra_price?: number | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          extra_turnaround_minutes?: number | null
          icon?: string | null
          is_active?: boolean
          is_allow_to_show_for_user?: boolean | null
          is_color_prefs?: boolean | null
          is_incompatible_with?: string[] | null
          is_note_prefs?: boolean | null
          is_show_in_all_stages?: boolean | null
          is_show_in_quick_bar?: boolean | null
          is_used_by_system?: boolean | null
          keywords?: string[] | null
          name: string
          name2?: string | null
          preference_category: string
          preference_sys_kind?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          sustainability_score?: number | null
          system_type_code?: string | null
          updated_at?: string | null
          updated_by?: string | null
          workflow_impact?: string | null
        }
        Update: {
          applies_to_fabric_types?: string[] | null
          code?: string
          color_hex?: string | null
          created_at?: string | null
          created_by?: string | null
          default_extra_price?: number | null
          description?: string | null
          description2?: string | null
          display_order?: number | null
          extra_turnaround_minutes?: number | null
          icon?: string | null
          is_active?: boolean
          is_allow_to_show_for_user?: boolean | null
          is_color_prefs?: boolean | null
          is_incompatible_with?: string[] | null
          is_note_prefs?: boolean | null
          is_show_in_all_stages?: boolean | null
          is_show_in_quick_bar?: boolean | null
          is_used_by_system?: boolean | null
          keywords?: string[] | null
          name?: string
          name2?: string | null
          preference_category?: string
          preference_sys_kind?: string
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          sustainability_score?: number | null
          system_type_code?: string | null
          updated_at?: string | null
          updated_by?: string | null
          workflow_impact?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sys_svc_pref_kind"
            columns: ["preference_sys_kind"]
            isOneToOne: false
            referencedRelation: "sys_preference_kind_cd"
            referencedColumns: ["kind_code"]
          },
        ]
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
      sys_stng_categories_cd: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          is_active: boolean
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          stng_category_code: string
          stng_category_desc: string | null
          stng_category_desc2: string | null
          stng_category_icon: string | null
          stng_category_name: string
          stng_category_name2: string | null
          stng_category_order: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          stng_category_code: string
          stng_category_desc?: string | null
          stng_category_desc2?: string | null
          stng_category_icon?: string | null
          stng_category_name: string
          stng_category_name2?: string | null
          stng_category_order?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          stng_category_code?: string
          stng_category_desc?: string | null
          stng_category_desc2?: string | null
          stng_category_icon?: string | null
          stng_category_name?: string
          stng_category_name2?: string | null
          stng_category_order?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_stng_profile_values_dtl: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          id: string
          is_active: boolean
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          stng_code: string
          stng_override_reason: string | null
          stng_profile_code: string
          stng_value_jsonb: Json
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          stng_code: string
          stng_override_reason?: string | null
          stng_profile_code: string
          stng_value_jsonb: Json
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          stng_code?: string
          stng_override_reason?: string | null
          stng_profile_code?: string
          stng_value_jsonb?: Json
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_stng_profile_values_dtl_stng_code_fkey"
            columns: ["stng_code"]
            isOneToOne: false
            referencedRelation: "sys_tenant_settings_cd"
            referencedColumns: ["setting_code"]
          },
          {
            foreignKeyName: "sys_stng_profile_values_dtl_stng_code_fkey"
            columns: ["stng_code"]
            isOneToOne: false
            referencedRelation: "v_effective_tenant_settings"
            referencedColumns: ["setting_code"]
          },
          {
            foreignKeyName: "sys_stng_profile_values_dtl_stng_profile_code_fkey"
            columns: ["stng_profile_code"]
            isOneToOne: false
            referencedRelation: "sys_stng_profiles_mst"
            referencedColumns: ["stng_profile_code"]
          },
        ]
      }
      sys_stng_profiles_mst: {
        Row: {
          country_code: string | null
          created_at: string | null
          created_by: string | null
          created_info: string | null
          is_active: boolean
          parent_profile_code: string | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          segment_code: string | null
          stng_profile_code: string
          stng_profile_desc: string | null
          stng_profile_desc2: string | null
          stng_profile_id: string | null
          stng_profile_name: string
          stng_profile_name2: string | null
          stng_profile_version: number | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean
          parent_profile_code?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          segment_code?: string | null
          stng_profile_code: string
          stng_profile_desc?: string | null
          stng_profile_desc2?: string | null
          stng_profile_id?: string | null
          stng_profile_name: string
          stng_profile_name2?: string | null
          stng_profile_version?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean
          parent_profile_code?: string | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          segment_code?: string | null
          stng_profile_code?: string
          stng_profile_desc?: string | null
          stng_profile_desc2?: string | null
          stng_profile_id?: string | null
          stng_profile_name?: string
          stng_profile_name2?: string | null
          stng_profile_version?: number | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_stng_profiles_mst_parent_profile_code_fkey"
            columns: ["parent_profile_code"]
            isOneToOne: false
            referencedRelation: "sys_stng_profiles_mst"
            referencedColumns: ["stng_profile_code"]
          },
        ]
      }
      sys_stng_settings_cd: {
        Row: {
          created_at: string
          created_by: string | null
          created_info: string | null
          is_active: boolean | null
          is_allow_for_branch: boolean
          is_allow_for_service_category: boolean
          is_allow_for_system: boolean
          is_allow_for_tenant_org: boolean
          is_allow_for_user: boolean
          is_for_system_only: boolean
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          setting_code: string
          setting_desc: string
          setting_desc2: string | null
          setting_name: string
          setting_name2: string | null
          stng_allowed_values_json: Json | null
          stng_category_code: string
          stng_data_type: string
          stng_default_value_jsonb: Json | null
          stng_depends_on_flags: Json | null
          stng_is_feature_gated: boolean
          stng_is_overridable: boolean | null
          stng_is_sensitive: boolean | null
          stng_requires_restart: boolean | null
          stng_scope: string
          stng_validation_jsonb: Json | null
          tech_explain_for_developers: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean | null
          is_allow_for_branch?: boolean
          is_allow_for_service_category?: boolean
          is_allow_for_system?: boolean
          is_allow_for_tenant_org?: boolean
          is_allow_for_user?: boolean
          is_for_system_only?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          setting_code: string
          setting_desc: string
          setting_desc2?: string | null
          setting_name: string
          setting_name2?: string | null
          stng_allowed_values_json?: Json | null
          stng_category_code: string
          stng_data_type: string
          stng_default_value_jsonb?: Json | null
          stng_depends_on_flags?: Json | null
          stng_is_feature_gated?: boolean
          stng_is_overridable?: boolean | null
          stng_is_sensitive?: boolean | null
          stng_requires_restart?: boolean | null
          stng_scope: string
          stng_validation_jsonb?: Json | null
          tech_explain_for_developers: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean | null
          is_allow_for_branch?: boolean
          is_allow_for_service_category?: boolean
          is_allow_for_system?: boolean
          is_allow_for_tenant_org?: boolean
          is_allow_for_user?: boolean
          is_for_system_only?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          setting_code?: string
          setting_desc?: string
          setting_desc2?: string | null
          setting_name?: string
          setting_name2?: string | null
          stng_allowed_values_json?: Json | null
          stng_category_code?: string
          stng_data_type?: string
          stng_default_value_jsonb?: Json | null
          stng_depends_on_flags?: Json | null
          stng_is_feature_gated?: boolean
          stng_is_overridable?: boolean | null
          stng_is_sensitive?: boolean | null
          stng_requires_restart?: boolean | null
          stng_scope?: string
          stng_validation_jsonb?: Json | null
          tech_explain_for_developers?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_stng_settings_cd_stng_category_code_fkey"
            columns: ["stng_category_code"]
            isOneToOne: false
            referencedRelation: "sys_stng_categories_cd"
            referencedColumns: ["stng_category_code"]
          },
        ]
      }
      sys_svc_cat_proc_steps: {
        Row: {
          created_at: string | null
          created_by: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          service_category_code: string
          step_code: string
          step_color: string | null
          step_icon: string | null
          step_name: string
          step_name2: string | null
          step_seq: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          service_category_code: string
          step_code: string
          step_color?: string | null
          step_icon?: string | null
          step_name: string
          step_name2?: string | null
          step_seq: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          service_category_code?: string
          step_code?: string
          step_color?: string | null
          step_icon?: string | null
          step_name?: string
          step_name2?: string | null
          step_seq?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sys_steps_category"
            columns: ["service_category_code"]
            isOneToOne: false
            referencedRelation: "sys_service_category_cd"
            referencedColumns: ["service_category_code"]
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
          created_by: string | null
          created_info: string | null
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
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          tenant_org_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          churn_prediction_score?: number | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          tenant_org_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          churn_prediction_score?: number | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
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
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          tenant_org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_tenant_lifecycle_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: true
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_tenant_lifecycle_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: true
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "sys_tenant_lifecycle_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: true
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
          created_by: string | null
          created_info: string | null
          id: string
          metric_date: string
          new_customers: number | null
          orders_cancelled: number | null
          orders_completed: number | null
          orders_created: number | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          revenue: number | null
          storage_mb_used: number | null
          tenant_org_id: string
          total_logins: number | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          active_customers?: number | null
          active_users?: number | null
          api_calls?: number | null
          avg_order_value?: number | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          metric_date: string
          new_customers?: number | null
          orders_cancelled?: number | null
          orders_completed?: number | null
          orders_created?: number | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          revenue?: number | null
          storage_mb_used?: number | null
          tenant_org_id: string
          total_logins?: number | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          active_customers?: number | null
          active_users?: number | null
          api_calls?: number | null
          avg_order_value?: number | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          metric_date?: string
          new_customers?: number | null
          orders_cancelled?: number | null
          orders_completed?: number | null
          orders_created?: number | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          revenue?: number | null
          storage_mb_used?: number | null
          tenant_org_id?: string
          total_logins?: number | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_tenant_metrics_daily_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_tenant_metrics_daily_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "sys_tenant_metrics_daily_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
          setting_desc2: string | null
          setting_name: string | null
          setting_name2: string | null
          setting_value: string | null
          setting_value_type: string | null
          stng_allows_null: boolean
          stng_category_code: string | null
          stng_data_type: string | null
          stng_default_value_jsonb: Json | null
          stng_depends_on_flags: Json | null
          stng_display_order: number | null
          stng_edit_policy: string
          stng_is_overridable: boolean | null
          stng_is_required: boolean
          stng_is_sensitive: boolean | null
          stng_required_min_layer: string | null
          stng_requires_restart: boolean | null
          stng_scope: string | null
          stng_ui_component: string | null
          stng_ui_group: string | null
          stng_validation_jsonb: Json | null
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
          setting_desc2?: string | null
          setting_name?: string | null
          setting_name2?: string | null
          setting_value?: string | null
          setting_value_type?: string | null
          stng_allows_null?: boolean
          stng_category_code?: string | null
          stng_data_type?: string | null
          stng_default_value_jsonb?: Json | null
          stng_depends_on_flags?: Json | null
          stng_display_order?: number | null
          stng_edit_policy?: string
          stng_is_overridable?: boolean | null
          stng_is_required?: boolean
          stng_is_sensitive?: boolean | null
          stng_required_min_layer?: string | null
          stng_requires_restart?: boolean | null
          stng_scope?: string | null
          stng_ui_component?: string | null
          stng_ui_group?: string | null
          stng_validation_jsonb?: Json | null
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
          setting_desc2?: string | null
          setting_name?: string | null
          setting_name2?: string | null
          setting_value?: string | null
          setting_value_type?: string | null
          stng_allows_null?: boolean
          stng_category_code?: string | null
          stng_data_type?: string | null
          stng_default_value_jsonb?: Json | null
          stng_depends_on_flags?: Json | null
          stng_display_order?: number | null
          stng_edit_policy?: string
          stng_is_overridable?: boolean | null
          stng_is_required?: boolean
          stng_is_sensitive?: boolean | null
          stng_required_min_layer?: string | null
          stng_requires_restart?: boolean | null
          stng_scope?: string | null
          stng_ui_component?: string | null
          stng_ui_group?: string | null
          stng_validation_jsonb?: Json | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_tenant_settings_cd_stng_category_code_fkey"
            columns: ["stng_category_code"]
            isOneToOne: false
            referencedRelation: "sys_stng_categories_cd"
            referencedColumns: ["stng_category_code"]
          },
        ]
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
          created_by: string | null
          created_info: string | null
          is_active: boolean
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          template_code: string
          template_desc: string | null
          template_id: string
          template_name: string
          template_name2: string | null
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          template_code: string
          template_desc?: string | null
          template_id?: string
          template_name: string
          template_name2?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          is_active?: boolean
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          template_code?: string
          template_desc?: string | null
          template_id?: string
          template_name?: string
          template_name2?: string | null
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Relationships: []
      }
      sys_workflow_template_stages: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_info: string | null
          id: string
          is_active: boolean | null
          is_terminal: boolean | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          seq_no: number
          stage_code: string
          stage_name: string
          stage_name2: string | null
          stage_type: string
          template_id: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean | null
          is_terminal?: boolean | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          seq_no: number
          stage_code: string
          stage_name: string
          stage_name2?: string | null
          stage_type: string
          template_id: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          id?: string
          is_active?: boolean | null
          is_terminal?: boolean | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          seq_no?: number
          stage_code?: string
          stage_name?: string
          stage_name2?: string | null
          stage_type?: string
          template_id?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          created_by: string | null
          created_info: string | null
          from_stage_code: string
          id: string
          is_active: boolean | null
          rec_notes: string | null
          rec_order: number | null
          rec_status: number | null
          requires_invoice: boolean | null
          requires_pod: boolean | null
          requires_scan_ok: boolean | null
          template_id: string
          to_stage_code: string
          updated_at: string | null
          updated_by: string | null
          updated_info: string | null
        }
        Insert: {
          allow_manual?: boolean | null
          auto_when_done?: boolean | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          from_stage_code: string
          id?: string
          is_active?: boolean | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_invoice?: boolean | null
          requires_pod?: boolean | null
          requires_scan_ok?: boolean | null
          template_id: string
          to_stage_code: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
        }
        Update: {
          allow_manual?: boolean | null
          auto_when_done?: boolean | null
          created_at?: string | null
          created_by?: string | null
          created_info?: string | null
          from_stage_code?: string
          id?: string
          is_active?: boolean | null
          rec_notes?: string | null
          rec_order?: number | null
          rec_status?: number | null
          requires_invoice?: boolean | null
          requires_pod?: boolean | null
          requires_scan_ok?: boolean | null
          template_id?: string
          to_stage_code?: string
          updated_at?: string | null
          updated_by?: string | null
          updated_info?: string | null
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
          {
            foreignKeyName: "org_users_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "org_users_mst_tenant_org_id_fkey"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
            foreignKeyName: "fk_status_history_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_status_history_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
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
      vw_fin_coa_explorer: {
        Row: {
          acc_group_id: string | null
          acc_group_name: string | null
          acc_group_name2: string | null
          acc_type_code: string | null
          acc_type_id: string | null
          acc_type_name: string | null
          acc_type_name2: string | null
          account_code: string | null
          account_id: string | null
          account_level: number | null
          account_status: string | null
          active_usage_map_count: number | null
          allow_tenant_children: boolean | null
          created_at: string | null
          created_by: string | null
          description: string | null
          description2: string | null
          effective_from: string | null
          effective_to: string | null
          full_path: string | null
          full_path2: string | null
          is_active: boolean | null
          is_control_account: boolean | null
          is_locked: boolean | null
          is_postable: boolean | null
          is_system_linked: boolean | null
          is_system_seeded: boolean | null
          manual_post_allowed: boolean | null
          name: string | null
          name2: string | null
          normal_balance_side: string | null
          parent_account_code: string | null
          parent_account_id: string | null
          parent_account_name: string | null
          parent_account_name2: string | null
          rec_status: number | null
          source_tpl_line_id: string | null
          source_tpl_pkg_id: string | null
          tenant_org_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofa_group"
            columns: ["acc_group_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_acc_group_cd"
            referencedColumns: ["acc_group_id"]
          },
          {
            foreignKeyName: "fk_ofa_parent"
            columns: ["parent_account_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_acct_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofa_parent"
            columns: ["parent_account_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_coa_explorer"
            referencedColumns: ["account_id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofa_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofa_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofa_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofa_tplline"
            columns: ["source_tpl_line_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_coa_tpl_dtl"
            referencedColumns: ["coa_tpl_line_id"]
          },
          {
            foreignKeyName: "fk_ofa_tplpkg"
            columns: ["source_tpl_pkg_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_tpl_pkg_mst"
            referencedColumns: ["tpl_pkg_id"]
          },
          {
            foreignKeyName: "fk_ofa_type"
            columns: ["acc_type_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_acc_type_cd"
            referencedColumns: ["acc_type_id"]
          },
        ]
      }
      vw_fin_effective_gov_for_tenant: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assign_effective_from: string | null
          assign_effective_to: string | null
          assignment_id: string | null
          assignment_mode: string | null
          compat_version: string | null
          pkg_code: string | null
          pkg_effective_from: string | null
          pkg_effective_to: string | null
          pkg_id: string | null
          pkg_status_code: string | null
          pkg_version: number | null
          tenant_org_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofga_pkg"
            columns: ["pkg_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_gov_pkg_mst"
            referencedColumns: ["pkg_id"]
          },
          {
            foreignKeyName: "fk_ofga_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofga_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofga_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
        ]
      }
      vw_fin_missing_required_usage: {
        Row: {
          effective_from: string | null
          effective_to: string | null
          is_required: boolean | null
          mapped_acc_type_code: string | null
          mapped_account_code: string | null
          mapped_account_id: string | null
          mapped_account_name: string | null
          mapping_id: string | null
          mapping_issue: string | null
          mapping_status: string | null
          required_acc_type_code: string | null
          required_acc_type_name: string | null
          tenant_org_id: string | null
          usage_code: string | null
          usage_code_id: string | null
          usage_code_name: string | null
          usage_code_name2: string | null
        }
        Relationships: []
      }
      vw_fin_open_exceptions: {
        Row: {
          attempt_no: number | null
          attempt_status_code: string | null
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          error_message: string | null
          exception_id: string | null
          exception_type_code: string | null
          idempotency_key: string | null
          is_repost_eligible: boolean | null
          is_retry_eligible: boolean | null
          journal_id: string | null
          log_error_code: string | null
          log_status_code: string | null
          mapping_rule_id: string | null
          mapping_rule_version_no: number | null
          posting_log_id: string | null
          repost_of_log_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          retry_of_log_id: string | null
          source_doc_id: string | null
          source_doc_no: string | null
          source_doc_type_code: string | null
          source_module_code: string | null
          status_code: string | null
          tenant_org_id: string | null
          txn_event_code: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ofpe_branch"
            columns: ["branch_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_branches_mst"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpe_evt"
            columns: ["txn_event_code"]
            isOneToOne: false
            referencedRelation: "sys_fin_evt_cd"
            referencedColumns: ["evt_code"]
          },
          {
            foreignKeyName: "fk_ofpe_log"
            columns: ["posting_log_id", "tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_fin_post_log_tr"
            referencedColumns: ["id", "tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpe_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "org_tenants_mst"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ofpe_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_missing_required_usage"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpe_tenant"
            columns: ["tenant_org_id"]
            isOneToOne: false
            referencedRelation: "vw_fin_tenant_readiness"
            referencedColumns: ["tenant_org_id"]
          },
          {
            foreignKeyName: "fk_ofpl_rule"
            columns: ["mapping_rule_id"]
            isOneToOne: false
            referencedRelation: "sys_fin_map_rule_mst"
            referencedColumns: ["rule_id"]
          },
        ]
      }
      vw_fin_tenant_readiness: {
        Row: {
          has_gov_assignment: boolean | null
          inactive_coa_accounts: number | null
          last_apply_status: string | null
          last_failed_at: string | null
          last_posted_at: string | null
          last_template_applied_at: string | null
          last_template_pkg_code: string | null
          missing_required_mappings: number | null
          open_exception_count: number | null
          open_period_count: number | null
          postable_coa_accounts: number | null
          readiness_status: string | null
          tenant_org_id: string | null
          total_coa_accounts: number | null
          total_required_mappings: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_fin_tpl_for_tnt: {
        Args: {
          p_apply_mode?: string
          p_tenant_id: string
          p_tpl_pkg_id?: string
        }
        Returns: number
      }
      auto_unlock_expired_accounts: {
        Args: never
        Returns: {
          unlocked_count: number
        }[]
      }
      calculate_ready_by_with_preferences: {
        Args: {
          p_base_turnaround_hours: number
          p_order_id: string
          p_tenant_org_id: string
        }
        Returns: string
      }
      check_code_table_references: {
        Args: { p_record_code: string; p_table_name: string }
        Returns: {
          reference_count: number
          referencing_column: string
          referencing_table: string
        }[]
      }
      check_jwt_claims_jh: {
        Args: never
        Returns: {
          auth_uid: string
          current_tenant_id_fn: string
          current_tenant_id_result: string
          current_user_id_fn: string
          current_user_role_fn: string
          has_tenant_claim: boolean
          jwt_sub: string
          jwt_tenant_org_id: string
        }[]
      }
      check_rbac_migration_status: {
        Args: never
        Returns: {
          has_rbac_role: boolean
          old_role: string
          rbac_roles: string[]
          tenant_org_id: string
          user_id: string
        }[]
      }
      cleanup_expired_order_edit_locks: { Args: never; Returns: number }
      cleanup_expired_otp_codes: { Args: never; Returns: number }
      cmx_can: {
        Args: {
          p_auth_user_id?: string
          p_is_user_id_org_or_auth?: number
          p_org_user_id?: string
          p_perm: string
          p_resource_id?: string
          p_resource_type?: string
          p_role_code?: string
          p_tenant_org_id?: string
        }
        Returns: boolean
      }
      cmx_fix_admin_role_permissions: {
        Args: never
        Returns: {
          inserted_count: number
          inserted_permissions: Json
          updated_count: number
          updated_permissions: Json
        }[]
      }
      cmx_get_allowed_transitions: {
        Args: { p_from?: string; p_order: string; p_tenant: string }
        Returns: Json
      }
      cmx_ord_assembly_pre_conditions: { Args: never; Returns: Json }
      cmx_ord_assembly_transition: {
        Args: {
          p_expected_updated_at?: string
          p_idempotency_key?: string
          p_input?: Json
          p_order_id: string
          p_tenant_org_id: string
          p_to_status: string
          p_user_id: string
        }
        Returns: Json
      }
      cmx_ord_canceling_pre_conditions: { Args: never; Returns: Json }
      cmx_ord_canceling_transition: {
        Args: {
          p_expected_updated_at?: string
          p_idempotency_key?: string
          p_input?: Json
          p_order_id: string
          p_tenant_org_id: string
          p_user_id: string
        }
        Returns: Json
      }
      cmx_ord_driver_delivery_pre_conditions: { Args: never; Returns: Json }
      cmx_ord_driver_delivery_transition: {
        Args: {
          p_expected_updated_at?: string
          p_idempotency_key?: string
          p_input?: Json
          p_order_id: string
          p_tenant_org_id: string
          p_user_id: string
        }
        Returns: Json
      }
      cmx_ord_execute_transition: {
        Args: {
          p_expected_updated_at?: string
          p_from_status: string
          p_idempotency_key?: string
          p_input?: Json
          p_order_id: string
          p_screen: string
          p_tenant_org_id: string
          p_to_status: string
          p_user_id: string
        }
        Returns: Json
      }
      cmx_ord_new_order_pre_conditions: { Args: never; Returns: Json }
      cmx_ord_new_order_transition: {
        Args: {
          p_expected_updated_at?: string
          p_idempotency_key?: string
          p_input?: Json
          p_order_id: string
          p_tenant_org_id: string
          p_user_id: string
        }
        Returns: Json
      }
      cmx_ord_order_live_metrics: {
        Args: { p_order_id: string; p_tenant_org_id: string }
        Returns: Json
      }
      cmx_ord_order_workflow_flags: {
        Args: { p_order_id: string; p_tenant_org_id: string }
        Returns: Json
      }
      cmx_ord_packing_pre_conditions: { Args: never; Returns: Json }
      cmx_ord_packing_transition: {
        Args: {
          p_expected_updated_at?: string
          p_idempotency_key?: string
          p_input?: Json
          p_order_id: string
          p_tenant_org_id: string
          p_user_id: string
        }
        Returns: Json
      }
      cmx_ord_preparation_pre_conditions: { Args: never; Returns: Json }
      cmx_ord_preparation_transition: {
        Args: {
          p_expected_updated_at?: string
          p_idempotency_key?: string
          p_input?: Json
          p_order_id: string
          p_tenant_org_id: string
          p_user_id: string
        }
        Returns: Json
      }
      cmx_ord_processing_pre_conditions: { Args: never; Returns: Json }
      cmx_ord_processing_transition: {
        Args: {
          p_expected_updated_at?: string
          p_idempotency_key?: string
          p_input?: Json
          p_order_id: string
          p_tenant_org_id: string
          p_to_status: string
          p_user_id: string
        }
        Returns: Json
      }
      cmx_ord_qa_pre_conditions: { Args: never; Returns: Json }
      cmx_ord_qa_transition: {
        Args: {
          p_expected_updated_at?: string
          p_idempotency_key?: string
          p_input?: Json
          p_order_id: string
          p_tenant_org_id: string
          p_to_status: string
          p_user_id: string
        }
        Returns: Json
      }
      cmx_ord_ready_release_pre_conditions: { Args: never; Returns: Json }
      cmx_ord_ready_release_transition: {
        Args: {
          p_expected_updated_at?: string
          p_idempotency_key?: string
          p_input?: Json
          p_order_id: string
          p_tenant_org_id: string
          p_to_status: string
          p_user_id: string
        }
        Returns: Json
      }
      cmx_ord_returning_pre_conditions: { Args: never; Returns: Json }
      cmx_ord_returning_transition: {
        Args: {
          p_expected_updated_at?: string
          p_idempotency_key?: string
          p_input?: Json
          p_order_id: string
          p_tenant_org_id: string
          p_user_id: string
        }
        Returns: Json
      }
      cmx_ord_screen_pre_conditions: {
        Args: { p_screen: string }
        Returns: Json
      }
      cmx_ord_validate_transition_basic: {
        Args: {
          p_from_status: string
          p_order_id: string
          p_tenant_org_id: string
          p_to_status: string
        }
        Returns: Json
      }
      cmx_ord_workboard_pre_conditions: { Args: never; Returns: Json }
      cmx_order_items_transition: {
        Args: {
          p_from: string
          p_item_id?: string
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
      current_tenant_id: { Args: never; Returns: string }
      current_user_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      deduct_retail_stock_for_order: {
        Args: {
          p_branch_id?: string
          p_order_id: string
          p_reason?: string
          p_reference_id?: string
          p_reference_no?: string
          p_reference_type?: string
          p_tenant_org_id: string
          p_user_agent?: string
          p_user_browser?: string
          p_user_device?: string
          p_user_id?: string
          p_user_info?: string
          p_user_ip?: string
          p_user_name?: string
          p_user_os?: string
        }
        Returns: undefined
      }
      extract_order_sequence: { Args: { p_order_no: string }; Returns: number }
      fix_order_data: {
        Args: {
          p_dry_run?: boolean
          p_order_id?: string
          p_steps?: string[]
          p_tenant_org_id?: string
        }
        Returns: Json
      }
      fn_fin_code_lvl: { Args: { p_code: string }; Returns: number }
      fn_fin_prnt_code: { Args: { p_code: string }; Returns: string }
      fn_get_setting_value: {
        Args: { p_setting_code: string; p_tenant_org_id: string }
        Returns: Json
      }
      fn_is_setting_allowed: {
        Args: { p_setting_code: string; p_tenant_org_id: string }
        Returns: boolean
      }
      fn_next_fin_doc_no: {
        Args: { p_doc_type_code: string; p_tenant_org_id: string }
        Returns: string
      }
      fn_next_order_item_srno: {
        Args: { p_order: string; p_tenant: string }
        Returns: string
      }
      fn_recalc_order_totals: {
        Args: { p_order: string; p_tenant: string }
        Returns: undefined
      }
      fn_stng_compute_cache_hash: {
        Args: { p_branch_id?: string; p_tenant_id: string; p_user_id?: string }
        Returns: string
      }
      fn_stng_explain_setting: {
        Args: {
          p_branch_id?: string
          p_setting_code: string
          p_tenant_id: string
          p_user_id?: string
        }
        Returns: {
          applied: boolean
          layer_name: string
          layer_order: number
          layer_priority: number
          layer_value: Json
          reason: string
          source_id: string
        }[]
      }
      fn_stng_get_profile_chain: {
        Args: { p_profile_code: string }
        Returns: string[]
      }
      fn_stng_invalidate_cache: {
        Args: { p_scope?: string; p_tenant_id: string }
        Returns: number
      }
      fn_stng_resolve_all_settings: {
        Args: { p_branch_id?: string; p_tenant_id: string; p_user_id?: string }
        Returns: {
          stng_code: string
          stng_computed_at: string
          stng_source_id: string
          stng_source_layer: string
          stng_value_jsonb: Json
        }[]
      }
      fn_stng_resolve_setting_value: {
        Args: {
          p_branch_id?: string
          p_setting_code: string
          p_tenant_id: string
          p_user_id?: string
        }
        Returns: {
          stng_code: string
          stng_computed_at: string
          stng_source_id: string
          stng_source_layer: string
          stng_value_jsonb: Json
        }[]
      }
      fn_stng_resolve_setting_value_debug: {
        Args: {
          p_branch_id?: string
          p_setting_code: string
          p_tenant_id: string
          p_user_id?: string
        }
        Returns: {
          current_value: Json
          source_id: string
          source_layer: string
          step_desc: string
          step_no: number
        }[]
      }
      fn_stng_update_cache: {
        Args: { p_branch_id?: string; p_tenant_id: string; p_user_id?: string }
        Returns: boolean
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
      get_jwt_tenant_health_metrics: {
        Args: { p_end_time?: string; p_start_time?: string }
        Returns: {
          coverage_rate: number
          events_with_auth_user: number
          events_with_org_user: number
          events_with_tenant: number
          events_without_auth_user: number
          events_without_org_user: number
          events_without_tenant: number
          repair_attempts: number
          repair_failures: number
          repair_success_rate: number
          repair_successes: number
          total_events: number
        }[]
      }
      get_last_order_preferences: {
        Args: { p_customer_id: string; p_tenant_org_id: string }
        Returns: {
          packing_pref_code: string
          product_id: string
          service_category_code: string
          service_pref_codes: string[]
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
      get_next_order_edit_number: {
        Args: { p_order_id: string }
        Returns: number
      }
      get_order_edit_summary: {
        Args: { p_order_id: string }
        Returns: {
          edit_count: number
          last_edited_at: string
          last_edited_by_name: string
          total_payment_adjustments: number
        }[]
      }
      get_order_number_prefix: { Args: never; Returns: string }
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
      get_product_price_with_tax: {
        Args: {
          p_customer_id?: string
          p_effective_date?: string
          p_price_list_type?: string
          p_product_id: string
          p_quantity?: number
          p_tenant_org_id: string
        }
        Returns: {
          base_price: number
          discount_percent: number
          final_price: number
          price_list_id: string
          price_list_item_id: string
          price_list_name: string
          quantity_tier_max: number
          quantity_tier_min: number
          source: string
          tax_amount: number
          tax_rate: number
          total: number
        }[]
      }
      get_role_permissions_jh: {
        Args: { p_role_code?: string }
        Returns: {
          permission_code: string
          resource_id: string
          resource_type: string
        }[]
      }
      get_user_permissions: {
        Args: never
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
        Args: never
        Returns: {
          role_code: string
          role_name: string
        }[]
      }
      get_user_tenants: {
        Args: never
        Returns: {
          is_active: boolean
          last_login_at: string
          org_user_id: string
          s_current_plan: string
          tenant_id: string
          tenant_name: string
          tenant_slug: string
          user_id: string
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
          s_current_plan: string
          tenant_id: string
          tenant_name: string
          tenant_slug: string
          user_id: string
          user_role: string
        }[]
      }
      get_user_workflow_roles: {
        Args: never
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
      has_permission: { Args: { p_permission: string }; Returns: boolean }
      has_resource_permission: {
        Args: {
          p_permission: string
          p_resource_id: string
          p_resource_type: string
        }
        Returns: boolean
      }
      has_tenant_access: { Args: { p_tenant_id: string }; Returns: boolean }
      has_unresolved_issues: {
        Args: { p_order_item_id: string }
        Returns: boolean
      }
      has_workflow_role: { Args: { p_workflow_role: string }; Returns: boolean }
      hq_crm_marketing_lead_code_fallback_random: {
        Args: never
        Returns: string
      }
      hq_crm_marketing_lead_code_next: { Args: never; Returns: string }
      hq_crm_marketing_upsert_visitor_session: {
        Args: {
          p_allow_event_append?: boolean
          p_append_events?: Json
          p_events_max_items?: number
          p_payload: Json
        }
        Returns: {
          id: string
          last_seen_at: string
          lead_id: string
          max_scroll_pct: number
          out_session_id: string
          page_views: number
          total_dwell_ms: number
          tracking_level: number
        }[]
      }
      hq_ff_get_effective_value: {
        Args: { p_flag_key: string; p_tenant_id: string }
        Returns: {
          override_id: string
          plan_code: string
          plan_specific: boolean
          source: string
          value: Json
        }[]
      }
      hq_ff_get_effective_values_batch: {
        Args: { p_flag_keys?: string[]; p_tenant_id: string }
        Returns: Json
      }
      hq_ff_get_plan_defaults: {
        Args: { p_flag_keys?: string[]; p_plan_code: string }
        Returns: Json
      }
      hq_ff_validate_value: {
        Args: { p_flag_key: string; p_value: Json }
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
      is_admin: { Args: never; Returns: boolean }
      is_item_all_steps_done: {
        Args: { p_order_item_id: string }
        Returns: boolean
      }
      is_operator: { Args: never; Returns: boolean }
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
      log_jwt_tenant_health_event: {
        Args: {
          p_auth_user_id?: string
          p_error_message?: string
          p_event_type: string
          p_had_tenant_context: boolean
          p_metadata?: Json
          p_org_user_id?: string
          p_repair_attempted?: boolean
          p_repair_successful?: boolean
          p_tenant_id?: string
          p_user_id: string
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
        Args: never
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
      resolve_fin_tpl_for_tnt: {
        Args: { p_tenant_id: string }
        Returns: {
          match_mode: string
          tpl_pkg_code: string
          tpl_pkg_id: string
          version_no: number
        }[]
      }
      resolve_item_preferences: {
        Args: {
          p_customer_id: string
          p_product_code: string
          p_service_category_code: string
          p_tenant_org_id: string
        }
        Returns: {
          preference_code: string
          source: string
        }[]
      }
      seed_tenant_customer_categories: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      seed_tenant_erp_lite_defaults: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      seed_tenant_packing_preferences: {
        Args: {
          p_include_pricing?: boolean
          p_mode?: string
          p_selected_codes?: string[]
          p_tenant_id: string
          p_top_n?: number
        }
        Returns: {
          inserted: number
          skipped: number
          total: number
        }[]
      }
      seed_tenant_pref_kinds: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      seed_tenant_preference_bundles: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      seed_tenant_preference_kinds: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      seed_tenant_service_preferences: {
        Args: {
          p_branch_id?: string
          p_include_pricing?: boolean
          p_mode?: string
          p_selected_codes?: string[]
          p_tenant_id: string
          p_top_n?: number
        }
        Returns: {
          inserted: number
          skipped: number
          total: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      suggest_preferences_from_history: {
        Args: {
          p_customer_id: string
          p_limit?: number
          p_product_code?: string
          p_service_category_code?: string
          p_tenant_org_id: string
        }
        Returns: {
          preference_code: string
          usage_count: number
        }[]
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
      sys_bill_generate_invoice_number: { Args: never; Returns: string }
      sys_bill_get_default_payment_method: { Args: never; Returns: string }
      test_assert: {
        Args: { condition: boolean; message?: string }
        Returns: undefined
      }
      test_assert_equals: {
        Args: { actual: unknown; expected: unknown; message?: string }
        Returns: undefined
      }
      test_assert_jsonb_equals: {
        Args: { actual: Json; expected: Json; message?: string }
        Returns: undefined
      }
      test_assert_jsonb_has_key: {
        Args: { jsonb_value: Json; key_name: string; message?: string }
        Returns: undefined
      }
      test_assert_not_null: {
        Args: { message?: string; value: unknown }
        Returns: undefined
      }
      unlock_account: {
        Args: { p_admin_user_id: string; p_reason?: string; p_user_id: string }
        Returns: boolean
      }
      validate_fin_tpl_for_tnt: {
        Args: { p_tenant_id: string; p_tpl_pkg_id?: string }
        Returns: {
          issue_code: string
          issue_text: string
          severity_code: string
        }[]
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

