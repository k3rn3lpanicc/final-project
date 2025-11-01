# Voter Registration Backend API

NestJS backend for managing voter registration requests with zero-knowledge proof signatures.

## Features

- **Voter Registration**: Upload passport images and personal information
- **Admin Approval**: Review and sign voter credentials with EdDSA
- **Signature Distribution**: Provide approved voters with signature data for ZK proof generation
- **SQLite Database**: Persistent storage for voter requests
- **Swagger Documentation**: Interactive API documentation at `/api`

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```
ADMIN_PRIVATE_KEY=0001020304050607080900010203040506070809000102030405060708090001
PORT=3000
DATABASE_PATH=./database.sqlite
UPLOAD_DIR=./uploads
```

3. Start the server:
```bash
npm start
```

## API Endpoints

### Voter Endpoints

- `POST /voters/register` - Submit voter registration with passport and photo
- `GET /voters/request/:id` - Get registration request status
- `GET /voters/signature/:id` - Get signature data (only for approved requests)

### Admin Endpoints

- `GET /admin/public-key` - Get admin's EdDSA public key
- `GET /admin/requests` - List all registration requests
- `GET /admin/requests/pending` - List pending requests
- `GET /admin/request/:id` - Get detailed request information
- `POST /admin/request/:id/approve` - Approve and sign voter credentials
- `POST /admin/request/:id/reject` - Reject registration request

## Swagger Documentation

Visit `http://localhost:3000/api` after starting the server to view interactive API documentation with example requests and responses.

## Workflow

1. **Voter submits registration**: POST to `/voters/register` with passport image, photo, and personal info
2. **System generates credentials**: Random `voterId`, `secretX`, `secretXp` are created
3. **Admin reviews request**: GET `/admin/requests/pending` to see pending requests
4. **Admin approves**: POST to `/admin/request/:id/approve` to sign credentials
5. **Voter retrieves signature**: GET `/voters/signature/:id` to get signature data
6. **Voter generates ZK proof**: Use signature data in frontend to create zero-knowledge proof

## Technology Stack

- NestJS
- TypeORM
- SQLite
- circomlibjs (EdDSA signatures)
- poseidon-lite (Poseidon hashing)
- Swagger/OpenAPI
