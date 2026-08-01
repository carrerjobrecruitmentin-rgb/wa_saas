import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Campaign } from './campaign.entity';

export enum CampaignMessageStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

@Entity('campaign_messages')
export class CampaignMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  campaignId: string;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaignId' })
  campaign: Campaign;

  @Column({ type: 'varchar', nullable: true })
  contactId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  mobile: string;

  @Column({ type: 'varchar', nullable: true })
  contactName: string | null;

  @Column({ type: 'text' })
  messageText: string;

  @Column({ type: 'varchar', default: CampaignMessageStatus.PENDING })
  status: CampaignMessageStatus;

  @Column({ type: 'text', nullable: true })
  failReason: string | null;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'datetime', nullable: true })
  nextRetryAt: Date | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  waMessageId: string | null;

  @Column({ type: 'datetime', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  readAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
