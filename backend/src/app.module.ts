import { Module, OnModuleInit, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VotersModule } from './voters/voters.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { VoterRequest } from './database/voter-request.entity';
import { User } from './database/user.entity';
import { Election } from './database/election.entity';
import { CryptoService } from './common/crypto.service';
import * as dotenv from 'dotenv';

dotenv.config();

@Global()
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_PATH || './database.sqlite',
      entities: [VoterRequest, User, Election],
      synchronize: true,
      logging: false,
    }),
    VotersModule,
    AdminModule,
    AuthModule,
  ],
  providers: [CryptoService],
  exports: [CryptoService],
})
export class AppModule implements OnModuleInit {
  constructor(private cryptoService: CryptoService) {}

  async onModuleInit() {
    await this.cryptoService.init();
  }
}
