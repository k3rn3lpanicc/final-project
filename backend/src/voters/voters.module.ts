import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VotersController } from './voters.controller';
import { ElectionsController } from './elections.controller';
import { VotersService } from './voters.service';
import { VoterRequest } from '../database/voter-request.entity';
import { Election } from '../database/election.entity';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [TypeOrmModule.forFeature([VoterRequest, Election]), AdminModule],
  controllers: [VotersController, ElectionsController],
  providers: [VotersService],
})
export class VotersModule {}
