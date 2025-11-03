# Backend API

NestJS backend for managing voter registration, elections, and admin operations in the VoteScheme zkSNARK voting system.

## 📋 Overview

The backend provides a REST API for voter registration workflow, election management, and admin approval system with EdDSA signatures for zero-knowledge proof generation.

## ✨ Features

- **Voter Registration**: Upload passport images and personal information
- **Admin Approval**: Review and sign voter credentials with EdDSA
- **Election Management**: Create, update, and manage elections
- **Signature Distribution**: Provide approved voters with signature data for ZK proof generation
- **Authentication**: JWT-based authentication for users and admins
- **SQLite Database**: Persistent storage for voter requests and elections
- **Swagger Documentation**: Interactive API documentation at `/api`
- **File Upload**: Handle passport and photo uploads

## 🚀 Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Create a `.env` file in the backend directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DATABASE_PATH=./database.sqlite

# File Uploads
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880  # 5MB

# Admin Credentials (EdDSA Private Key)
ADMIN_PRIVATE_KEY=0001020304050607080900010203040506070809000102030405060708090001

# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRATION=24h

# CORS Settings
CORS_ORIGIN=http://localhost:5173,http://localhost:3001

# Blockchain (Optional - for contract interaction)
BLOCKCHAIN_RPC=https://data-seed-prebsc-1-s1.binance.org:8545/
ELECTION_CONTRACT_ADDRESS=0x...
```

### 3. Start the Server

```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

The server will start at `http://localhost:3000`

## 📚 API Endpoints

### Voter Endpoints

#### Register Voter
```http
POST /voters/register
Content-Type: multipart/form-data

Body:
- passportImage: File
- personalPhoto: File
- fullName: string
- dateOfBirth: string
- nationality: string
- email: string
```

**Response**:
```json
{
  "id": 1,
  "voterId": "12345...",
  "secretX": "67890...",
  "secretXp": "11111...",
  "status": "pending",
  "fullName": "John Doe",
  "email": "john@example.com"
}
```

#### Get Registration Status
```http
GET /voters/request/:id
```

#### Get Signature Data (Approved Only)
```http
GET /voters/signature/:id
```

**Response**:
```json
{
  "voterId": "12345...",
  "secretX": "67890...",
  "secretXp": "11111...",
  "signature": {
    "R8": ["...", "..."],
    "S": "...",
    "A": ["...", "..."]
  }
}
```

### Admin Endpoints

#### Login
```http
POST /admin/login
Content-Type: application/json

Body:
{
  "username": "admin",
  "password": "your-password"
}
```

#### Get Public Key
```http
GET /admin/public-key
```

**Response**:
```json
{
  "publicKey": {
    "x": "123456...",
    "y": "789012..."
  }
}
```

#### List All Requests
```http
GET /admin/requests
Query Parameters:
- status: pending | approved | rejected
- electionId: number (optional filter)
```

#### Get Request Details
```http
GET /admin/request/:id
```

#### Approve Request
```http
POST /admin/request/:id/approve
Authorization: Bearer <jwt-token>
```

**Response**:
```json
{
  "success": true,
  "signature": {
    "R8": [...],
    "S": "...",
    "A": [...]
  }
}
```

#### Reject Request
```http
POST /admin/request/:id/reject
Authorization: Bearer <jwt-token>

Body:
{
  "reason": "Invalid documents"
}
```

### Election Endpoints

#### Create Election
```http
POST /elections
Authorization: Bearer <jwt-token>
Content-Type: application/json

Body:
{
  "electionId": 1,
  "name": "Board Election 2025",
  "description": "Annual board member election",
  "options": ["Alice", "Bob", "Charlie"],
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-01-07T23:59:59Z",
  "publicKeyX": "123456...",
  "publicKeyY": "789012..."
}
```

#### List Elections
```http
GET /elections
Query Parameters:
- status: upcoming | active | closed
- page: number
- limit: number
```

