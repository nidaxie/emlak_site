import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ModerationReasonDto } from '../../common/dto/moderation-reason.dto';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../generated/prisma/enums';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ListAdminPropertiesQueryDto } from './dto/list-properties-query.dto';
import { PropertiesService } from './properties.service';
import { PropertyImagesService } from './property-images.service';

@Controller('admin/properties')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminPropertiesController {
  constructor(
    private readonly properties: PropertiesService,
    private readonly images: PropertyImagesService,
  ) {}

  @Get()
  list(@Query() query: ListAdminPropertiesQueryDto) {
    return this.properties.listForAdmin(query);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.properties.getForAdmin(id);
  }

  @Patch(':id/deactivate')
  deactivate(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerationReasonDto,
  ) {
    return this.properties.deactivate(admin.id, id, dto.reason);
  }

  @Delete(':id/images/:imageId')
  removeImage(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.images.removeForAdmin(admin.id, id, imageId);
  }

  @Delete(':id')
  remove(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerationReasonDto,
  ) {
    return this.properties.removeForAdmin(admin.id, id, dto.reason);
  }
}
