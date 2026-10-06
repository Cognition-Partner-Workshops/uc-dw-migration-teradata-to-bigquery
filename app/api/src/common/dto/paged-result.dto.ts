import { ApiProperty } from '@nestjs/swagger';

/** Port of Apex `PagedResult` (PagedResult.cls). */
export class PagedResultDto<T> {
  @ApiProperty({ example: 9 })
  pageSize: number;

  @ApiProperty({ example: 1 })
  pageNumber: number;

  @ApiProperty({ example: 42 })
  totalItemCount: number;

  @ApiProperty({ isArray: true, type: Object })
  records: T[];
}
