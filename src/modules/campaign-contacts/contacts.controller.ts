import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { CreateGroupDto, CreateContactDto, ContactFilterDto } from './dto/contacts.dto';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';

interface UploadedFileType {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}


@ApiTags('Campaign Contacts')
@UseGuards(ApiKeyGuard)
@Controller('campaign-contacts')

export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  // ─── Groups ────────────────────────────────────────────────────────────────

  @Post('groups')
  @ApiOperation({ summary: 'Create a contact group' })
  createGroup(@Body() dto: CreateGroupDto) {
    return this.contactsService.createGroup(dto);
  }

  @Get('groups')
  @ApiOperation({ summary: 'List all contact groups' })
  listGroups() {
    return this.contactsService.findAllGroups();
  }

  @Delete('groups/:id')
  @ApiOperation({ summary: 'Delete a contact group' })
  deleteGroup(@Param('id') id: string) {
    return this.contactsService.deleteGroup(id);
  }

  // ─── Contacts ──────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List contacts with filters' })
  listContacts(@Query() filter: ContactFilterDto) {
    return this.contactsService.findAll(filter);
  }

  @Get('import-logs')
  @ApiOperation({ summary: 'List CSV import history' })
  importLogs() {
    return this.contactsService.findImportLogs();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single contact' })
  getContact(@Param('id') id: string) {
    return this.contactsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a single contact' })
  createContact(@Body() dto: CreateContactDto) {
    return this.contactsService.create(dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a contact' })
  deleteContact(@Param('id') id: string) {
    return this.contactsService.deleteContact(id);
  }

  // ─── CSV/Excel Upload ──────────────────────────────────────────────────────

  @Post('upload')
  @ApiOperation({ summary: 'Upload CSV or Excel file to import contacts' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadContacts(
    @UploadedFile() file: UploadedFileType,
    @Query('groupId') groupId?: string,
    @Query('groupName') groupName?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream',
    ];
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (!allowedMimes.includes(file.mimetype) && !['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
      throw new BadRequestException('Only CSV and Excel files are allowed');
    }

    return this.contactsService.importFromFile(
      file.buffer,
      file.originalname,
      groupId,
      groupName,
    );
  }
}
