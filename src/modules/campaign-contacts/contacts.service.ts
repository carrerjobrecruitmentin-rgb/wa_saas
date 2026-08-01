import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindManyOptions } from 'typeorm';
import * as XLSX from 'xlsx';
import { Contact } from './entities/contact.entity';
import { ContactGroup } from './entities/contact-group.entity';
import { ImportLog, ImportStatus } from './entities/import-log.entity';
import { CreateGroupDto, CreateContactDto, ContactFilterDto } from './dto/contacts.dto';
import { createLogger } from '../../common/services/logger.service';

@Injectable()
export class ContactsService {
  private readonly logger = createLogger('ContactsService');

  constructor(
    @InjectRepository(Contact, 'data')
    private readonly contactRepo: Repository<Contact>,
    @InjectRepository(ContactGroup, 'data')
    private readonly groupRepo: Repository<ContactGroup>,
    @InjectRepository(ImportLog, 'data')
    private readonly importLogRepo: Repository<ImportLog>,
  ) {}

  // ─── Groups ────────────────────────────────────────────────────────────────

  async createGroup(dto: CreateGroupDto): Promise<ContactGroup> {
    const group = this.groupRepo.create({
      name: dto.name,
      description: dto.description ?? null,
    });
    return this.groupRepo.save(group);
  }

