import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Get,
  Param,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiResponse, ApiBody } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { VotersService } from './voters.service';
import { CreateVoterRequestDto, VoterRequestResponseDto, SignatureDataDto } from '../common/dto';
import type { Multer } from 'multer';

@ApiTags('voters')
@Controller('voters')
export class VotersController {
  constructor(private readonly votersService: VotersService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Submit voter registration request',
    description: 'Upload passport image, photo, and personal information to request voter registration',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['fullName', 'passportNumber', 'dateOfBirth', 'nationality', 'voterId', 'secretX', 'secretXp', 'passportImage', 'photo'],
      properties: {
        fullName: { type: 'string', example: 'John Doe' },
        passportNumber: { type: 'string', example: 'AB1234567' },
        dateOfBirth: { type: 'string', example: '1990-01-15' },
        nationality: { type: 'string', example: 'United States' },
        voterId: { type: 'string', example: '12345678901234567890123456789012345678901234567890' },
        secretX: { type: 'string', example: '98765432109876543210987654321098765432109876543210' },
        secretXp: { type: 'string', example: '11111111111111111111111111111111111111111111111111' },
        passportImage: {
          type: 'string',
          format: 'binary',
          description: 'Passport image file (JPG, PNG)',
        },
        photo: {
          type: 'string',
          format: 'binary',
          description: 'Voter photo file (JPG, PNG)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Registration request submitted successfully',
    type: VoterRequestResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - missing files or invalid data',
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'passportImage', maxCount: 1 },
        { name: 'photo', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: process.env.UPLOAD_DIR || './uploads',
          filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, file.fieldname + '-' + uniqueSuffix + extname(file.originalname));
          },
        }),
        fileFilter: (req, file, cb) => {
          if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
            return cb(new BadRequestException('Only image files are allowed'), false);
          }
          cb(null, true);
        },
        limits: {
          fileSize: 10 * 1024 * 1024, // 10MB
        },
      },
    ),
  )
  async register(
    @UploadedFiles()
    files: {
      passportImage?: Multer.File[];
      photo?: Multer.File[];
    },
    @Body() createVoterRequestDto: CreateVoterRequestDto,
  ): Promise<VoterRequestResponseDto> {
    if (!files.passportImage || !files.photo) {
      throw new BadRequestException('Both passportImage and photo files are required');
    }

    return this.votersService.createRequest(
      createVoterRequestDto,
      files.passportImage[0],
      files.photo[0],
    );
  }

  @Get('request/:id')
  @ApiOperation({
    summary: 'Get voter request by ID',
    description: 'Retrieve voter registration request details including status',
  })
  @ApiResponse({
    status: 200,
    description: 'Request found',
    type: VoterRequestResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Request not found',
  })
  async getRequest(@Param('id') id: string): Promise<VoterRequestResponseDto> {
    return this.votersService.getRequest(id);
  }

  @Get('signature/:id')
  @ApiOperation({
    summary: 'Get signature data for approved request',
    description: 'Retrieve signature data needed to generate zero-knowledge proof. Only available for approved requests.',
  })
  @ApiResponse({
    status: 200,
    description: 'Signature data retrieved',
    type: SignatureDataDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Request not found or not approved',
  })
  async getSignature(@Param('id') id: string): Promise<SignatureDataDto> {
    return this.votersService.getSignature(id);
  }
}
