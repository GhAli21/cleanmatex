import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly config: ConfigService) {}

  async refresh(refreshToken: string): Promise<TokenResponse> {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const supabaseKey = this.config.get<string>('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseKey) {
      throw new UnauthorizedException('Auth not configured');
    }
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const session = data.session;
    return {
      accessToken: session.access_token,
      expiresIn: session.expires_in ?? 3600,
      refreshToken: session.refresh_token,
    };
  }
}
