import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

@Injectable()
export class SupabaseAdminService implements OnModuleDestroy {
  private client: SupabaseClient<Database> | null = null;

  constructor(private readonly config: ConfigService) {}

  getClient(): SupabaseClient<Database> {
    if (!this.client) {
      const url = this.config.get<string>('SUPABASE_URL');
      const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !key) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
      }
      this.client = createClient<Database>(url, key, {
        auth: { persistSession: false },
      });
    }
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    this.client = null;
  }
}
