import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { JwtAuthGuard } from './auth.controller.js';
import { WorkshopDto } from './workshop.dto.js';
import { WorkshopsService } from './workshops.service.js';
import { WorkshopReportDto } from './workshop-report.dto.js';
import { WorkshopInquiryDto, WorkshopInquiryStatusDto } from './workshop-inquiry.dto.js';

type RequestWithUser = { user: { sub: number; role: string } };

class RevisionRequestDto {
  @IsString()
  @Length(5, 1000)
  note!: string;
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request.user?.role === 'admin';
  }
}

@Injectable()
export class ReviewGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request.user?.role === 'admin' || request.user?.role === 'reviewer';
  }
}

@Controller('api/workshops')
export class WorkshopsController {
  constructor(private readonly workshops: WorkshopsService) {}

  @Get()
  listPublished() {
    return this.workshops.listPublished();
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  listOwned(@Request() request: RequestWithUser) {
    return this.workshops.listOwned(request.user.sub);
  }

  @Get('interests/mine')
  @UseGuards(JwtAuthGuard)
  listInterests(@Request() request: RequestWithUser) {
    return this.workshops.listInterests(request.user.sub);
  }

  @Get('mine/inquiries')
  @UseGuards(JwtAuthGuard)
  investorInquiries(@Request() request: RequestWithUser) {
    return this.workshops.listInvestorInquiries(request.user.sub);
  }

  @Get('mine/:id/inquiries')
  @UseGuards(JwtAuthGuard)
  ownedInquiries(@Param('id', ParseIntPipe) id: number, @Request() request: RequestWithUser) {
    return this.workshops.listOwnedInquiries(id, request.user.sub);
  }

  @Patch('mine/:id/inquiries/:inquiryId')
  @UseGuards(JwtAuthGuard)
  updateInquiryStatus(@Param('id', ParseIntPipe) id: number, @Param('inquiryId', ParseIntPipe) inquiryId: number,
    @Body() data: WorkshopInquiryStatusDto, @Request() request: RequestWithUser) {
    return this.workshops.updateInquiryStatus(id, inquiryId, request.user.sub, data.status);
  }

  @Post(':id/interest')
  @UseGuards(JwtAuthGuard)
  addInterest(@Param('id', ParseIntPipe) id: number, @Request() request: RequestWithUser) {
    return this.workshops.addInterest(id, request.user.sub);
  }

  @Post(':id/inquiries')
  @UseGuards(JwtAuthGuard)
  createInquiry(@Param('id', ParseIntPipe) id: number, @Body() data: WorkshopInquiryDto, @Request() request: RequestWithUser) {
    return this.workshops.createInquiry(id, request.user.sub, data);
  }

  @Post(':id/interest/remove')
  @UseGuards(JwtAuthGuard)
  removeInterest(@Param('id', ParseIntPipe) id: number, @Request() request: RequestWithUser) {
    return this.workshops.removeInterest(id, request.user.sub);
  }

  @Get('review-queue')
  @UseGuards(JwtAuthGuard, ReviewGuard)
  listPendingReview() {
    return this.workshops.listPendingReview();
  }

  @Get('reports/review-queue')
  @UseGuards(JwtAuthGuard, ReviewGuard)
  reportReviewQueue() {
    return this.workshops.listPendingReports();
  }

  @Get('mine/:id')
  @UseGuards(JwtAuthGuard)
  getOwned(@Param('id', ParseIntPipe) id: number, @Request() request: RequestWithUser) {
    return this.workshops.getOwned(id, request.user.sub);
  }

  @Get('mine/:id/reports')
  @UseGuards(JwtAuthGuard)
  ownedReports(@Param('id', ParseIntPipe) id: number, @Request() request: RequestWithUser) {
    return this.workshops.listOwnedReports(id, request.user.sub);
  }

  @Get('mine/:id/reports/:reportId/history')
  @UseGuards(JwtAuthGuard)
  reportHistory(@Param('id', ParseIntPipe) id: number, @Param('reportId', ParseIntPipe) reportId: number, @Request() request: RequestWithUser) {
    return this.workshops.reportHistory(id, reportId, request.user.sub);
  }

  @Get(':id/reports')
  publicReports(@Param('id', ParseIntPipe) id: number) {
    return this.workshops.listPublicReports(id);
  }

  @Post(':id/reports')
  @UseGuards(JwtAuthGuard)
  createReport(@Param('id', ParseIntPipe) id: number, @Body() data: WorkshopReportDto, @Request() request: RequestWithUser) {
    return this.workshops.createReport(id, request.user.sub, data);
  }

  @Patch(':id/reports/:reportId')
  @UseGuards(JwtAuthGuard)
  updateReport(@Param('id', ParseIntPipe) id: number, @Param('reportId', ParseIntPipe) reportId: number, @Body() data: WorkshopReportDto, @Request() request: RequestWithUser) {
    return this.workshops.updateReport(id, reportId, request.user.sub, data);
  }

  @Post(':id/reports/:reportId/check')
  @UseGuards(JwtAuthGuard, ReviewGuard)
  checkReport(@Param('id', ParseIntPipe) id: number, @Param('reportId', ParseIntPipe) reportId: number, @Request() request: RequestWithUser) {
    return this.workshops.checkReport(id, reportId, request.user.sub);
  }

  @Get(':id/review-history')
  @UseGuards(JwtAuthGuard)
  reviewHistory(@Param('id', ParseIntPipe) id: number, @Request() request: RequestWithUser) {
    return this.workshops.reviewHistory(id, request.user.sub, request.user.role);
  }

  @Get(':id')
  getPublished(@Param('id', ParseIntPipe) id: number) {
    return this.workshops.getPublished(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() data: WorkshopDto, @Request() request: RequestWithUser) {
    return this.workshops.create(request.user.sub, data);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  updateOwned(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: WorkshopDto,
    @Request() request: RequestWithUser,
  ) {
    return this.workshops.updateOwned(id, request.user.sub, data);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  submitForReview(@Param('id', ParseIntPipe) id: number, @Request() request: RequestWithUser) {
    return this.workshops.submitForReview(id, request.user.sub);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, ReviewGuard)
  publish(@Param('id', ParseIntPipe) id: number, @Request() request: RequestWithUser) {
    return this.workshops.publish(id, request.user.sub);
  }

  @Post(':id/request-revision')
  @UseGuards(JwtAuthGuard, AdminGuard)
  requestRevision(@Param('id', ParseIntPipe) id: number, @Body() data: RevisionRequestDto, @Request() request: RequestWithUser) {
    return this.workshops.requestRevision(id, request.user.sub, data.note);
  }
}
