import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Election } from '../database/election.entity';

@Injectable()
export class ElectionService {
  constructor(
    @InjectRepository(Election)
    private electionRepository: Repository<Election>,
  ) {}

  async createElection(data: {
    name: string;
    description: string;
    options: string[];
  }): Promise<Election> {
    const election = this.electionRepository.create(data);
    return await this.electionRepository.save(election);
  }

  async getAllElections(): Promise<Election[]> {
    return await this.electionRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getActiveElections(): Promise<Election[]> {
    return await this.electionRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getElectionById(id: number): Promise<Election> {
    const election = await this.electionRepository.findOne({ where: { id } });
    if (!election) {
      throw new NotFoundException('Election not found');
    }
    return election;
  }

  async updateElection(
    id: number,
    data: {
      name?: string;
      description?: string;
      options?: string[];
      isActive?: boolean;
    },
  ): Promise<Election> {
    const election = await this.getElectionById(id);
    Object.assign(election, data);
    return await this.electionRepository.save(election);
  }

  async deleteElection(id: number): Promise<void> {
    const election = await this.getElectionById(id);
    await this.electionRepository.remove(election);
  }
}
