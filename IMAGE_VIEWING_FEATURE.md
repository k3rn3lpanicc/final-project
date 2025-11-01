# Image Viewing Feature for Admin Dashboard

## Summary
Added the ability for admins to view passport and photo images of voters before approving their registration requests.

## Changes Made

### Backend (NestJS)

#### 1. Admin Controller (`backend/src/admin/admin.controller.ts`)
- **Added new endpoint**: `GET /admin/request/:id/image/:type`
  - Parameters:
    - `id`: The voter request ID
    - `type`: Either 'passport' or 'photo'
  - Returns: StreamableFile with the image
  - Sets proper Content-Type headers for browser display
  - Throws 404 if image file not found

- **Import changes**:
  - Added `Res`, `StreamableFile` from `@nestjs/common`
  - Added `Response` from `express`
  - Added `createReadStream`, `existsSync` from `fs`
  - Added `join` from `path`

### Frontend (Admin Dashboard)

#### 1. API Service (`admin-dashboard/src/api.ts`)
- **Updated `getImageUrl()` method**:
  - Changed signature from `getImageUrl(path: string)` to `getImageUrl(requestId: string, type: 'passport' | 'photo')`
  - Now constructs proper API endpoint: `/admin/request/{id}/image/{type}`

#### 2. Main Application (`admin-dashboard/src/main.ts`)
- **Updated document display section**:
  - Now passes `request.id` and type ('passport' or 'photo') to `api.getImageUrl()`
  - Images are displayed in a grid with thumbnails
  - Clicking an image opens it in a new tab at full size

#### 3. Styles (`admin-dashboard/src/style.css`)
- Already had proper styling for document images:
  - `.document-section`: Full-width section in the request card
  - `.document-images`: Grid layout for image thumbnails
  - `.document-image`: Individual image container with hover effects
  - Images are 150px tall thumbnails with object-fit cover

## How It Works

1. **Admin views requests**: The dashboard loads all voter registration requests
2. **Images are displayed**: If a request has passport or photo images, they appear as thumbnails in the request card
3. **Click to view full size**: Admin can click on any image thumbnail to open it in a new browser tab
4. **Backend serves images**: The `/admin/request/:id/image/:type` endpoint:
   - Fetches the request from database to get the image file path
   - Validates the file exists on disk
   - Streams the file to the browser with proper content-type headers
5. **Admin can approve/reject**: After viewing the documents, admin can approve or reject the request

## API Endpoint Details

### GET /admin/request/:id/image/:type

**Request:**
```
GET http://localhost:3000/admin/request/550e8400-e29b-41d4-a716-446655440000/image/passport
```

**Response:**
- Content-Type: image/jpeg
- Content-Disposition: inline; filename="passport-{id}.jpg"
- Body: Image binary data (StreamableFile)

**Error Cases:**
- 404: Request not found
- 404: Image file not found on disk

## Security Considerations

1. **File Path Validation**: Images are retrieved only through the database entity, preventing directory traversal attacks
2. **Existence Check**: Verifies file exists before attempting to stream
3. **No Direct Path Access**: File paths are not exposed to the client; only request IDs are used
4. **Stream-based Delivery**: Uses Node.js streams for efficient memory usage

## Testing

To test the feature:

1. Start the backend: `cd backend && npm run start:dev`
2. Start the admin dashboard: `cd admin-dashboard && npm run dev`
3. Submit a voter registration with images (use the voter frontend or API)
4. Open admin dashboard at `http://localhost:5174`
5. View the request - images should appear as thumbnails
6. Click on an image to view full size in a new tab

## Files Modified

### Backend:
- `backend/src/admin/admin.controller.ts` - Added image serving endpoint

### Frontend:
- `admin-dashboard/src/api.ts` - Updated getImageUrl method
- `admin-dashboard/src/main.ts` - Updated image display calls

### No Changes Required:
- `admin-dashboard/src/style.css` - Already had proper styling
- Backend entity and database schema - Already stored image paths
