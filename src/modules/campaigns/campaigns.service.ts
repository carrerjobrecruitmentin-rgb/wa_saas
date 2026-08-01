import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { Campaign, CampaignStatus } from './entities/campaign.entity';
import { CampaignMessage, CampaignMessageStatus } from './entities/campaign-message.entity';
import { Contact } from '../campaign-contacts/entities/contact.entity';
import { CreateCampaignDto, UpdateCampaignDto, CampaignMessageFilterDto } from './dto/campaign.dto';
import { createLogger } from '../../common/services/logger.service';
import { CAMPAIGN_QUEUE_NAME } from './campaign-queue.constants';
import { resolveSpintax, hasSpintax } from '../../common/stealth/spintax.engine';

// ── Anti-spam helpers ────────────────────────────────────────────────────────

/** Random greeting pool — picked fresh for every message so fingerprints differ. */
const GREETINGS = ['Hi', 'Hello', 'Hey', 'Namaste', 'Hii', 'Greetings'];

/**
 * Returns a time-aware + randomised greeting.
 * If the template contains {{greeting}} this value replaces it;
 * otherwise the whole template stays intact.
 */
function buildGreeting(): string {
  const hour = new Date().getHours();
  let timePart: string;
  if (hour >= 5 && hour < 12) timePart = 'Good morning';
  else if (hour >= 12 && hour < 17) timePart = 'Good afternoon';
  else if (hour >= 17 && hour < 21) timePart = 'Good evening';
  else timePart = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

  // 50 % chance: use time-based, 50 % use random casual greeting
  if (Math.random() < 0.5) {
    return timePart;
  }
  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
}

function renderTemplate(template: string, contact: Contact): string {
  const s = (v: string | null | undefined) => v ?? '';
  const greeting = buildGreeting();

  // ── Step 1: Resolve Spintax FIRST (before contact substitution)
  // This ensures {Hi|Hello|Hey} is resolved BEFORE {{name}} injection
  // so every contact gets a uniquely varied message.
  let rendered = hasSpintax(template) ? resolveSpintax(template) : template;

  // Resolve {{greeting}} — use dynamic time-aware greeting
  rendered = rendered.replace(/\{\{greeting\}\}/gi, greeting);

  // ── Step 2: Standard contact variable substitution
  rendered = rendered
    .replace(/\{\{name\}\}/gi, s(contact.name))
    .replace(/\{\{mobile\}\}/gi, s(contact.mobile))
    .replace(/\{\{city\}\}/gi, s(contact.city))
    .replace(/\{\{state\}\}/gi, s(contact.state))
    .replace(/\{\{company\}\}/gi, s(contact.company))
    .replace(/\{\{language\}\}/gi, s(contact.language))
    .replace(/\{\{custom1\}\}/gi, s(contact.custom1))
    .replace(/\{\{custom2\}\}/gi, s(contact.custom2))
    .replace(/\{\{custom3\}\}/gi, s(contact.custom3));

  // {{unsubscribe}} → natural spintax-based opt-out footer
  const unsubscribeOptions = '{_Agar aage aise msgs nahi chahiye toh *STOP* likh dena_|_Nahi chahiye toh *STOP* reply kar dena_|_Aage se aise msgs na chahiye toh *STOP* bhej dena_|_Ignore kar dena ya *STOP* likh dena agar aage se nahi chahiye toh_}';
  
  rendered = rendered.replace(
    /\{\{unsubscribe\}\}/gi,
    '\n\n' + resolveSpintax(unsubscribeOptions),
  );

  return rendered;
}


@Injectable()
export class CampaignsService {
  private readonly logger = createLogger('CampaignsService');

