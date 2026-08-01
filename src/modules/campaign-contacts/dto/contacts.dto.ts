import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateContactDto {
  @IsString()
  mobile: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  custom1?: string;

  @IsOptional()
  @IsString()
  custom2?: string;

  @IsOptional()
  @IsString()
  custom3?: string;

  @IsOptional()
  @IsString()
  groupId?: string;
}

export class ContactFilterDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
