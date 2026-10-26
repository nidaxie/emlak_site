import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../generated/prisma/enums';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AgentsService } from './agents.service';
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

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.agents.getForAdmin(id);
  }

  @Patch(':id/status')
  setStatus(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgentStatusDto,
  ) {
    return this.agents.setActive(id, dto.isActive, admin.id);
  }
}
