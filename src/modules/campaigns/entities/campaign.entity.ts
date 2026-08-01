import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', default: 'job-recruitment' })
  sessionId: string;

  @Column({ type: 'varchar', nullable: true })
  groupId: string | null;

  @Column({ type: 'text' })
  messageTemplate: string;

  @Column({ type: 'varchar', default: CampaignStatus.DRAFT })
  status: CampaignStatus;

  @Column({ type: 'datetime', nullable: true })
  scheduledAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  totalContacts: number;

  @Column({ type: 'int', default: 0 })
  sentCount: number;

  @Column({ type: 'int', default: 0 })
  failedCount: number;

  @Column({ type: 'int', default: 0 })
  pendingCount: number;

  @Column({ type: 'int', default: 0 })
  deliveredCount: number;

  @Column({ type: 'int', default: 0 })
  readCount: number;

  @Column({ type: 'int', nullable: true })
  minDelayMs: number | null;

  @Column({ type: 'int', nullable: true })
  maxDelayMs: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
