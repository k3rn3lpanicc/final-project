# Admin Dashboard

Administrative interface for managing voter registrations, elections, and approvals in the VoteScheme voting system.

## 📋 Overview

The Admin Dashboard provides election administrators with tools to:
- Review and approve voter registrations
- Create and manage elections
- Monitor voting activity
- Filter and search registrations
- View uploaded documents
- Generate EdDSA signatures for approved voters

## ✨ Features

### 👥 Voter Management
- **View All Registrations**: List all voter registration requests
- **Filter by Status**: Filter by pending, approved, or rejected
- **Filter by Election**: Show only registrations for specific elections
- **Document Verification**: View passport and photo uploads
- **Approve/Reject**: One-click approval or rejection
- **Search**: Search by name, email, or voter ID

### 🗳️ Election Management
- **Create Elections**: Set up new elections with options
- **Configure Options**: Add/edit voting options
- **Set Dates**: Define start and end dates
- **Election Keys**: Generate encryption key pairs
- **Status Control**: Activate or close elections
- **View Statistics**: See vote counts and participation

### 📊 Dashboard Analytics
- **Total Registrations**: Count of all registrations
- **Pending Reviews**: Number awaiting approval
- **Approved Voters**: Successfully verified voters
- **Rejected Requests**: Declined registrations
- **Active Elections**: Currently running elections
- **Vote Statistics**: Real-time voting metrics

### 🔐 Authentication
- **JWT Authentication**: Secure admin login
- **Session Management**: Auto-logout on timeout
- **Role-Based Access**: Admin-only operations
- **Audit Logs**: Track admin actions

## 🚀 Setup

### Prerequisites

- Node.js v16+
- npm or yarn
- Backend API running

### Installation

```bash
cd admin-dashboard
npm install
```

### Configuration

Create `.env` file:

```env
VITE_API_URL=http://localhost:3000
VITE_ADMIN_USERNAME=admin
```

### Start Development Server

```bash
npm run dev
```

Application available at `http://localhost:3001`

### Build for Production

```bash
npm run build
npm run preview
```

## 📖 Admin Guide

### Login

1. Navigate to login page
2. Enter admin credentials
3. Click "Login"
4. Redirected to dashboard

### Approve Registrations

1. Go to "Registrations" tab
2. Filter by "Pending" status
3. Click on a request to view details
4. Review documents:
   - Passport image
   - Personal photo
   - Personal information
5. Click "Approve" to sign credentials
6. Voter receives EdDSA signature
7. Voter can now participate in elections

### Reject Registrations

1. View pending registration
2. Click "Reject"
3. Optionally provide reason
4. Voter is notified of rejection

### Create Election

1. Go to "Elections" tab
2. Click "Create Election"
3. Fill in details:
   - Election ID (unique number)
   - Name (e.g., "Board Election 2025")
   - Description
   - Options (e.g., ["Alice", "Bob", "Charlie"])
   - Start date and time
   - End date and time
4. Generate encryption key pair or provide existing keys
5. Click "Create"
6. Election is created in pending state

### Manage Elections

1. View elections list
2. Click on election for details
3. Available actions:
   - **Activate**: Start accepting votes
   - **Close**: Stop accepting votes
   - **Edit**: Modify details (before activation)
   - **Delete**: Remove election (if no votes)
   - **View Results**: After closing (use Results Dashboard)

### Filter Registrations by Election

1. Select election from dropdown
2. View only registrations for that election
3. Bulk approve/reject by election
4. Export voter list for election

## 📂 Project Structure

```
admin-dashboard/
├── src/
│   ├── pages/
│   │   ├── Login.tsx         # Admin login
│   │   ├── Dashboard.tsx     # Main dashboard
│   │   ├── Registrations.tsx # Voter management
│   │   └── Elections.tsx     # Election management
│   ├── components/
│   │   ├── Header.tsx        # Navigation header
│   │   ├── Sidebar.tsx       # Side navigation
│   │   ├── RequestCard.tsx   # Registration card
│   │   ├── ElectionForm.tsx  # Election create/edit
│   │   └── StatsCard.tsx     # Dashboard stats
│   ├── services/
│   │   ├── api.ts            # Backend API client
│   │   └── auth.ts           # Authentication service
│   ├── utils/
│   │   ├── crypto.ts         # Key generation
│   │   └── validation.ts     # Form validation
│   ├── types/                # TypeScript types
│   ├── App.tsx               # Main app component
│   └── main.tsx              # Entry point
├── index.html                # HTML template
├── dashboard.html            # Dashboard page
├── elections.html            # Elections page
├── vite.config.ts            # Vite configuration
└── tsconfig.json             # TypeScript config
```