#### Get Election Details
```http
GET /elections/:id
```

#### Update Election
```http
PUT /elections/:id
Authorization: Bearer <jwt-token>
```

#### Delete Election
```http
DELETE /elections/:id
Authorization: Bearer <jwt-token>
```

## 📊 Database Schema

### VoterRequest Table
```typescript
{
  id: number (PK)
  voterId: string (unique)
  secretX: string
  secretXp: string
  fullName: string
  dateOfBirth: string
  nationality: string
  email: string
  passportImagePath: string
  personalPhotoPath: string
  status: 'pending' | 'approved' | 'rejected'
  signatureData: JSON (nullable)
  createdAt: Date
  updatedAt: Date
  electionId: number (nullable, FK)
}
```

### Election Table
```typescript
{
  id: number (PK)
  electionId: number (unique)
  name: string
  description: string
  options: JSON (string[])
  publicKeyX: string
  publicKeyY: string
  startDate: Date
  endDate: Date
  status: 'upcoming' | 'active' | 'closed'
  contractAddress: string (nullable)
  createdAt: Date
  updatedAt: Date
}
```

## 🔐 Security

### Authentication
- JWT tokens for admin operations
- Bcrypt password hashing
- Token expiration (24h default)

### File Upload
- File type validation (images only)
- File size limits (5MB default)
- Sanitized file names
- Secure storage in `uploads/` directory

### EdDSA Signing
- Uses circomlibjs for signature generation
- Poseidon hash for message digest
- Baby Jubjub elliptic curve

### Input Validation
- DTO validation with class-validator
- SQL injection prevention via TypeORM
- CORS configuration

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📖 Swagger Documentation

Interactive API documentation available at:
```
http://localhost:3000/api
```

Features:
- Try out endpoints directly
- View request/response schemas
- Example payloads
- Authentication testing

## 🔧 Development

### Project Structure

```
backend/
├── src/
│   ├── admin/          # Admin module (approval, elections)
│   ├── voters/         # Voter module (registration, signatures)
│   ├── elections/      # Election management module
│   ├── auth/           # Authentication module
│   ├── common/         # Shared utilities, guards, decorators
│   ├── entities/       # TypeORM entities
│   ├── config/         # Configuration files
│   ├── app.module.ts   # Root module
│   └── main.ts         # Application entry point
├── uploads/            # Uploaded files storage
├── database.sqlite     # SQLite database file
└── test/               # Test files
```

### Add New Endpoint

1. Create a new module:
```bash
nest g module feature-name
nest g controller feature-name
nest g service feature-name
```

2. Define DTOs with validation:
```typescript
import { IsString, IsNumber } from 'class-validator';

export class CreateFeatureDto {
  @IsString()
  name: string;

  @IsNumber()
  value: number;
}
```

3. Implement service logic and add Swagger decorators

## 🚀 Deployment

### Production Build

```bash
npm run build
```

### Docker Deployment

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
COPY uploads ./uploads
EXPOSE 3000
CMD ["node", "dist/main"]
```

### Environment Variables

Ensure all production environment variables are set:
- Use strong JWT secrets
- Configure proper CORS origins
- Set NODE_ENV=production
- Use secure database credentials

## 📈 Monitoring

### Health Check
```http
GET /health
```

### Logs
```bash
# View logs
npm run start:prod | tee logs/app.log
```

## 🐛 Troubleshooting

### Database Issues
```bash
# Delete and recreate database
rm database.sqlite
npm run start:dev  # Auto-creates tables
```

### File Upload Errors
- Check `UPLOAD_DIR` permissions
- Verify file size limits
- Ensure proper Content-Type headers

### Signature Verification Fails
- Verify admin private key is correct
- Check Poseidon hash compatibility (use poseidon-lite)
- Ensure field values < BN128_FIELD

## 📄 License

ISC License

## 🆘 Support

For backend issues:
- Check logs in console
- Verify database schema
- Test endpoints via Swagger UI
- Check environment variable configuration
