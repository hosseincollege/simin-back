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

  @Get('review-queue')
  @UseGuards(JwtAuthGuard, AdminGuard)
  listPendingReview() {
    return this.workshops.listPendingReview();
  }

  @Get('mine/:id')
  @UseGuards(JwtAuthGuard)
  getOwned(@Param('id', ParseIntPipe) id: number, @Request() request: RequestWithUser) {
    return this.workshops.getOwned(id, request.user.sub);
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
  @UseGuards(JwtAuthGuard, AdminGuard)
  publish(@Param('id', ParseIntPipe) id: number, @Request() request: RequestWithUser) {
    return this.workshops.publish(id, request.user.sub);
  }

  @Post(':id/request-revision')
  @UseGuards(JwtAuthGuard, AdminGuard)
  requestRevision(@Param('id', ParseIntPipe) id: number, @Body() data: RevisionRequestDto, @Request() request: RequestWithUser) {
    return this.workshops.requestRevision(id, request.user.sub, data.note);
  }
}
