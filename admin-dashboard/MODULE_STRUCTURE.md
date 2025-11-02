# Admin Dashboard - Modular Structure

## Overview
The admin dashboard has been refactored into a clean, modular architecture for better maintainability and scalability.

## Project Structure

```
admin-dashboard/
├── src/
│   ├── components/          # UI Components
│   │   ├── requestsTable.ts # Request management table logic
│   │   ├── modals.ts        # Modal components (details, signature)
│   │   └── elections.ts     # Elections management UI
│   ├── services/            # Business Logic & API
│   │   ├── api.ts          # API client with axios interceptors
│   │   └── auth.ts         # Authentication service
│   ├── utils/              # Utility Functions
│   │   ├── notifications.ts # Toast notification system
│   │   ├── modal.ts        # Modal utilities (close handlers)
│   │   └── pagination.ts   # Pagination helpers
│   ├── styles/             # Modular CSS
│   │   ├── base.css        # Base styles & variables
│   │   ├── header.css      # Header styles
│   │   ├── stats.css       # Statistics cards
│   │   ├── requests.css    # Requests table
│   │   ├── actions.css     # Action menus
│   │   ├── modal.css       # Modal styles
│   │   ├── pagination.css  # Pagination controls
│   │   ├── elections.css   # Elections management
│   │   ├── login.css       # Login page
│   │   └── common.css      # Common elements (buttons, alerts)
│   ├── types/              # TypeScript Types
│   │   └── index.ts        # Shared type definitions
│   ├── main.ts             # Dashboard entry point
│   ├── elections.ts        # Elections page entry point
│   └── login.ts            # Login page entry point
├── index.html              # Redirects to login
├── dashboard.html          # Main dashboard page
├── elections.html          # Elections management page
├── login.html              # Login page
└── package.json
```

## Module Descriptions

### Components (`src/components/`)
Reusable UI components with their associated logic:

- **requestsTable.ts**: Handles the requests table, filtering, pagination, and actions
- **modals.ts**: Modal dialogs for viewing request details and signatures
- **elections.ts**: Election creation and management UI

### Services (`src/services/`)
Business logic and external API communication:

- **api.ts**: Centralized API client with:
  - Axios interceptors for authentication
  - Automatic token refresh
  - Type-safe API methods
- **auth.ts**: Authentication service handling:
  - Login/logout
  - Token management (access & refresh)
  - Session persistence

### Utils (`src/utils/`)
Reusable utility functions:

- **notifications.ts**: Toast notification system with positioning
- **modal.ts**: Modal utilities (keyboard handlers, click-outside-to-close)
- **pagination.ts**: Page number generation for pagination UI

### Styles (`src/styles/`)
Modular CSS files organized by feature:

- **base.css**: CSS variables, reset, and base styles
- **header.css**: Application header
- **stats.css**: Statistics dashboard cards
- **requests.css**: Requests table and filtering
- **actions.css**: Action menu buttons and dropdowns
- **modal.css**: Modal dialogs and overlays
- **pagination.css**: Pagination controls
- **elections.css**: Election management UI
- **login.css**: Login page styles
- **common.css**: Shared components (buttons, loading, errors)

### Types (`src/types/`)
Shared TypeScript type definitions:

- **Request**: Voter request data structure
- **Election**: Election data structure
- **PaginatedResponse**: Generic pagination wrapper
- **Stats**: Dashboard statistics
- **CreateElectionData**: Election creation payload

## Key Features

### 1. Authentication Flow
- Token-based authentication with JWT
- Automatic token refresh using refresh tokens
- Protected routes redirect to login if unauthenticated

### 2. Request Management
- Paginated request listing with filtering
- Status-based filtering (all, pending, approved, rejected, auto-rejected)
- Inline actions (view details, approve, reject, view signature)
- Image viewing with authentication
- Request ID copying to clipboard

### 3. Elections Management
- Create elections with multiple options
- Activate/deactivate elections
- Delete elections
- Dynamic option management (add/remove)

### 4. UI/UX Enhancements
- Toast notifications with smart positioning
- Modal dialogs with multiple close methods (X, ESC, click-outside)
- Responsive action menus with overflow handling
- Auto-refresh every 30 seconds (preserves scroll position)
- Loading states and error handling

## Development

### Build
```bash
npm run build
```

### Dev Server
```bash
npm run dev
```

## Benefits of Modular Architecture

1. **Maintainability**: Each module has a single responsibility
2. **Reusability**: Components and utilities can be easily reused
3. **Testability**: Isolated modules are easier to test
4. **Scalability**: New features can be added without touching existing code
5. **Collaboration**: Multiple developers can work on different modules
6. **Bundle Size**: Tree-shaking can remove unused code
7. **Code Navigation**: Clear file structure makes finding code easier

## Migration Notes

The original monolithic files have been split:
- `main.ts` (650 lines) → Multiple smaller modules (50-200 lines each)
- `style.css` (1040 lines) → 10 focused CSS files (50-500 lines each)
- `api.ts` → Split into `services/api.ts` and `types/index.ts`
- `auth.ts` → Moved to `services/auth.ts`
- `elections.ts` → Split between entry point and `components/elections.ts`

All functionality remains unchanged - only the organization has improved.
