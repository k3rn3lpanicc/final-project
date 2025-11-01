# Admin Dashboard

Admin dashboard for managing voter registration requests in the ZK Vote Scheme system.

## Features

- View all voter registration requests
- Filter requests by status (All, Pending, Approved, Rejected)
- Approve or reject pending requests
- View signature data for approved requests
- View passport and personal photos
- Real-time statistics dashboard
- Auto-refresh every 30 seconds

## Prerequisites

- Node.js installed
- Backend server running on `http://localhost:3000`

## Installation

```bash
cd admin-dashboard
npm install
```

## Running the Dashboard

```bash
npm run dev
```

The dashboard will be available at `http://localhost:3001`

## Usage

1. Start the backend server first
2. Run the admin dashboard
3. View incoming voter registration requests
4. Click "Approve" to sign and approve a request
5. Click "Reject" to reject a request
6. View signature data for approved requests

## API Integration

The dashboard connects to the backend API at `http://localhost:3000`:

- `GET /voter-requests` - Fetch all requests
- `POST /admin/approve/:id` - Approve a request
- `POST /admin/reject/:id` - Reject a request
- `GET /uploads/:filename` - View uploaded images

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.
