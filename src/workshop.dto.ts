import { Transform } from 'class-transformer';
import { IsNumber, IsString, Length, Max, Min } from 'class-validator';

function normalizeAmount(value: unknown): number {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  const normalized = String(value ?? '')
    .replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)))
    .replace(/[٬,\s]/g, '');
  return Number(normalized);
}

export class WorkshopDto {
  @IsString()
  @Length(2, 200)
  title!: string;

  @IsString()
  @Length(2, 100)
  category!: string;

  @IsString()
  @Length(2, 100)
  province!: string;

  @IsString()
  @Length(2, 200)
  location!: string;

  @IsString()
  @Length(20, 10000)
  description!: string;

  @Transform(({ value }) => normalizeAmount(value))
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0 })
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  requiredCapital!: number;
}
