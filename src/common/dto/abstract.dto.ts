import { ApiProperty } from '@nestjs/swagger';

export class AbstractDto {
  @ApiProperty({ format: 'uuid' })
  public uuid: string;
  public id: number
  public createdAt: Date
  public updatedAt: Date
  
}
