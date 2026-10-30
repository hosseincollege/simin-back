import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PrismaService } from './prisma.service.js';
import { WorkshopsService } from './workshops.service.js';

type UploadedDocument = { id: number; original_name: string; media_type: string; fileKey: string };

@Injectable()
export class DocumentsService {
  private readonly storageDirectory = resolve(process.env['PRIVATE_DOCUMENT_DIR'] || join(process.cwd(), 'private-documents'));

  constructor(private readonly database: PrismaService, private readonly workshops: WorkshopsService) {}

  async listOwned(workshopId: number, ownerId: number) {
    await this.workshops.getOwned(workshopId, ownerId);
    return this.database.workshop.listOwnedDocuments(workshopId, ownerId);
  }

  listPending() { return this.database.workshop.findPendingDocuments(); }

  async upload(workshopId: number, ownerId: number, category: string, file?: { buffer: Buffer; originalname: string; mimetype: string; size: number }) {
    await this.workshops.getOwned(workshopId, ownerId);
    if (!file?.buffer?.length) throw new BadRequestException('Choose a PDF, PNG, or JPEG document.');
    const detected = this.detectType(file.buffer);
    if (!detected || detected.mediaType !== file.mimetype) throw new BadRequestException('File content does not match an allowed PDF, PNG, or JPEG type.');
    if (file.size > 10 * 1024 * 1024) throw new BadRequestException('The maximum document size is 10 MB.');
    const key = randomUUID();
    const target = join(this.storageDirectory, `${key}${detected.extension}`);
    await mkdir(this.storageDirectory, { recursive: true, mode: 0o700 });
    await writeFile(target, file.buffer, { flag: 'wx', mode: 0o600 });
    const cleanName = file.originalname.replace(/[\u0000-\u001f\u007f\\/]/g, '_').slice(0, 255) || `document${detected.extension}`;
    try {
      const metadata = await this.database.workshop.createDocument({ workshopId, ownerId, category, originalName: cleanName,
        mediaType: detected.mediaType, byteSize: file.buffer.length, fileKey: key });
      return metadata;
    } catch (error) {
      await rm(target, { force: true });
      throw error;
    }
  }

  async download(workshopId: number, documentId: number, userId: number, role: string) {
    const row = role === 'admin'
      ? await this.database.workshop.getDocumentForAdmin(workshopId, documentId)
      : await this.database.workshop.getDocumentForOwner(workshopId, documentId, userId);
    if (!row) throw new NotFoundException('Document was not found.');
    if (!/^[0-9a-f-]{36}$/i.test(row.fileKey)) throw new NotFoundException('Document was not found.');
    const extension = row.mediaType === 'application/pdf' ? '.pdf' : row.mediaType === 'image/png' ? '.png' : row.mediaType === 'image/jpeg' ? '.jpg' : '';
    if (!extension) throw new NotFoundException('Document was not found.');
    try {
      return { body: await readFile(join(this.storageDirectory, `${row.fileKey}${extension}`)), name: row.originalName, mediaType: row.mediaType };
    } catch {
      throw new NotFoundException('The document file is unavailable.');
    }
  }

  async review(workshopId: number, documentId: number, actorId: number, status: 'accepted' | 'revision', note?: string) {
    if (status === 'revision' && (note?.trim().length ?? 0) < 5) throw new BadRequestException('Add a note explaining what needs correction.');
    const result = await this.database.workshop.checkDocument(workshopId, documentId, actorId, status, note?.trim() || null);
    if (!result) throw new NotFoundException('Pending document was not found.');
    return result;
  }

  private detectType(buffer: Buffer): { mediaType: string; extension: string } | null {
    if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') return { mediaType: 'application/pdf', extension: '.pdf' };
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mediaType: 'image/png', extension: '.png' };
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mediaType: 'image/jpeg', extension: '.jpg' };
    return null;
  }
}
