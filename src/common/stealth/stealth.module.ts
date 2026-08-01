/**
 * NestJS module that provides the HumanEmulationEngine to the entire app.
 * Import this module in app.module.ts or campaigns.module.ts.
 */

import { Module, Global } from '@nestjs/common';
import { HumanEmulationEngine } from './human-emulation.engine';

@Global()
@Module({
  providers: [HumanEmulationEngine],
  exports: [HumanEmulationEngine],
})
export class StealthModule {}
