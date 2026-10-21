import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { WorkshopDto } from './workshop.dto.js';

@Injectable()
export class WorkshopsService {
  constructor(private readonly database: PrismaService) {}

  listPublished() {
    return this.database.workshop.findPublished();
  }

  listOwned(ownerId: number) {
    return this.database.workshop.findByOwner(ownerId);
  }

  listPendingReview() {
    return this.database.workshop.findPendingReview();
  }

  async submitForReview(id: number, ownerId: number) {
    const workshop = await this.database.workshop.submitForReview(id, ownerId);
    if (!workshop) throw new NotFoundException('Workshop is not eligible for submission.');
    return workshop;
  }

  async reviewHistory(id: number, userId: number, role: string) {
    if (role !== 'admin') await this.getOwned(id, userId);
    return this.database.workshop.findReviewHistory(id);
  }

  async getOwned(id: number, ownerId: number) {
    const workshop = await this.database.workshop.findOwned(id, ownerId);
    if (!workshop) throw new NotFoundException('کارگاه پیدا نشد.');
    return workshop;
  }

  async getPublished(id: number) {
    const workshop = await this.database.workshop.findPublishedById(id);
    if (!workshop) throw new NotFoundException('کارگاه پیدا نشد.');
    return workshop;
  }

  create(ownerId: number, data: WorkshopDto) {
    return this.database.workshop.create({ ownerId, data });
  }

  async updateOwned(id: number, ownerId: number, data: WorkshopDto) {
    const workshop = await this.database.workshop.updateOwned({ id, ownerId, data });
    if (!workshop) throw new NotFoundException('کارگاه قابل ویرایش پیدا نشد.');
    return workshop;
  }

  async publish(id: number, actorId: number) {
    const workshop = await this.database.workshop.publish(id, actorId);
    if (!workshop) throw new NotFoundException('پیش‌نویس کارگاه پیدا نشد.');
    return workshop;
  }

  async requestRevision(id: number, actorId: number, note: string) {
    const workshop = await this.database.workshop.requestRevision(id, actorId, note);
    if (!workshop) throw new NotFoundException('Submitted workshop was not found.');
    return workshop;
  }
}
