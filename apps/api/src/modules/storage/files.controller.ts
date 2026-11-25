import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  StreamableFile,
} from '@nestjs/common';
import { contentDisposition } from './file-policy';
import { PublicFilesService } from './public-files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly files: PublicFilesService) {}

  @Get(':id')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'public, max-age=86400')
  async open(@Param('id', ParseUUIDPipe) id: string) {
    const file = await this.files.open(id);

    return new StreamableFile(file.stream, {
      type: file.mimeType,
      disposition: contentDisposition('inline', file.originalName),
    });
  }
}
