import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ElectionService } from './election.service';
import { VoterRequest } from '../database/voter-request.entity';
import { Election } from '../database/election.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VoterRequest, Election])],
  controllers: [AdminController],
  providers: [AdminService, ElectionService],
  exports: [ElectionService],
})
export class AdminModule {}
