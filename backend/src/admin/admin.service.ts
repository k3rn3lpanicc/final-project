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

  async listAllRequests(page: number = 1, limit: number = 10, status?: string) {
    const skip = (page - 1) * limit;
    
    const whereCondition: any = {};
    if (status && ['pending', 'approved', 'rejected', 'auto_rejected'].includes(status)) {
      whereCondition.status = status as RequestStatus;
    }

    const [requests, total] = await this.voterRequestRepository.findAndCount({
      where: whereCondition,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const data = requests.map((req) => ({
      id: req.id,
      fullName: req.fullName,
      passportNumber: req.passportNumber,
      dateOfBirth: req.dateOfBirth,
      nationality: req.nationality,
      status: req.status,
      voterId: req.voterId,
      secretX: req.secretX,
      hashXp: req.hashXp,
      createdAt: req.createdAt,
      passportImagePath: req.passportImagePath,
      photoImagePath: req.photoImagePath,
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
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
      hashXp: req.hashXp,
      createdAt: req.createdAt,
    }));
  }

  async getRequestDetails(id: string) {
    const request = await this.voterRequestRepository.findOne({ where: { id } });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    const result: any = {
      id: request.id,
      fullName: request.fullName,
      passportNumber: request.passportNumber,
      dateOfBirth: request.dateOfBirth,
      nationality: request.nationality,
      status: request.status,
      voterId: request.voterId,
      secretX: request.secretX,
      hashXp: request.hashXp,
      passportImagePath: request.passportImagePath,
      photoImagePath: request.photoImagePath,
      adminNotes: request.adminNotes,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };

    // Include signature data if approved
    if (request.status === RequestStatus.APPROVED && request.signatureR8x) {
      result.signature = {
        signatureR8x: request.signatureR8x,
        signatureR8y: request.signatureR8y,
        signatureS: request.signatureS,
        publicKeyX: request.publicKeyX,
        publicKeyY: request.publicKeyY,
      };
    }

    return result;
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
      BigInt(request.hashXp),
    );

    const publicKey = await this.cryptoService.getPublicKey(this.adminPrivateKey);

    // Verify signature before saving
    const isValid = await this.cryptoService.verifySignature(
      publicKey.x,
      publicKey.y,
      signature.R8x,
      signature.R8y,
      signature.S,
      BigInt(request.voterId),
      BigInt(request.secretX),
      BigInt(request.hashXp),
    );

    if (!isValid) {
      throw new Error('Generated signature verification failed');
    }

    console.log('✅ Signature verified successfully before saving');

    // Update request
    request.status = RequestStatus.APPROVED;
    request.signatureR8x = signature.R8x;
    request.signatureR8y = signature.R8y;
    request.signatureS = signature.S;
    request.publicKeyX = publicKey.x;
    request.publicKeyY = publicKey.y;
    request.adminNotes = adminNotes || null;

    await this.voterRequestRepository.save(request);

    // Auto-reject all other pending requests with the same passport number (except this one)
    await this.voterRequestRepository
      .createQueryBuilder()
      .update(VoterRequest)
      .set({ status: RequestStatus.AUTO_REJECTED })
      .where('passportNumber = :passportNumber', { passportNumber: request.passportNumber })
      .andWhere('status = :status', { status: RequestStatus.PENDING })
      .andWhere('id != :id', { id: request.id })
      .execute();

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
