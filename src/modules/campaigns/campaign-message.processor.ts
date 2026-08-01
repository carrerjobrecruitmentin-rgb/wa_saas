import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignsService } from './campaigns.service';
import { Campaign, CampaignStatus } from './entities/campaign.entity';
import { CampaignMessage, CampaignMessageStatus } from './entities/campaign-message.entity';
import { createLogger } from '../../common/services/logger.service';
import { workerConnectionOptions } from '../queue/redis-connection';
import { CAMPAIGN_QUEUE_NAME } from './campaign-queue.constants';
import { HumanEmulationEngine, DEFAULT_HUMAN_EMULATION_CONFIG } from '../../common/stealth/human-emulation.engine';

export interface CampaignJobData {
  campaignMessageId: string;
  campaignId: string;
  sessionId: string;
  mobile: string;
  messageText: string;
  minDelayMs: number;
  maxDelayMs: number;
  /** Which position is this message in the campaign (0-indexed) — used for batch breaks */
  jobIndex?: number;
}

@Injectable()
@Processor(CAMPAIGN_QUEUE_NAME, {
  concurrency: parseInt(process.env.CAMPAIGN_WORKERS ?? '3', 10),
  connection: workerConnectionOptions(),
})
export class CampaignMessageProcessor extends WorkerHost {
  private readonly logger = createLogger('CampaignMessageProcessor');

  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly humanEngine: HumanEmulationEngine,
    @InjectRepository(Campaign, 'data')
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(CampaignMessage, 'data')
    private readonly messageRepo: Repository<CampaignMessage>,
  ) {
    super();
  }

  async process(job: Job<CampaignJobData>): Promise<void> {
    const {
      campaignMessageId,
      campaignId,
      sessionId,
      mobile,
      messageText,
      minDelayMs,
      maxDelayMs,
      jobIndex = 0,
    } = job.data;

    // ── Check if campaign is still running ────────────────────────────────────
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign || campaign.status === CampaignStatus.PAUSED) {
      this.logger.warn('Campaign paused, skipping job', { campaignId, jobId: job.id });
      throw new Error('Campaign is paused — job will be retried');
    }
    if (campaign.status === CampaignStatus.FAILED) {
      this.logger.warn('Campaign failed/cancelled, dropping job', { campaignId });
      return;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 🧠 HUMAN EMULATION ENGINE — Pre-Send Flow
    //
    // This single call handles:
    //   1. Circadian Rhythm  → wait for working hours if it's night time
    //   2. Batch Break       → long pause every N messages
    //   3. Spintax           → resolve {Hi|Hello} variations
    //   4. Human Delay       → time-of-day aware random delay
    // ══════════════════════════════════════════════════════════════════════════
    let finalMessage: string;
    try {
      finalMessage = await this.humanEngine.preSendFlow({
        messageTemplate: messageText,
        jobIndex,
        mobile,
        config: DEFAULT_HUMAN_EMULATION_CONFIG,
        overrideMinMs: minDelayMs,
        overrideMaxMs: maxDelayMs,
      });
    } catch (err) {
      // If human engine fails (e.g. sleep was interrupted), use original message
      this.logger.warn('HumanEmulationEngine.preSendFlow error (non-fatal)', { err: String(err) });
      finalMessage = messageText;
    }

    // ── Mark as queued ────────────────────────────────────────────────────────
    await this.messageRepo.update(campaignMessageId, {
      status: CampaignMessageStatus.QUEUED,
    });

    const apiKey = ((): string => {
      try {
        // ALWAYS prioritize the bootstrap master key file first because the env var might be stale/revoked
        return require('fs')
          .readFileSync(require('path').join(process.cwd(), 'data', '.api-key'), 'utf-8')
          .trim();
      } catch {
        return process.env.API_MASTER_KEY || process.env.OPENWA_API_KEY || '';
      }
    })();
    const apiBase = process.env.OPENWA_API_BASE ?? 'http://localhost:2785';
    const chatId = mobile.includes('@') ? mobile : `${mobile}@c.us`;

    // ── Validate number is on WhatsApp before sending ─────────────────────────
    const isRegistered = await this.isWhatsAppNumber(apiBase, apiKey, sessionId, chatId);
    if (!isRegistered) {
      const reason = 'Number is not registered on WhatsApp — skipped';
      this.logger.warn(reason, { mobile });
      await this.campaignsService.markFailed(campaignMessageId, reason, job.attemptsMade);
      await this.campaignsService.checkAndCompleteCampaign(campaignId);
      return;
    }

    try {
      // Send the human-emulated message (spintax resolved)
      const response = await fetch(`${apiBase}/api/sessions/${sessionId}/messages/send-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({ chatId, text: finalMessage }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`OpenWA API error ${response.status}: ${errBody}`);
      }

      const result = await response.json() as { id?: string; messageId?: string };
      const waMessageId = result?.id ?? result?.messageId ?? '';

      await this.campaignsService.markSent(campaignMessageId, waMessageId);
      this.logger.log('✅ Message sent', {
        campaignMessageId,
        mobile,
        waMessageId,
        jobIndex,
        spintaxApplied: finalMessage !== messageText,
      });

      // Check if campaign is now complete
      await this.campaignsService.checkAndCompleteCampaign(campaignId);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      const retryCount = job.attemptsMade;

      this.logger.warn('Message send failed', { campaignMessageId, mobile, reason, retryCount });
      await this.campaignsService.markFailed(campaignMessageId, reason, retryCount);

      // Re-throw so BullMQ handles retry backoff
      throw error;
    }
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  /**
   * Check if a number is registered on WhatsApp.
   * Returns true if registered, false otherwise.
   * On any API/network error, returns true (fail-open: don't wrongly skip a valid number).
   */
  private async isWhatsAppNumber(
    apiBase: string,
    apiKey: string,
    sessionId: string,
    chatId: string,
  ): Promise<boolean> {
    try {
      const phone = chatId.replace('@c.us', '');
      const res = await fetch(
        `${apiBase}/api/sessions/${sessionId}/contacts/${encodeURIComponent(phone)}/check-exists`,
        {
          method: 'GET',
          headers: { 'X-API-Key': apiKey },
        },
      );
      if (!res.ok) return true; // Endpoint not found / error → fail-open
      const data = await res.json() as { exists?: boolean; registered?: boolean };
      return data.exists !== false && data.registered !== false;
    } catch {
      return true;
    }
  }
}
