import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ElectionService } from '../admin/election.service';

@ApiTags('elections')
@Controller('elections')
export class ElectionsController {
  constructor(private readonly electionService: ElectionService) {}

  @Get()
  @ApiOperation({
    summary: 'Get active elections',
    description: 'Retrieve all active elections available for voting (public endpoint)',
  })
  @ApiResponse({ status: 200, description: 'Active elections retrieved successfully' })
  async getActiveElections() {
    return this.electionService.getActiveElections();
  }
}
