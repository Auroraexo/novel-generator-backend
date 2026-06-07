import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  genre: string;

  @IsString()
  subgenre: string;

  @IsString()
  inspiration: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(20)
  targetChapters?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(5000)
  targetWords?: number;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  genre?: string;

  @IsOptional()
  @IsString()
  subgenre?: string;

  @IsOptional()
  @IsString()
  inspiration?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(20)
  targetChapters?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(5000)
  targetWords?: number;

  @IsOptional()
  setting?: any;
}
