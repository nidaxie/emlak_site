import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../generated/prisma/enums';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePropertyDto } from './dto/create-property.dto';
import { ListMyPropertiesQueryDto } from './dto/list-properties-query.dto';
import { OrderPropertyImagesDto } from './dto/order-property-images.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { UpdateUserPropertyStatusDto } from './dto/update-user-property-status.dto';
import { contentDisposition } from '../storage/file-policy';
import { PropertiesService } from './properties.service';
import { PropertyImagesService } from './property-images.service';

@Controller('user-properties')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
export class UserPropertiesController {
  constructor(
    private readonly properties: PropertiesService,
    private readonly images: PropertyImagesService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePropertyDto) {
    return this.properties.createForUser(user.id, dto);
  }

  @Get('me')
  mine(
    @CurrentUser() user: AuthUser,
    @Query() query: ListMyPropertiesQueryDto,
  ) {
    return this.properties.listMineForUser(user.id, query);
  }

  @Get('me/files/:fileId')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async openOwnedFile(
    @CurrentUser() user: AuthUser,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    const file = await this.properties.openOwnedUserImage(user.id, fileId);

    return new StreamableFile(file.stream, {
      type: file.mimeType,
      disposition: contentDisposition('inline', file.originalName),
    });
  }

  @Get('me/:id')
  mineOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.properties.getMineForUser(user.id, id);
  }

  @Patch(':id/status')
  status(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserPropertyStatusDto,
  ) {
    return this.properties.changeStatusForUser(user.id, id, dto.status);
  }

  @Post(':id/images')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  uploadImage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: { buffer: Buffer; originalname?: string } | undefined,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('File is required');
    }

    return this.images.uploadForUser(user.id, id, file);
  }

  @Patch(':id/images/order')
  orderImages(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OrderPropertyImagesDto,
  ) {
    return this.images.reorderForUser(user.id, id, dto.imageIds);
  }

  @Patch(':id/images/:imageId/cover')
  cover(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.images.makeCoverForUser(user.id, id, imageId);
  }

  @Delete(':id/images/:imageId')
  removeImage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.images.removeForUser(user.id, id, imageId);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.properties.updateForUser(user.id, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.properties.removeMineForUser(user.id, id);
  }
}
