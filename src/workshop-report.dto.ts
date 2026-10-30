import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsString, Length, Max, Min } from 'class-validator';

function normalizeInteger(value: unknown): number {
  const raw = String(value ?? '').trim();
  if (!raw) return Number.NaN;
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  return Number(raw.replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit))).replace(/[٬,\s]/g, ''));
}

export class WorkshopReportDto {
  @Transform(({ value }) => normalizeInteger(value))
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0 })
  @IsInt() @Min(2000) @Max(2200)
  year!: number;

  @Transform(({ value }) => normalizeInteger(value))
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0 })
  @IsInt() @Min(1) @Max(12)
  month!: number;

  @IsString()
  @Length(1, 50)
  quantityUnit!: string;

  @Transform(({ value }) => normalizeInteger(value))
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0 })
  @Min(0) @Max(Number.MAX_SAFE_INTEGER)
  productionQuantity!: number;

  @Transform(({ value }) => normalizeInteger(value))
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0 })
  @Min(0) @Max(Number.MAX_SAFE_INTEGER)
  soldQuantity!: number;

  @Transform(({ value }) => normalizeInteger(value))
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0 })
  @Min(0) @Max(Number.MAX_SAFE_INTEGER)
  salesAmount!: number;

  @Transform(({ value }) => normalizeInteger(value))
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0 })
  @Min(0) @Max(Number.MAX_SAFE_INTEGER)
  operatingCosts!: number;

  @IsString()
  @Length(10, 2000)
  sourceNote!: string;
}