  async findAllGroups(): Promise<ContactGroup[]> {
    return this.groupRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findGroupById(id: string): Promise<ContactGroup> {
    const group = await this.groupRepo.findOne({ where: { id } });
    if (!group) throw new NotFoundException(`Group ${id} not found`);
    return group;
  }

  async deleteGroup(id: string): Promise<void> {
    const group = await this.findGroupById(id);
    await this.groupRepo.remove(group);
  }

  // ─── Contacts ──────────────────────────────────────────────────────────────

  async findAll(filter: ContactFilterDto) {
    const page = Number(filter.page) || 1;
    const limit = Math.min(Number(filter.limit) || 50, 200);
    const skip = (page - 1) * limit;

    const where: FindManyOptions<Contact>['where'] = {};
    if (filter.city) where['city'] = Like(`%${filter.city}%`);
    if (filter.state) where['state'] = Like(`%${filter.state}%`);
    if (filter.language) where['language'] = filter.language;
    if (filter.groupId) where['groupId'] = filter.groupId;

    const [contacts, total] = await this.contactRepo.findAndCount({
      where,
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: { group: true },
    });

    return {
      data: contacts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Contact> {
    const contact = await this.contactRepo.findOne({ where: { id }, relations: { group: true } });
    if (!contact) throw new NotFoundException(`Contact ${id} not found`);
    return contact;
  }

  async create(dto: CreateContactDto): Promise<Contact> {
    const mobile = this.normalizeMobile(dto.mobile);
    const existing = await this.contactRepo.findOne({ where: { mobile } });
    const contact = this.contactRepo.create({
      ...dto,
      mobile,
      isDuplicate: !!existing,
    });
    const saved = await this.contactRepo.save(contact);
    if (dto.groupId) await this.updateGroupCount(dto.groupId);
    return saved;
  }

  async deleteContact(id: string): Promise<void> {
    const contact = await this.findOne(id);
    const groupId = contact.groupId;
    await this.contactRepo.remove(contact);
    if (groupId) await this.updateGroupCount(groupId);
  }

  // ─── CSV / Excel Import ────────────────────────────────────────────────────

  async importFromFile(
    fileBuffer: Buffer,
    filename: string,
    groupId?: string,
    groupName?: string,
  ): Promise<ImportLog> {
    // Resolve or create group
    let resolvedGroupId: string | undefined = groupId;
    let resolvedGroupName: string | undefined = groupName;

    if (!resolvedGroupId && groupName) {
      const g = await this.createGroup({ name: groupName });
      resolvedGroupId = g.id;
      resolvedGroupName = g.name;
    } else if (resolvedGroupId) {
      const g = await this.findGroupById(resolvedGroupId);
      resolvedGroupName = g.name;
    }

    // Parse file
    let rows: Record<string, string>[];
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
    } catch {
      throw new BadRequestException('Invalid CSV/Excel file format');
    }

    if (rows.length === 0) {
      throw new BadRequestException('File is empty or has no data rows');
    }

    // Create import log
    const importLog = await this.importLogRepo.save(
      this.importLogRepo.create({
        filename,
        groupId: resolvedGroupId ?? null,
        groupName: resolvedGroupName ?? null,
        totalRows: rows.length,
        status: ImportStatus.PROCESSING,
      }),
    );

    let successRows = 0;
    let failedRows = 0;
    let duplicateRows = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const mobile = this.extractField(row, ['Mobile', 'mobile', 'Phone', 'phone', 'Number', 'number']);
        if (!mobile) {
          errors.push(`Row ${i + 2}: Missing mobile number`);
          failedRows++;
          continue;
        }

        const normalizedMobile = this.normalizeMobile(mobile);
        if (!this.isValidMobile(normalizedMobile)) {
          errors.push(`Row ${i + 2}: Invalid mobile '${mobile}'`);
          failedRows++;
          continue;
        }

        // Check duplicate within same group
        const existingQuery: Record<string, unknown> = { mobile: normalizedMobile };
        if (resolvedGroupId) existingQuery['groupId'] = resolvedGroupId;

        const existing = await this.contactRepo.findOne({ where: existingQuery as any });

        const contact = this.contactRepo.create({
          mobile: normalizedMobile,
          name: this.extractField(row, ['Name', 'name', 'Full Name', 'FullName']) || null,
          city: this.extractField(row, ['City', 'city']) || null,
          state: this.extractField(row, ['State', 'state']) || null,
          company: this.extractField(row, ['Company', 'company', 'Organization']) || null,
          language: this.extractField(row, ['Language', 'language', 'Lang', 'lang']) || null,
          custom1: this.extractField(row, ['Custom1', 'custom1', 'Type', 'CustomerType']) || null,
          custom2: this.extractField(row, ['Custom2', 'custom2', 'Category', 'category']) || null,
          custom3: this.extractField(row, ['Custom3', 'custom3']) || null,
          groupId: resolvedGroupId ?? null,
          isValid: true,
          isDuplicate: !!existing,
        });

        await this.contactRepo.save(contact);
        if (existing) duplicateRows++;
        successRows++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Row ${i + 2}: ${message}`);
        failedRows++;
      }
    }

    // Update group count
    if (resolvedGroupId) await this.updateGroupCount(resolvedGroupId);

    // Update import log
    importLog.successRows = successRows;
    importLog.failedRows = failedRows;
    importLog.duplicateRows = duplicateRows;
    importLog.status = failedRows === rows.length ? ImportStatus.FAILED : ImportStatus.DONE;
    importLog.errors = errors.length > 0 ? JSON.stringify(errors.slice(0, 50)) : null;

    this.logger.log('CSV import completed', {
      filename,
      totalRows: rows.length,
      successRows,
      failedRows,
      duplicateRows,
    });

    return this.importLogRepo.save(importLog);
  }

  async findImportLogs(): Promise<ImportLog[]> {
    return this.importLogRepo.find({ order: { createdAt: 'DESC' }, take: 100 });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private normalizeMobile(mobile: string): string {
    // Remove spaces, dashes, parentheses, plus
    let cleaned = String(mobile).replace(/[\s\-().+]/g, '');
    // If starts with 0, replace with country code (India default 91)
    if (cleaned.startsWith('0')) cleaned = '91' + cleaned.slice(1);
    return cleaned;
  }

  private isValidMobile(mobile: string): boolean {
    return /^\d{10,15}$/.test(mobile);
  }

  private extractField(row: Record<string, string>, keys: string[]): string {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== '') return String(row[key]);
    }
    return '';
  }

  private async updateGroupCount(groupId: string): Promise<void> {
    const count = await this.contactRepo.count({ where: { groupId } });
    await this.groupRepo.update(groupId, { totalContacts: count });
  }
}
