import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ContactGroup } from './contact-group.entity';

@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  mobile: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  company: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  language: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  custom1: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  custom2: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  custom3: string | null;

  @Column({ type: 'varchar', nullable: true })
  groupId: string | null;

  @ManyToOne(() => ContactGroup, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'groupId' })
  group: ContactGroup | null;

  @Column({ type: 'boolean', default: true })
  isValid: boolean;

  @Column({ type: 'boolean', default: false })
  isDuplicate: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
