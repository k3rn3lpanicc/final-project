import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { VoterRequestResponseDto, SignatureDataDto, AdminPublicKeyDto } from '../common/dto';

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
  @ApiOperation({
    summary: 'List all voter registration requests',
    description: 'Get all pending, approved, and rejected voter registration requests',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all requests',
    type: [VoterRequestResponseDto],
  })
  async listRequests(): Promise<VoterRequestResponseDto[]> {
    return this.adminService.listAllRequests();
  }

  @Get('requests/pending')
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
}
