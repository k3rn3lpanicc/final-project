import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VoterRequest, RequestStatus } from '../database/voter-request.entity';
import { CreateVoterRequestDto, VoterRequestResponseDto, SignatureDataDto } from '../common/dto';
import { CryptoService } from '../common/crypto.service';
import type { Multer } from 'multer';

@Injectable()
export class VotersService {
  constructor(
    @InjectRepository(VoterRequest)
    private voterRequestRepository: Repository<VoterRequest>,
    private cryptoService: CryptoService,
  ) {}

  async createRequest(
    dto: CreateVoterRequestDto,
    passportImage: Multer.File,
    photo: Multer.File,
  ): Promise<VoterRequestResponseDto> {
    // Check if an approved request already exists for this passport number
    const existingApprovedRequest = await this.voterRequestRepository.findOne({
      where: {
        passportNumber: dto.passportNumber,
        status: RequestStatus.APPROVED,
      },
    });

    if (existingApprovedRequest) {
      throw new BadRequestException('A request with this passport number has already been approved');
    }

    // Use credentials provided by the frontend
    const request = this.voterRequestRepository.create({
      fullName: dto.fullName,
      passportNumber: dto.passportNumber,
      dateOfBirth: dto.dateOfBirth,
      nationality: dto.nationality,
      passportImagePath: passportImage.path,
      photoImagePath: photo.path,
      voterId: dto.voterId,
      secretX: dto.secretX,
      hashXp: dto.hashXp,
      electionId: dto.electionId,
      status: RequestStatus.PENDING,
    });

    const saved = await this.voterRequestRepository.save(request);

    return {
      id: saved.id,
      fullName: saved.fullName,
      passportNumber: saved.passportNumber,
      dateOfBirth: saved.dateOfBirth,
      nationality: saved.nationality,
      status: saved.status,
      voterId: saved.voterId,
      secretX: saved.secretX,
      hashXp: saved.hashXp,
      electionId: saved.electionId,
      createdAt: saved.createdAt,
    };
  }

  async getRequest(id: string): Promise<VoterRequestResponseDto> {
    const request = await this.voterRequestRepository.findOne({ where: { id } });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    return {
      id: request.id,
      fullName: request.fullName,
      passportNumber: request.passportNumber,
      dateOfBirth: request.dateOfBirth,
      nationality: request.nationality,
      status: request.status,
      voterId: request.voterId,
      secretX: request.secretX,
      hashXp: request.hashXp,
      electionId: request.electionId,
      createdAt: request.createdAt,
    };
  }

  async getSignature(id: string): Promise<SignatureDataDto> {
    const request = await this.voterRequestRepository.findOne({ where: { id } });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.status !== RequestStatus.APPROVED) {
      throw new BadRequestException('Request has not been approved yet');
    }

    if (!request.signatureR8x || !request.signatureR8y || !request.signatureS) {
      throw new BadRequestException('Signature data not available');
    }

    return {
      signatureR8x: request.signatureR8x,
      signatureR8y: request.signatureR8y,
      signatureS: request.signatureS,
      publicKeyX: request.publicKeyX,
      publicKeyY: request.publicKeyY,
    };
  }
}
