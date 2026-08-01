import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Campaign } from './entities/campaign.entity';
import { CampaignMessage } from './entities/campaign-message.entity';
import { Contact } from '../campaign-contacts/entities/contact.entity';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { CampaignMessageProcessor } from './campaign-message.processor';
import { AuthModule } from '../auth/auth.module';
import { CAMPAIGN_QUEUE_NAME } from './campaign-queue.constants';
import { HumanEmulationEngine } from '../../common/stealth/human-emulation.engine';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign, CampaignMessage, Contact], 'data'),
    // BullModule.forRootAsync is already registered globally by QueueModule – just register the queue.
    BullModule.registerQueue({
      name: CAMPAIGN_QUEUE_NAME,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'fixed', delay: 300000 }, // 5-min retry
        removeOnComplete: { age: 86400, count: 10000 },
        removeOnFail: { age: 604800, count: 10000 },
      },
    }),
    BullBoardModule.forFeature({
      name: CAMPAIGN_QUEUE_NAME,
      adapter: BullMQAdapter,
    }),
    AuthModule,
  ],
  providers: [
    CampaignsService,
    CampaignMessageProcessor,
    HumanEmulationEngine, // 🧠 Human Emulation Engine — Anti-ban stealth system
  ],
  controllers: [CampaignsController],
  exports: [CampaignsService],
})
export class CampaignsModule {}
