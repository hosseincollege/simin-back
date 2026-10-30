import { Body, Controller, Get, Param, ParseIntPipe, Post, Request, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from './auth.controller.js';
import { ReviewGuard } from './workshops.controller.js';
import { DocumentReviewDto, DocumentUploadDto } from './documents.dto.js';
import { DocumentsService } from './documents.service.js';

type RequestWithUser = { user: { sub: number; role: string } };
type UploadedFile = { buffer: Buffer; originalname: string; mimetype: string; size: number };

@Controller('api/workshops')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('documents/review-queue')
  @UseGuards(JwtAuthGuard, ReviewGuard)
  reviewQueue() { return this.documents.listPending(); }

  @Get('mine/:id/documents')
  @UseGuards(JwtAuthGuard)
  listOwned(@Param('id', ParseIntPipe) id: number, @Request() request: RequestWithUser) {
    return this.documents.listOwned(id, request.user.sub);
  }

  @Post(':id/documents')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', {
    limits: { files: 1, fileSize: 10 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      const allowed = ['application/pdf', 'image/png', 'image/jpeg'].includes(file.mimetype);
      callback(null, allowed);
    },
  }))
  upload(@Param('id', ParseIntPipe) id: number, @Body() data: DocumentUploadDto, @UploadedFile() file: UploadedFile | undefined, @Request() request: RequestWithUser) {
    return this.documents.upload(id, request.user.sub, data.category, file);
  }

  @Get(':id/documents/:documentId/download')
  @UseGuards(JwtAuthGuard)
  async download(@Param('id', ParseIntPipe) id: number, @Param('documentId', ParseIntPipe) documentId: number,
    @Request() request: RequestWithUser, @Res({ passthrough: true }) response: Response) {
    const file = await this.documents.download(id, documentId, request.user.sub, request.user.role);
    response.setHeader('Content-Type', file.mediaType);
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(file.body);
  }

  @Post(':id/documents/:documentId/review')
  @UseGuards(JwtAuthGuard, ReviewGuard)
  review(@Param('id', ParseIntPipe) id: number, @Param('documentId', ParseIntPipe) documentId: number,
    @Body() data: DocumentReviewDto, @Request() request: RequestWithUser) {
    return this.documents.review(id, documentId, request.user.sub, data.status, data.note);
  }
}
