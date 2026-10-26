import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class OrderPropertyImagesDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  imageIds!: string[];
}
