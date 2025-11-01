import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  NotFoundException,
  BadRequestException,
  Res,
  StreamableFile,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { AdminService } from './admin.service';
import { VoterRequestResponseDto, SignatureDataDto, AdminPublicKeyDto } from '../common/dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('public-key')
  @ApiOperation({
    summary: 'Get admin public key',
    description: 'Retrieve the admin EdDSA public key derived from the private key',
  })
  @ApiResponse({
    status: 200,
    description: 'Public key retrieved successfully',
    type: AdminPublicKeyDto,
  })
  async getPublicKey(): Promise<AdminPublicKeyDto> {
    return this.adminService.getPublicKey();
  }

  @Get('requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List all voter registration requests with pagination',
    description: 'Get all pending, approved, and rejected voter registration requests with pagination support',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page number (starts from 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10, description: 'Number of items per page' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'rejected'], description: 'Filter by status' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of requests',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        pagination: {
          type: 'object',
          properties: {
            currentPage: { type: 'number' },
            totalPages: { type: 'number' },
            totalItems: { type: 'number' },
            itemsPerPage: { type: 'number' },
            hasNextPage: { type: 'boolean' },
            hasPrevPage: { type: 'boolean' },
          },
        },
      },
    },
  })
  async listRequests(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.adminService.listAllRequests(pageNum, limitNum, status);
  }

  @Get('requests/pending')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List pending voter registration requests',
    description: 'Get all voter registration requests that are awaiting admin approval',
  })
  @ApiResponse({
    status: 200,
    description: 'List of pending requests',
    type: [VoterRequestResponseDto],
  })
  async listPendingRequests(): Promise<VoterRequestResponseDto[]> {
    return this.adminService.listPendingRequests();
  }

  @Get('request/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get detailed voter request',
    description: 'Retrieve full details of a specific voter registration request including file paths',
  })
  @ApiResponse({
    status: 200,
    description: 'Request details retrieved',
  })
  @ApiResponse({
    status: 404,
    description: 'Request not found',
  })
  async getRequestDetails(@Param('id') id: string) {
    return this.adminService.getRequestDetails(id);
  }

  @Post('request/:id/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Approve voter registration request',
    description: 'Sign the voter credentials with admin private key and mark request as approved',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        adminNotes: {
          type: 'string',
          example: 'Verified passport details match.',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Request approved and signed successfully',
    type: SignatureDataDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Request not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Request already processed',
  })
  async approveRequest(
    @Param('id') id: string,
    @Body() body: { adminNotes?: string },
  ): Promise<SignatureDataDto> {
    return this.adminService.approveRequest(id, body.adminNotes);
  }

  @Post('request/:id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reject voter registration request',
    description: 'Reject a voter registration request with optional reason',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        adminNotes: {
          type: 'string',
          example: 'Passport image unclear, please resubmit.',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Request rejected successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Request not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Request already processed',
  })
  async rejectRequest(
    @Param('id') id: string,
    @Body() body: { adminNotes?: string },
  ): Promise<{ message: string }> {
    return this.adminService.rejectRequest(id, body.adminNotes);
  }

  @Get('request/:id/image/:type')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get voter image',
    description: 'Retrieve passport or photo image for a specific voter request',
  })
  @ApiResponse({
    status: 200,
    description: 'Image retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Request or image not found',
  })
  async getImage(
    @Param('id') id: string,
    @Param('type') type: 'passport' | 'photo',
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const request = await this.adminService.getRequestDetails(id);
    
    const imagePath = type === 'passport' ? request.passportImagePath : request.photoImagePath;
    const fullPath = join(process.cwd(), imagePath);

    if (!existsSync(fullPath)) {
      throw new NotFoundException('Image file not found');
    }

    const file = createReadStream(fullPath);
    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Disposition': `inline; filename="${type}-${id}.jpg"`,
    });

    return new StreamableFile(file);
  }
}
