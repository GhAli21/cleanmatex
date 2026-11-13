import { Module, Global } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { IdempotencyStore } from './services/idempotency.store';
import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor';
import { StaffSessionService } from './session/staff-session.service';
import { TenantGuard } from './guards/tenant.guard';

@Global()
@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    IdempotencyStore,
    IdempotencyInterceptor,
    StaffSessionService,
    TenantGuard,
  ],
  exports: [IdempotencyStore, IdempotencyInterceptor, StaffSessionService, TenantGuard],
})
export class CommonModule {}
