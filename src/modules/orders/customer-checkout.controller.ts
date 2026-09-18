import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { assertTicketAttachment } from 'src/common/utils/ticket-attachment';
import { FileEntity, Order, User } from 'src/entities';
import { CurrentUser } from 'src/modules/auth/shared/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';
import { AuthAudienceRequired } from 'src/modules/auth/shared/roles.decorator';
import { StorageNamespace } from 'src/storage/storage.constants';
import { StorageService } from 'src/storage/storage.service';
import { Repository } from 'typeorm';
import { CheckoutService } from './checkout.service';
import { orderLabels } from './order-labels';
import {
  PlaceOrderDto,
  QuoteShippingDto,
  SimulatorCompleteDto,
  SubmitReceiptDto,
} from './dto/place-order.dto';

@ApiTags('customer-checkout')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AuthAudienceRequired('customer')
@Controller('customer')
export class CustomerCheckoutController {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly storageService: StorageService,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  @Get('checkout/options')
  @ApiOperation({ summary: 'Checkout options: cart, addresses, shipping, payments' })
  options(@CurrentUser() user: User) {
    return this.checkoutService.getOptions(user);
  }

  @Post('checkout/quote-shipping')
  @ApiOperation({ summary: 'Calculate shipping fee for address + method' })
  quote(@CurrentUser() user: User, @Body() dto: QuoteShippingDto) {
    return this.checkoutService.quoteShipping(
      user,
      dto.addressUuid,
      dto.shippingMethodCode,
    );
  }

  @Post('checkout/place')
  @ApiOperation({ summary: 'Place order from cart (reserves inventory)' })
  place(@CurrentUser() user: User, @Body() dto: PlaceOrderDto) {
    return this.checkoutService.placeOrder(user, dto);
  }

  @Get('orders')
  @ApiOperation({ summary: 'List my orders' })
  async listOrders(@CurrentUser() user: User) {
    const rows = await this.orderRepo.find({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
      take: 50,
      relations: ['payments'],
    });
    return {
      success: true,
      data: {
        items: rows.map((o) => {
          const payment = (o.payments || [])[0];
          const meta = (payment?.metadata || {}) as Record<string, unknown>;
          return {
            uuid: o.uuid,
            orderNumber: o.orderNumber,
            status: o.status,
            paymentStatus: o.paymentStatus,
            total: Number(o.total),
            currency: o.currency,
            shippingMethodTitle: o.shippingMethodTitle,
            paymentMethod: payment?.method ?? null,
            createdAt: o.createdAt,
            awaitingCardReview: Boolean(meta.awaitingAdminReview),
            labels: orderLabels({
              status: o.status,
              paymentStatus: o.paymentStatus,
              paymentMethod: payment?.method ?? null,
              awaitingCardReview: Boolean(meta.awaitingAdminReview),
              hasReceipt: Boolean(meta.receiptFileUuid),
            }),
          };
        }),
        count: rows.length,
      },
    };
  }

  @Post('orders/upload-receipt')
  @ApiOperation({ summary: 'Upload card-transfer receipt (image/pdf, max 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadReceipt(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    assertTicketAttachment(file);
    const stored = await this.storageService.upload(
      file.buffer,
      file.originalname,
      file.mimetype || 'application/octet-stream',
      {
        namespace: StorageNamespace.ORDERS,
        entityId: user.uuid,
        generateThumbnails: false,
      },
    );
    const row = await this.fileRepo.save(
      this.fileRepo.create({
        bucket: stored.bucket,
        objectKey: stored.objectKey,
        namespace: stored.namespace,
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        size: String(stored.size),
        extension: stored.extension || null,
        publicUrl: '',
        entityId: user.uuid,
        variant: stored.variant || null,
        metadata: { storageFileId: stored.fileId, orderReceipt: true },
        isPublic: false,
      }),
    );
    return {
      success: true,
      data: {
        uuid: row.uuid,
        originalName: row.originalName,
        mimeType: row.mimeType,
      },
    };
  }

  @Get('orders/:uuid')
  @ApiOperation({ summary: 'Order detail' })
  async orderDetail(
    @CurrentUser() user: User,
    @Param('uuid', ParseUUIDPipe) uuid: string,
  ) {
    return {
      success: true,
      data: await this.checkoutService.mapOrderDetail(uuid, user.id),
    };
  }

  @Post('payments/simulator/:paymentUuid/complete')
  @ApiOperation({
    summary: 'Complete simulated bank gateway (success or fail)',
  })
  completeSimulator(
    @CurrentUser() user: User,
    @Param('paymentUuid', ParseUUIDPipe) paymentUuid: string,
    @Body() dto: SimulatorCompleteDto,
  ) {
    return this.checkoutService.completeSimulator(user, paymentUuid, {
      result: dto.result,
      token: dto.token,
      tokenExp: Number(dto.tokenExp),
    });
  }

  @Post('orders/:uuid/card-receipt')
  @ApiOperation({ summary: 'Submit card-to-card receipt file uuid' })
  submitReceipt(
    @CurrentUser() user: User,
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: SubmitReceiptDto,
  ) {
    return this.checkoutService.submitCardReceipt(user, uuid, dto.fileUuid);
  }

  @Delete('orders/:uuid/card-receipt')
  @ApiOperation({ summary: 'Clear card-to-card receipt before admin review' })
  clearReceipt(
    @CurrentUser() user: User,
    @Param('uuid', ParseUUIDPipe) uuid: string,
  ) {
    return this.checkoutService.clearCardReceipt(user, uuid);
  }
}
