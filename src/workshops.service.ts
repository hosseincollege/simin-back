import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { WorkshopDto } from './workshop.dto.js';
import { WorkshopInquiryDto } from './workshop-inquiry.dto.js';
import { WorkshopReportDto } from './workshop-report.dto.js';

@Injectable()
export class WorkshopsService {
  constructor(private readonly database: PrismaService) {}

  listPublished() {
    return this.database.workshop.findPublished();
  }

  listOwned(ownerId: number) {
    return this.database.workshop.findByOwner(ownerId);
  }

  listInterests(userId: number) {
    return this.database.workshop.findInterests(userId);
  }

  async addInterest(workshopId: number, userId: number) {
    const result = await this.database.workshop.addInterest(workshopId, userId);
    if (!result) throw new NotFoundException('Published workshop was not found.');
    return result;
  }

  removeInterest(workshopId: number, userId: number) {
    return this.database.workshop.removeInterest(workshopId, userId);
  }

  async createInquiry(workshopId: number, investorId: number, data: WorkshopInquiryDto) {
    if (data.consentToShareIdentity !== true) throw new BadRequestException('برای ارسال درخواست معرفی باید رضایت اشتراک نام و نام کاربری ثبت شود.');
    const workshop = await this.getPublished(workshopId);
    if (workshop.owner_id === investorId) throw new BadRequestException('مالک کارگاه نمی‌تواند برای پروندهٔ خودش درخواست معرفی بفرستد.');
    const inquiry = await this.database.workshop.createInquiry(workshopId, investorId, data.message.trim());
    if (!inquiry) throw new ConflictException('برای این کارگاه قبلاً درخواست معرفی فرستاده‌اید.');
    return inquiry;
  }

  listInvestorInquiries(investorId: number) { return this.database.workshop.listInvestorInquiries(investorId); }

  async listOwnedInquiries(workshopId: number, ownerId: number) {
    await this.getOwned(workshopId, ownerId);
    return this.database.workshop.listOwnedInquiries(workshopId, ownerId);
  }

  async updateInquiryStatus(workshopId: number, inquiryId: number, ownerId: number, status: 'contacted' | 'closed') {
    const result = await this.database.workshop.updateInquiryStatus(workshopId, inquiryId, ownerId, status);
    if (!result) throw new NotFoundException('درخواست معرفی پیدا نشد.');
    return result;
  }

  listPendingReview() {
    return this.database.workshop.findPendingReview();
  }

  listPendingReports() { return this.database.workshop.findPendingReports(); }

  async listOwnedReports(id: number, ownerId: number) {
    await this.getOwned(id, ownerId);
    return this.database.workshop.findReports(id, false);
  }

  async listPublicReports(id: number) {
    await this.getPublished(id);
    return this.database.workshop.findReports(id, true);
  }

  async createReport(id: number, ownerId: number, data: WorkshopReportDto) {
    await this.getOwned(id, ownerId);
    const result = await this.database.workshop.createReport(id, ownerId, data);
    if (!result) throw new BadRequestException('A report for this year and month already exists.');
    return result;
  }

  async updateReport(id: number, reportId: number, ownerId: number, data: WorkshopReportDto) {
    await this.getOwned(id, ownerId);
    const result = await this.database.workshop.updateReport(id, reportId, ownerId, data);
    if (!result) throw new NotFoundException('گزارش پیدا نشد.');
    return result;
  }

  async reportHistory(id: number, reportId: number, ownerId: number) {
    await this.getOwned(id, ownerId);
    return this.database.workshop.findReportRevisions(id, reportId, ownerId);
  }

  async checkReport(id: number, reportId: number, actorId: number) {
    const result = await this.database.workshop.checkReport(id, reportId, actorId);
    if (!result) throw new NotFoundException('Pending report was not found.');
    return result;
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
    this.validateFundingBreakdown(data);
    return this.database.workshop.create({ ownerId, data });
  }

  async updateOwned(id: number, ownerId: number, data: WorkshopDto) {
    this.validateFundingBreakdown(data);
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

  private validateFundingBreakdown(data: WorkshopDto) {
    if (data.equipmentAmount + data.workingCapitalAmount + data.otherCostsAmount !== data.requiredCapital) {
      throw new BadRequestException('جمع اجزای مصرف سرمایه باید با کل سرمایهٔ موردنیاز برابر باشد.');
    }
  }
}
