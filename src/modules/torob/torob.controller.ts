import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { TorobProductsRequestDto } from './dto/torob-products.dto';
import { TorobAuthGuard } from './torob-auth.guard';
import { TorobService } from './torob.service';

@ApiTags('torob')
@Controller('torob_api/v3')
@UseGuards(TorobAuthGuard)
export class TorobController {
  constructor(private readonly torobService: TorobService) {}

  @SkipThrottle()
  @Post('products')
  @ApiOperation({
    summary:
      'Torob Product API v3 — paginated / by URL / by unique id (official sync)',
  })
  @ApiHeader({ name: 'X-Torob-Token', required: false })
  @ApiHeader({ name: 'X-Torob-Token-Version', required: false })
  products(@Body() body: TorobProductsRequestDto) {
    return this.torobService.handleProductsRequest(body ?? {});
  }
}
