import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { AgentApplicationsService } from './agent-applications.service';
import { AgentDocumentsService } from './agent-documents.service';
import { CreateAgentApplicationDto } from './dto/create-agent-application.dto';
import { UpdateAgentApplicationDto } from './dto/update-agent-application.dto';
import { UploadAgentDocumentDto } from './dto/upload-agent-document.dto';

const documentUpload = FileInterceptor('file', {
  limits: { fileSize: 10 * 1024 * 1024 },
});

@Controller('agent-applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentApplicationsController {
  constructor(
    private readonly applications: AgentApplicationsService,
    private readonly documents: AgentDocumentsService,
  ) {}

  @Post()
  @Roles(Role.USER)
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAgentApplicationDto,
  ) {
    return this.applications.create(user.id, dto);
  }

  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.applications.getMine(user.id);
  }

  @Patch('me')
  update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateAgentApplicationDto,
  ) {
    return this.applications.updateMine(user.id, dto);
  }

  @Post('me/documents')
  @Roles(Role.USER)
  @UseInterceptors(documentUpload)
  uploadDocument(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: { buffer: Buffer; originalname?: string } | undefined,
    @Body() dto: UploadAgentDocumentDto,
  ) {
    return this.documents.upload(user.id, dto.documentType, file);
  }

  @Get('me/documents')
  listDocuments(@CurrentUser() user: AuthUser) {
    return this.documents.listMine(user.id);
  }

  @Get('me/documents/:documentId')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async openDocument(
    @CurrentUser() user: AuthUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    const file = await this.documents.openMine(user.id, documentId);

    return new StreamableFile(file.stream, {
      type: file.mimeType,
      disposition: file.disposition,
    });
  }
}
