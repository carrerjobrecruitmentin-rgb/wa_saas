import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Contact } from './entities/contact.entity';
import { ContactGroup } from './entities/contact-group.entity';
import { ImportLog } from './entities/import-log.entity';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contact, ContactGroup, ImportLog], 'data'),
    MulterModule.register({ storage: undefined }), // memory storage - buffer in req
    AuthModule,
  ],
  providers: [ContactsService],
  controllers: [ContactsController],
  exports: [ContactsService],
})
export class CampaignContactsModule {}
