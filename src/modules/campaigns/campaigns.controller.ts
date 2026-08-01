import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, UpdateCampaignDto, CampaignMessageFilterDto } from './dto/campaign.dto';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';

@ApiTags('Campaigns')
@UseGuards(ApiKeyGuard)
@Controller('campaigns')

export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new campaign' })
  create(@Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all campaigns' })
  findAll() {
    return this.campaignsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign details' })
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get campaign statistics' })
  getStats(@Param('id') id: string) {
    return this.campaignsService.getStats(id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'List campaign messages with status' })
  getMessages(@Param('id') id: string, @Query() filter: CampaignMessageFilterDto) {
    return this.campaignsService.getMessages(id, filter);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update campaign (only when draft/paused)' })
  update(@Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaignsService.update(id, dto);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start a campaign (enqueues all messages)' })
  start(@Param('id') id: string) {
    return this.campaignsService.start(id);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause a running campaign' })
  pause(@Param('id') id: string) {
    return this.campaignsService.pause(id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a paused campaign' })
  resume(@Param('id') id: string) {
    return this.campaignsService.resume(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a campaign' })
  delete(@Param('id') id: string) {
    return this.campaignsService.delete(id);
  }
}
