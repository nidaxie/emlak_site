import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
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
import { ListPublicPropertiesQueryDto } from '../properties/dto/list-properties-query.dto';
import { PropertiesService } from '../properties/properties.service';
import { AgentsService } from './agents.service';
import { UpdateAgentProfileDto } from './dto/update-agent-profile.dto';

@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agents: AgentsService,
    private readonly properties: PropertiesService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AGENT)
  mine(@CurrentUser() user: AuthUser) {
    return this.agents.getMine(user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AGENT)
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateAgentProfileDto) {
    return this.agents.updateMine(user.id, dto);
  }

  @Post('me/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AGENT)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  uploadLogo(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: { buffer: Buffer; originalname?: string } | undefined,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('File is required');
    }

    return this.agents.uploadLogo(user.id, file);
  }

  @Get(':slug/properties')
  @UseGuards(OptionalJwtAuthGuard)
  listProperties(
    @OptionalUser() user: AuthUser | undefined,
    @Param('slug') slug: string,
    @Query() query: ListPublicPropertiesQueryDto,
  ) {
    return this.properties.listPublicForAgent(slug, query, user?.id);
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.agents.getPublicBySlug(slug);
  }
}