  constructor(
    @InjectRepository(Campaign, 'data')
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(CampaignMessage, 'data')
    private readonly messageRepo: Repository<CampaignMessage>,
    @InjectRepository(Contact, 'data')
    private readonly contactRepo: Repository<Contact>,
    @InjectQueue(CAMPAIGN_QUEUE_NAME)
    private readonly campaignQueue: Queue,
  ) {}

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async create(dto: CreateCampaignDto): Promise<Campaign> {
    const campaign = this.campaignRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      sessionId: dto.sessionId ?? 'job-recruitment',
      groupId: dto.groupId ?? null,
      messageTemplate: dto.messageTemplate,
      status: CampaignStatus.DRAFT,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      minDelayMs: dto.minDelayMs ?? null,
      maxDelayMs: dto.maxDelayMs ?? null,
    });
    return this.campaignRepo.save(campaign);
  }

  async findAll(): Promise<Campaign[]> {
    return this.campaignRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Campaign> {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    return campaign;
  }

  async update(id: string, dto: UpdateCampaignDto): Promise<Campaign> {
    const campaign = await this.findOne(id);
    if (campaign.status === CampaignStatus.RUNNING) {
      throw new BadRequestException('Cannot update a running campaign. Pause it first.');
    }
    Object.assign(campaign, {
      name: dto.name ?? campaign.name,
      description: dto.description ?? campaign.description,
      messageTemplate: dto.messageTemplate ?? campaign.messageTemplate,
      groupId: dto.groupId ?? campaign.groupId,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : campaign.scheduledAt,
      minDelayMs: dto.minDelayMs ?? campaign.minDelayMs,
      maxDelayMs: dto.maxDelayMs ?? campaign.maxDelayMs,
    });
    return this.campaignRepo.save(campaign);
  }

  async delete(id: string): Promise<void> {
    const campaign = await this.findOne(id);
    if (campaign.status === CampaignStatus.RUNNING) {
      throw new BadRequestException('Cannot delete a running campaign. Stop it first.');
    }
    await this.campaignRepo.remove(campaign);
  }

  // ─── Campaign Control ─────────────────────────────────────────────────────

  async start(id: string): Promise<Campaign> {
    const campaign = await this.findOne(id);

    if ([CampaignStatus.RUNNING, CampaignStatus.COMPLETED].includes(campaign.status)) {
      throw new BadRequestException(`Campaign is already ${campaign.status}`);
    }

    if (!campaign.groupId) {
      throw new BadRequestException('Campaign must have a contact group assigned');
    }

    // Fetch contacts from group
    const contacts = await this.contactRepo.find({
      where: { groupId: campaign.groupId, isValid: true },
    });

    if (contacts.length === 0) {
      throw new BadRequestException('No valid contacts found in the selected group');
    }

    // Delete any previous message records (re-run scenario)
    await this.messageRepo.delete({ campaignId: id });

    // Create campaign message records + personalize
    const messages: CampaignMessage[] = contacts.map((contact) =>
      this.messageRepo.create({
        campaignId: id,
        contactId: contact.id,
        mobile: contact.mobile,
        contactName: contact.name ?? null,
        messageText: renderTemplate(campaign.messageTemplate, contact),
        status: CampaignMessageStatus.PENDING,
        retryCount: 0,
      }),
    );

    const saved = await this.messageRepo.save(messages);

    // Update campaign
    campaign.status = CampaignStatus.RUNNING;
    campaign.totalContacts = contacts.length;
    campaign.pendingCount = contacts.length;
    campaign.sentCount = 0;
    campaign.failedCount = 0;
    campaign.startedAt = new Date();
    await this.campaignRepo.save(campaign);

    // Enqueue all message jobs
    const jobs = saved.map((msg, idx) => ({
      name: 'send-campaign-message',
      data: {
        campaignMessageId: msg.id,
        campaignId: id,
        sessionId: campaign.sessionId,
        mobile: msg.mobile,
        messageText: msg.messageText,
        minDelayMs: campaign.minDelayMs ?? 10000,
        maxDelayMs: campaign.maxDelayMs ?? 30000,
        jobIndex: idx, // used for batch-break logic in processor
      },
      opts: {
        attempts: 3,
        backoff: { type: 'fixed', delay: 300000 }, // 5 min first retry
        removeOnComplete: { age: 86400, count: 5000 },
        removeOnFail: { age: 604800, count: 10000 },
      },
    }));

    await this.campaignQueue.addBulk(jobs);

    this.logger.log('Campaign started', {
      campaignId: id,
      totalContacts: contacts.length,
      sessionId: campaign.sessionId,
    });

    return this.campaignRepo.findOne({ where: { id } }) as Promise<Campaign>;
  }

  async pause(id: string): Promise<Campaign> {
    const campaign = await this.findOne(id);
    if (campaign.status !== CampaignStatus.RUNNING) {
      throw new BadRequestException('Campaign is not running');
    }
    campaign.status = CampaignStatus.PAUSED;
    return this.campaignRepo.save(campaign);
  }

  async resume(id: string): Promise<Campaign> {
    const campaign = await this.findOne(id);
    if (campaign.status !== CampaignStatus.PAUSED) {
      throw new BadRequestException('Campaign is not paused');
    }
    campaign.status = CampaignStatus.RUNNING;
    return this.campaignRepo.save(campaign);
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  async getStats(id: string) {
    const campaign = await this.findOne(id);
    const [sentCount, failedCount, pendingCount, deliveredCount, readCount] = await Promise.all([
      this.messageRepo.count({ where: { campaignId: id, status: CampaignMessageStatus.SENT } }),
      this.messageRepo.count({ where: { campaignId: id, status: CampaignMessageStatus.FAILED } }),
      this.messageRepo.count({ where: { campaignId: id, status: CampaignMessageStatus.PENDING } }),
      this.messageRepo.count({ where: { campaignId: id, status: CampaignMessageStatus.DELIVERED } }),
      this.messageRepo.count({ where: { campaignId: id, status: CampaignMessageStatus.READ } }),
    ]);
    const total = campaign.totalContacts;
    const successRate = total > 0 ? Math.round(((sentCount + deliveredCount + readCount) / total) * 100) : 0;

    return {
      campaign,
      stats: {
        total,
        sent: sentCount,
        delivered: deliveredCount,
        read: readCount,
        failed: failedCount,
        pending: pendingCount,
        successRate,
      },
    };
  }

  async getMessages(id: string, filter: CampaignMessageFilterDto) {
    await this.findOne(id);
    const page = Number(filter.page) || 1;
    const limit = Math.min(Number(filter.limit) || 50, 200);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { campaignId: id };
    if (filter.status) where['status'] = filter.status;

    const [messages, total] = await this.messageRepo.findAndCount({
      where: where as any,
      skip,
      take: limit,
      order: { createdAt: 'ASC' },
    });

    return { data: messages, total, page, limit };
  }

  // ─── Called by processor to update status ────────────────────────────────

  async markSent(messageId: string, waMessageId: string): Promise<void> {
    await this.messageRepo.update(messageId, {
      status: CampaignMessageStatus.SENT,
      waMessageId,
      sentAt: new Date(),
    });
    const msg = await this.messageRepo.findOne({ where: { id: messageId } });
    if (msg) {
      await this.campaignRepo.increment({ id: msg.campaignId }, 'sentCount', 1);
      await this.campaignRepo.decrement({ id: msg.campaignId }, 'pendingCount', 1);
    }
  }

  async markFailed(messageId: string, reason: string, retryCount: number): Promise<void> {
    const nextRetry = this.computeNextRetry(retryCount);
    await this.messageRepo.update(messageId, {
      status: CampaignMessageStatus.FAILED,
      failReason: reason,
      retryCount,
      nextRetryAt: nextRetry,
    });
    const msg = await this.messageRepo.findOne({ where: { id: messageId } });
    if (msg && retryCount >= 3) {
      await this.campaignRepo.increment({ id: msg.campaignId }, 'failedCount', 1);
      await this.campaignRepo.decrement({ id: msg.campaignId }, 'pendingCount', 1);
    }
  }

  async markDelivered(waMessageId: string): Promise<void> {
    const msg = await this.messageRepo.findOne({ where: { waMessageId } });
    if (!msg) return;
    await this.messageRepo.update(msg.id, {
      status: CampaignMessageStatus.DELIVERED,
      deliveredAt: new Date(),
    });
    await this.campaignRepo.increment({ id: msg.campaignId }, 'deliveredCount', 1);
  }

  async markRead(waMessageId: string): Promise<void> {
    const msg = await this.messageRepo.findOne({ where: { waMessageId } });
    if (!msg) return;
    await this.messageRepo.update(msg.id, {
      status: CampaignMessageStatus.READ,
      readAt: new Date(),
    });
    await this.campaignRepo.increment({ id: msg.campaignId }, 'readCount', 1);
  }

  async checkAndCompleteCampaign(campaignId: string): Promise<void> {
    const pending = await this.messageRepo.count({
      where: [
        { campaignId, status: CampaignMessageStatus.PENDING },
        { campaignId, status: CampaignMessageStatus.QUEUED },
      ] as any,
    });
    if (pending === 0) {
      await this.campaignRepo.update(campaignId, {
        status: CampaignStatus.COMPLETED,
        completedAt: new Date(),
      });
    }
  }

  private computeNextRetry(retryCount: number): Date {
    const delays = [5 * 60 * 1000, 15 * 60 * 1000, 30 * 60 * 1000]; // 5m, 15m, 30m
    const delay = delays[retryCount] ?? delays[delays.length - 1];
    return new Date(Date.now() + delay);
  }
}
