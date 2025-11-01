import { DataSource } from 'typeorm';
import { VoterRequest } from './voter-request.entity';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: process.env.DATABASE_PATH || './database.sqlite',
  entities: [VoterRequest],
  synchronize: true,
  logging: false,
});
