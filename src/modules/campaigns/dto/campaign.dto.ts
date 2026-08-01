import { IsString, IsOptional, IsDateString, IsNumber, Min, Max } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  messageTemplate: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  /** Override session id (default: job-recruitment) */
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(60000)
  minDelayMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(120000)
  maxDelayMs?: number;
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  messageTemplate?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  minDelayMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  maxDelayMs?: number;
}

export class CampaignMessageFilterDto {
  @IsOptional()
  status?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
