import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum RequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  AUTO_REJECTED = 'auto_rejected',
}

@Entity('voter_requests')
export class VoterRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fullName: string;

  @Column()
  passportNumber: string;

  @Column()
  dateOfBirth: string;

  @Column()
  nationality: string;

  @Column()
  passportImagePath: string;

  @Column()
  photoImagePath: string;

  @Column({ type: 'text' })
  voterId: string; // BigInt as string

  @Column({ type: 'text' })
  secretX: string; // BigInt as string

  @Column({ type: 'text' })
  secretXp: string; // BigInt as string

  @Column({
    type: 'text',
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @Column({ type: 'text', nullable: true })
  signatureR8x: string; // Signature R8[0]

  @Column({ type: 'text', nullable: true })
  signatureR8y: string; // Signature R8[1]

  @Column({ type: 'text', nullable: true })
  signatureS: string; // Signature S

  @Column({ type: 'text', nullable: true })
  publicKeyX: string; // Public key A[0]

  @Column({ type: 'text', nullable: true })
  publicKeyY: string; // Public key A[1]

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text', nullable: true })
  adminNotes: string;
}
