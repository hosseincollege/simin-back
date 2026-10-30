import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsString, Length, Max, Min } from 'class-validator';

function normalizeAmount(value: unknown): number {
  const raw = String(value ?? '').trim();
  if (!raw) return Number.NaN;
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  const normalized = raw
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

  @IsString()
  @Length(2, 200)
  productName!: string;

  @IsString()
  @Length(2, 200)
  currentCapacity!: string;

  @IsString()
  @Length(2, 200)
  targetCapacity!: string;

  @IsString()
  @Length(20, 2000)
  investmentPurpose!: string;

  @Transform(({ value }) => normalizeAmount(value))
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0 })
  @Min(1)
  @Max(60)
  @IsInt()
  executionMonths!: number;

  @Transform(({ value }) => normalizeAmount(value))
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0 })
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  equipmentAmount!: number;

  @Transform(({ value }) => normalizeAmount(value))
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0 })
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  workingCapitalAmount!: number;

  @Transform(({ value }) => normalizeAmount(value))
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0 })
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  otherCostsAmount!: number;
}
