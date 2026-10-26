import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../generated/prisma/enums';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AgentApplicationsService } from './agent-applications.service';
import { AgentDocumentsService } from './agent-documents.service';
import { ListAgentApplicationsQueryDto } from './dto/list-agent-applications-query.dto';
import { RejectAgentApplicationDto } from './dto/reject-agent-application.dto';

@Controller('admin/agent-applications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminAgentApplicationsController {
  constructor(
    private readonly applications: AgentApplicationsService,
    private readonly documents: AgentDocumentsService,
  ) {}

  @Get()
  list(@Query() query: ListAgentApplicationsQueryDto) {
    return this.applications.listForAdmin(query);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.applications.getForAdmin(id);
  }

  @Get(':id/documents')
  documentsFor(@Param('id', ParseUUIDPipe) id: string) {
    return this.documents.listForAdmin(id);
  }

  @Get(':id/documents/:documentId')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async openDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    const file = await this.documents.openForAdmin(id, documentId);

    return new StreamableFile(file.stream, {
      type: file.mimeType,
      disposition: file.disposition,
    });
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.applications.approve(id, admin.id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectAgentApplicationDto,
  ) {
    return this.applications.reject(id, admin.id, dto.reason);
  }
}
