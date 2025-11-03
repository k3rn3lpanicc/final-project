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
  Delete,
  Put,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { AdminService } from './admin.service';
import { ElectionService } from './election.service';
import { VoterRequestResponseDto, SignatureDataDto, AdminPublicKeyDto } from '../common/dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly electionService: ElectionService,
  ) {}

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

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get request statistics',
    description: 'Get counts of requests by status',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        pending: { type: 'number' },
        approved: { type: 'number' },
        rejected: { type: 'number' },
        auto_rejected: { type: 'number' },
      },
    },
  })
  async getStats() {
    return this.adminService.getStats();
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
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'rejected', 'auto_rejected'], description: 'Filter by status' })
  @ApiQuery({ name: 'electionId', required: false, type: Number, description: 'Filter by election ID' })
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
    @Query('electionId') electionId?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const electionIdNum = electionId ? parseInt(electionId, 10) : undefined;
    return this.adminService.listAllRequests(pageNum, limitNum, status, electionIdNum);
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

  // Election management endpoints
  @Post('elections')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create new election',
    description: 'Create a new election with name, description and voting options',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'description', 'options'],
      properties: {
        name: { type: 'string', example: 'Presidential Election 2024' },
        description: { type: 'string', example: 'Vote for the next president' },
        options: { type: 'array', items: { type: 'string' }, example: ['Candidate A', 'Candidate B', 'Candidate C'] },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Election created successfully' })
  async createElection(@Body() body: { name: string; description: string; options: string[] }) {
    return this.electionService.createElection(body);
  }

  @Get('elections')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all elections',
    description: 'Retrieve all elections (admin view)',
  })
  @ApiResponse({ status: 200, description: 'Elections retrieved successfully' })
  async getAllElections() {
    return this.electionService.getAllElections();
  }

  @Get('elections/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get election by ID',
    description: 'Retrieve a specific election details',
  })
  @ApiResponse({ status: 200, description: 'Election retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Election not found' })
  async getElectionById(@Param('id') id: string) {
    return this.electionService.getElectionById(parseInt(id, 10));
  }

  @Put('elections/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update election',
    description: 'Update election details or active status',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Presidential Election 2024' },
        description: { type: 'string', example: 'Updated description' },
        options: { type: 'array', items: { type: 'string' } },
        isActive: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Election updated successfully' })
  @ApiResponse({ status: 404, description: 'Election not found' })
  async updateElection(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; options?: string[]; isActive?: boolean },
  ) {
    return this.electionService.updateElection(parseInt(id, 10), body);
  }

  @Delete('elections/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete election',
    description: 'Delete an election',
  })
  @ApiResponse({ status: 200, description: 'Election deleted successfully' })
  @ApiResponse({ status: 404, description: 'Election not found' })
  async deleteElection(@Param('id') id: string) {
    await this.electionService.deleteElection(parseInt(id, 10));
    return { message: 'Election deleted successfully' };
  }
}
