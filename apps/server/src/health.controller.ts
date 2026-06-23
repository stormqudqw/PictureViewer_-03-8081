import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('/')
  root() {
    return { service: 'altay-logistik-api', status: 'ok' };
  }

  @Get('/health')
  health() {
    return { status: 'ok', time: new Date().toISOString() };
  }
}
