import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  async check(): Promise<{ status: string }> {
    return { status: 'ok' };
  }
}
