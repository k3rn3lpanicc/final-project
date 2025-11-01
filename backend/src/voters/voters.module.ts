import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VotersController } from './voters.controller';
import { VotersService } from './voters.service';
import { VoterRequest } from '../database/voter-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VoterRequest])],
  controllers: [VotersController],
  providers: [VotersService],
})
export class VotersModule {}
