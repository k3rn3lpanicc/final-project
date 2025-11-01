import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVoterRequestDto {
  @ApiProperty({
    description: 'Full name of the voter',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    description: 'Passport number',
    example: 'AB1234567',
  })
  @IsString()
  @IsNotEmpty()
  passportNumber: string;

  @ApiProperty({
    description: 'Date of birth (YYYY-MM-DD)',
    example: '1990-01-15',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  dateOfBirth: string;

  @ApiProperty({
    description: 'Nationality',
    example: 'United States',
  })
  @IsString()
  @IsNotEmpty()
  nationality: string;
}

export class VoterRequestResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  fullName: string;

  @ApiProperty({ example: 'AB1234567' })
  passportNumber: string;

  @ApiProperty({ example: '1990-01-15' })
  dateOfBirth: string;

  @ApiProperty({ example: 'United States' })
  nationality: string;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiProperty({ example: '12345678901234567890' })
  voterId: string;

  @ApiProperty({ example: '98765432109876543210' })
  secretX: string;

  @ApiProperty({ example: '11111111111111111111' })
  secretXp: string;

  @ApiProperty({ example: '2025-11-01T10:00:00.000Z', required: false })
  createdAt?: Date;
}

export class SignatureDataDto {
  @ApiProperty({
    description: 'Signature R8 x-coordinate',
    example: '1234567890123456789012345678901234567890',
  })
  signatureR8x: string;

  @ApiProperty({
    description: 'Signature R8 y-coordinate',
    example: '9876543210987654321098765432109876543210',
  })
  signatureR8y: string;

  @ApiProperty({
    description: 'Signature S value',
    example: '5555555555555555555555555555555555555555',
  })
  signatureS: string;

  @ApiProperty({
    description: 'Public key x-coordinate',
    example: '1111111111111111111111111111111111111111',
  })
  publicKeyX: string;

  @ApiProperty({
    description: 'Public key y-coordinate',
    example: '2222222222222222222222222222222222222222',
  })
  publicKeyY: string;
}

export class AdminPublicKeyDto {
  @ApiProperty({
    description: 'Admin public key x-coordinate',
    example: '16540640123574156134436876038791482806971768689494387082833631921987005038935',
  })
  publicKeyX: string;

  @ApiProperty({
    description: 'Admin public key y-coordinate',
    example: '20634138280259599560273310290025659992320584624461316485434108770067472477956',
  })
  publicKeyY: string;
}
