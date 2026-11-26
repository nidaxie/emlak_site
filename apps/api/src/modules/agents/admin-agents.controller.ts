import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { contentDisposition } from '../storage/file-policy';
import { AgentsService } from './agents.service';
import { AgentSummaryQueryDto } from './dto/agent-summary-query.dto';
import { ListAgentsQueryDto } from './dto/list-agents-query.dto';
import { UpdateAgentStatusDto } from './dto/update-agent-status.dto';

@Controller('admin/agents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminAgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  list(@Query() query: ListAgentsQueryDto) {
    return this.agents.listForAdmin(query);
  }

  @Get('summary')
  summary(@Query() query: AgentSummaryQueryDto) {
    return this.agents.summary(query);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.agents.getForAdmin(id);
  }

  @Get(':id/files/:fileId')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async openLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    const file = await this.agents.openAdminLogo(id, fileId);

    return new StreamableFile(file.stream, {
      type: file.mimeType,
      disposition: contentDisposition('inline', file.originalName),
    });
  }

  @Patch(':id/status')
  setStatus(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgentStatusDto,
  ) {
    return this.agents.setActive(id, dto.isActive, dto.reason, admin.id);
  }
}
