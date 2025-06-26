# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Backend (Node.js/Express)
```bash
cd backend
npm run dev              # Start development server with nodemon
npm start               # Start production server
npm run migrate         # Run database migrations
npm run seed            # Seed database with initial data
npm run detect-faces    # Run face detection Python script
```

### Frontend (React/TypeScript)
```bash
cd frontend
npm start               # Start development server (port 3000)
npm run build          # Build for production
npm test               # Run tests in watch mode
```

### Database Operations
```bash
cd backend
# Reset database completely
./reset-db.sh

# Run specific migration scripts
./setup-modern-migrations.sh
```

### Python Face Detection
The system uses Python with DeepFace in a virtual environment:
```bash
# Activate Python environment for face detection
source venv_deepface/bin/activate
python scripts/face_detection.py
```

## Architecture Overview

### Database Architecture
- **PostgreSQL** with Sequelize ORM
- **Role-based system**: admin, student, teacher, technician
- **Core entities**: Users, Courses, Subjects, Lessons, Classrooms, Attendance
- **Face recognition**: Photos stored as BLOBs in Users table
- **Migrations**: 8 migration files in `backend/migrations/` directory

### Backend Architecture (Node.js/Express)
- **Entry point**: `backend/src/app.js`
- **Models**: Sequelize models in `backend/src/models/`
- **Routes**: RESTful API routes in `backend/src/routes/`
- **Services**: Business logic in `backend/src/services/`
  - `faceDetectionService.js` - Face recognition integration
  - `cameraService.js` - Camera management
  - `imageStorageService.js` - Image handling with Sharp
- **Authentication**: JWT-based with role middleware
- **File uploads**: Multer for image handling
- **Database config**: Environment-based configuration in `config/database.js`

### Frontend Architecture (React/TypeScript)
- **Framework**: React 19 with TypeScript
- **Routing**: React Router v7 with role-based protected routes
- **Styling**: SCSS with Tailwind CSS integration
- **State management**: Context API in `AppContext.tsx`
- **Components structure**:
  - `admin/` - Admin panel components
  - `auth/` - Login and authentication
  - `common/` - Reusable UI components
  - `layout/` - Page layouts and sidebar
  - `technician/` - Student registration interface

### Multi-language Support
- **i18n system**: Implemented with namespace-based translations
- **Locales**: English (en), Italian (it), Romanian (ro)
- **Translation files**: `backend/src/locales/`
- **Migration completed**: See `migration-report.md` for details

### Camera and Image Processing
- **Real-time processing**: Face detection on lesson images
- **Camera discovery**: Automatic IP camera detection
- **Storage**: Images stored in `temp/` directory with organized structure
- **Python integration**: Face detection uses DeepFace library

## Key Development Patterns

### Authentication Flow
1. Login via `/api/auth/login`
2. JWT token stored in frontend context
3. Protected routes check user role
4. Role-based redirects in `ProtectedRoute` component

### Database Relationships
- Users belong to Courses
- Students enrolled in Subjects
- Lessons belong to Subjects and Classrooms
- Attendance tracked per Student per Lesson
- Screenshots/images linked to Lessons

### Image Processing Workflow
1. Images uploaded via `/api/images/upload`
2. Face detection triggered automatically
3. Results stored in database with attendance records
4. Files organized in `temp/face_processing/` structure

### API Patterns
- RESTful endpoints with consistent naming
- Error handling middleware
- Request logging for debugging
- CORS enabled for frontend communication
- File upload handling with Multer

## Environment Configuration

### Required Environment Variables
```bash
# Database
DB_USER=stebbi
DB_PASSWORD=stebbi  
DB_NAME=attendance_system
DB_HOST=localhost
DB_PORT=5432

# JWT
JWT_SECRET=your-secret-key

# Node Environment
NODE_ENV=development
```

### Port Configuration
- Backend: 4321 (default)
- Frontend: 3000 (Create React App default)
- Database: 5432 (PostgreSQL default)

## Testing and Debugging

### Available Test Scripts
- Backend includes diagnostic scripts: `debug_password_issue.js`, `test_api_endpoints.js`
- Frontend uses React Testing Library with Jest
- Manual testing endpoints available in `test_*.js` files

### Debugging Tools
- Backend logging middleware for request tracking
- Database query logging enabled in development
- Face detection debug images stored in `data/debug_faces/`

## Face Recognition System

### Technical Stack
- **Python**: DeepFace library for face recognition
- **Virtual Environment**: `venv_deepface/` with specific requirements
- **Integration**: Node.js calls Python scripts via child process
- **Storage**: Face embeddings and photos in PostgreSQL BLOBs

### Processing Flow
1. Images captured during lessons
2. Python script processes faces
3. Results matched against student database
4. Attendance automatically recorded
5. Debug information stored for verification