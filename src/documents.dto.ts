import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class DocumentUploadDto {
  @IsString()
  @IsIn(['company_registration', 'ownership', 'financial', 'sales_contract', 'permit', 'other'])
  category!: string;
}

export class DocumentReviewDto {
  @IsString()
  @IsIn(['accepted', 'revision'])
  status!: 'accepted' | 'revision';

  @IsOptional()
  @IsString()
  @Length(5, 1000)
  note?: string;
}
