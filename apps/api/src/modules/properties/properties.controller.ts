import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalUser } from '../../common/decorators/optional-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../generated/prisma/enums';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CreatePropertyDto } from './dto/create-property.dto';
import {
  ListMyPropertiesQueryDto,
  ListPublicPropertiesQueryDto,
} from './dto/list-properties-query.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { OrderPropertyImagesDto } from './dto/order-property-images.dto';
import { UpdatePropertyStatusDto } from './dto/update-property-status.dto';
import { PropertiesService } from './properties.service';
import { PropertyImagesService } from './property-images.service';

@Controller('properties')
export class PropertiesController {
  constructor(
    private readonly properties: PropertiesService,
    private readonly images: PropertyImagesService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AGENT)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePropertyDto) {
    return this.properties.create(user.id, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AGENT)
  mine(
    @CurrentUser() user: AuthUser,
    @Query() query: ListMyPropertiesQueryDto,
  ) {
    return this.properties.listMine(user.id, query);
  }

  @Get('me/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AGENT)
  mineOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.properties.getMine(user.id, id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AGENT)
  status(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyStatusDto,
  ) {
    return this.properties.changeStatus(user.id, id, dto.status);
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AGENT)
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

    return this.images.upload(user.id, id, file);
  }

  @Patch(':id/images/order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AGENT)
  orderImages(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OrderPropertyImagesDto,
  ) {
    return this.images.reorder(user.id, id, dto.imageIds);
  }

  @Patch(':id/images/:imageId/cover')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AGENT)
  cover(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.images.makeCover(user.id, id, imageId);
  }

  @Delete(':id/images/:imageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AGENT)
  removeImage(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.images.removeMine(user.id, id, imageId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AGENT)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.properties.update(user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AGENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.properties.removeMine(user.id, id);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(
    @OptionalUser() user: AuthUser | undefined,
    @Query() query: ListPublicPropertiesQueryDto,
  ) {
    return this.properties.listPublic(query, { userId: user?.id });
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  detail(
    @OptionalUser() user: AuthUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.properties.getPublic(id, user?.id);
  }
}
