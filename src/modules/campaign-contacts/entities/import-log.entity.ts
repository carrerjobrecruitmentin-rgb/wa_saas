import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum ImportStatus {
  PROCESSING = 'processing',
  DONE = 'done',
  FAILED = 'failed',
}

@Entity('import_logs')
export class ImportLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Column({ type: 'varchar', nullable: true })
  groupId: string | null;

  @Column({ type: 'varchar', nullable: true })
  groupName: string | null;

  @Column({ type: 'int', default: 0 })
  totalRows: number;

  @Column({ type: 'int', default: 0 })
  successRows: number;

  @Column({ type: 'int', default: 0 })
  failedRows: number;

  @Column({ type: 'int', default: 0 })
  duplicateRows: number;

  @Column({ type: 'varchar', default: ImportStatus.PROCESSING })
  status: ImportStatus;

  @Column({ type: 'text', nullable: true })
  errors: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
