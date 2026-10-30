import { IsBoolean, IsIn, IsString, Length } from 'class-validator';

export class WorkshopInquiryDto {
  @IsString()
  @Length(10, 1500)
  message!: string;

  @IsBoolean()
  consentToShareIdentity!: boolean;
}

export class WorkshopInquiryStatusDto {
  @IsString()
  @IsIn(['contacted', 'closed'])
  status!: 'contacted' | 'closed';
}
