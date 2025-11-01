import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VoterRequest, RequestStatus } from '../database/voter-request.entity';
import { CryptoService } from '../common/crypto.service';
import { VoterRequestResponseDto, SignatureDataDto, AdminPublicKeyDto } from '../common/dto';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class AdminService {
  private readonly adminPrivateKey: string;

  constructor(
    @InjectRepository(VoterRequest)
    private voterRequestRepository: Repository<VoterRequest>,
    private cryptoService: CryptoService,
  ) {
    this.adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    if (!this.adminPrivateKey) {
      throw new Error('ADMIN_PRIVATE_KEY not found in environment variables');
    }
  }

  async getPublicKey(): Promise<AdminPublicKeyDto> {
    const publicKey = await this.cryptoService.getPublicKey(this.adminPrivateKey);
    return {
      publicKeyX: publicKey.x,
      publicKeyY: publicKey.y,
    };
  }

  async listAllRequests(): Promise<VoterRequestResponseDto[]> {
    const requests = await this.voterRequestRepository.find({
      order: { createdAt: 'DESC' },
    });

    return requests.map((req) => ({
      id: req.id,
      fullName: req.fullName,
      passportNumber: req.passportNumber,
      dateOfBirth: req.dateOfBirth,
      nationality: req.nationality,
      status: req.status,
      voterId: req.voterId,
      secretX: req.secretX,
      secretXp: req.secretXp,
      createdAt: req.createdAt,
    }));
  }

  async listPendingRequests(): Promise<VoterRequestResponseDto[]> {
    const requests = await this.voterRequestRepository.find({
      where: { status: RequestStatus.PENDING },
      order: { createdAt: 'DESC' },
    });

    return requests.map((req) => ({
      id: req.id,
      fullName: req.fullName,
      passportNumber: req.passportNumber,
      dateOfBirth: req.dateOfBirth,
      nationality: req.nationality,
      status: req.status,
      voterId: req.voterId,
      secretX: req.secretX,
      secretXp: req.secretXp,
      createdAt: req.createdAt,
    }));
  }

  async getRequestDetails(id: string) {
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
      secretXp: request.secretXp,
      passportImagePath: request.passportImagePath,
      photoImagePath: request.photoImagePath,
      adminNotes: request.adminNotes,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  async approveRequest(id: string, adminNotes?: string): Promise<SignatureDataDto> {
    const request = await this.voterRequestRepository.findOne({ where: { id } });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Request has already been processed');
    }

    // Generate signature using admin private key
    const signature = await this.cryptoService.signCredentials(
      this.adminPrivateKey,
      BigInt(request.voterId),
      BigInt(request.secretX),
      BigInt(request.secretXp),
    );

    const publicKey = await this.cryptoService.getPublicKey(this.adminPrivateKey);

    // Update request
    request.status = RequestStatus.APPROVED;
    request.signatureR8x = signature.R8x;
    request.signatureR8y = signature.R8y;
    request.signatureS = signature.S;
    request.publicKeyX = publicKey.x;
    request.publicKeyY = publicKey.y;
    request.adminNotes = adminNotes || null;

    await this.voterRequestRepository.save(request);

    return {
      signatureR8x: signature.R8x,
      signatureR8y: signature.R8y,
      signatureS: signature.S,
      publicKeyX: publicKey.x,
      publicKeyY: publicKey.y,
    };
  }

  async rejectRequest(id: string, adminNotes?: string): Promise<{ message: string }> {
    const request = await this.voterRequestRepository.findOne({ where: { id } });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Request has already been processed');
    }

    request.status = RequestStatus.REJECTED;
    request.adminNotes = adminNotes || null;

    await this.voterRequestRepository.save(request);

    return { message: 'Request rejected successfully' };
  }
}