## 🔧 Technical Details

### EdDSA Signature Generation

When approving a registration:

```typescript
1. Retrieve voter credentials:
   - voterId
   - secretX
   - secretXp

2. Compute message:
   - hashXp = Poseidon(secretXp)
   - msg = Poseidon(voterId, secretX, hashXp)

3. Sign with admin private key:
   - signature = EdDSA.sign(adminPrivateKey, msg)

4. Return signature components:
   - R8: Point on Baby Jubjub curve
   - S: Scalar value
   - A: Admin public key (for verification)

5. Store signature in database

6. Voter retrieves signature to generate zkSNARK proof
```

### API Integration

The dashboard communicates with the backend API:

```typescript
// Authentication
POST /admin/login
  → Returns JWT token

// Registration Management
GET /admin/requests
GET /admin/requests?status=pending
GET /admin/requests?electionId=1
POST /admin/request/:id/approve
POST /admin/request/:id/reject

// Election Management
GET /elections
POST /elections
PUT /elections/:id
DELETE /elections/:id
GET /elections/:id/stats
```

### Real-time Updates

- Auto-refresh every 30 seconds
- Manual refresh button
- WebSocket support (optional)
- Optimistic UI updates

## 🔒 Security

### Authentication
- ✅ JWT token-based authentication
- ✅ Token stored in sessionStorage
- ✅ Auto-logout on expiration
- ✅ Protected routes

### Authorization
- ✅ Admin-only operations
- ✅ Server-side validation
- ✅ Audit logging
- ✅ Role-based access control

### Data Protection
- ✅ HTTPS in production
- ✅ CORS configuration
- ✅ Input validation
- ✅ SQL injection prevention

## 📊 Dashboard Metrics

### Statistics Displayed

- **Total Registrations**: All-time total
- **Pending Reviews**: Awaiting admin action
- **Approved This Month**: Recent approvals
- **Active Elections**: Currently running
- **Total Votes Cast**: Across all elections
- **Average Approval Time**: Efficiency metric

### Charts and Graphs

- Registration timeline
- Approval rate over time
- Votes per election
- Status distribution

## 🎨 Customization

### Theming

Modify `src/styles/theme.css`:

```css
:root {
  --primary-color: #4f46e5;
  --secondary-color: #10b981;
  --danger-color: #ef4444;
  --background: #ffffff;
  --text-primary: #1f2937;
}
```

### Layout

Edit component files to adjust:
- Sidebar width
- Header height
- Card layouts
- Grid spacing

## 🧪 Testing

```bash
# Run tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

## 🚀 Deployment

### Build

```bash
npm run build
```

### Deploy

```bash
# Deploy to Vercel
vercel --prod

# Deploy to Netlify
netlify deploy --prod

# Deploy to AWS S3
aws s3 sync dist/ s3://admin-dashboard-bucket/ --acl public-read
```

### Environment Variables

Production environment:
- `VITE_API_URL`: Backend API URL
- `VITE_ADMIN_USERNAME`: Admin username (optional)

## 🐛 Troubleshooting

### Login Issues
- Verify backend is running
- Check admin credentials
- Clear browser cache
- Check network tab for errors

### Signature Generation Fails
- Verify admin private key in backend
- Check voter credentials are valid
- Ensure Poseidon hash compatibility
- Review backend logs

### Images Not Loading
- Check UPLOAD_DIR in backend
- Verify file paths in database
- Check CORS settings
- Ensure backend serves static files

### Election Creation Fails
- Verify election ID is unique
- Check date formats
- Validate public key format
- Review validation errors

## 📄 License

ISC License

## 🆘 Support

For admin dashboard issues:
- Check browser console
- Verify API connection
- Review backend logs
- Test endpoints via Swagger
- Check authentication token
