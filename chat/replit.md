# ChatHub - Real-time Chat Application

## Overview

ChatHub is a modern real-time chat application built with React, Express, and PostgreSQL. It provides instant messaging capabilities with group chat support, user authentication via Replit's OAuth system, and image sharing functionality. The application features a responsive design with a Discord-inspired interface, real-time message updates, and comprehensive user management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management and caching
- **UI Components**: Radix UI primitives with shadcn/ui component library for consistent design
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ESM modules for modern JavaScript features
- **API Design**: RESTful API endpoints for chat operations, user management, and file uploads
- **File Uploads**: Multer middleware for handling image uploads with type and size validation
- **Session Management**: Express sessions with PostgreSQL storage for persistent user sessions
- **Middleware**: Custom logging, error handling, and authentication middleware

### Database Layer
- **Primary Database**: PostgreSQL with Neon serverless for scalable cloud hosting
- **ORM**: Drizzle ORM for type-safe database operations and schema management
- **Schema Design**: Normalized relational structure with users, chat rooms, messages, and room membership tables
- **Migration System**: Drizzle Kit for database schema migrations and version control

### Authentication System
- **Provider**: Replit OpenID Connect (OIDC) for seamless integration with Replit platform
- **Strategy**: Passport.js with OpenID Connect strategy for OAuth flow
- **Session Storage**: PostgreSQL-backed sessions with configurable TTL
- **Security**: HTTP-only cookies, CSRF protection, and secure session configuration

### Real-time Features
- **WebSocket Implementation**: Full WebSocket server with real-time bidirectional communication
- **Message Broadcasting**: Instant message delivery to all room participants without polling
- **Typing Indicators**: Real-time typing notifications with automatic timeout handling
- **User Status Updates**: Live online/offline status tracking with WebSocket updates
- **Connection Management**: Automatic reconnection, connection state tracking, and error recovery
- **Path Separation**: WebSocket server on `/ws` path to avoid conflicts with Vite dev server

### File Management
- **Upload Handling**: Local file system storage with unique UUID naming
- **Image Processing**: Client-side validation with server-side verification
- **File Serving**: Express static middleware with caching headers
- **Constraints**: 5MB file size limit, image-only uploads (JPEG, PNG, GIF, WebP)

### Development Tools
- **Type Safety**: Shared TypeScript schemas between client and server
- **Code Quality**: ESLint configuration and TypeScript strict mode
- **Build Process**: Separate client and server builds with optimized bundling
- **Development Server**: Vite dev server with HMR and Express API proxy

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Connection Management**: @neondatabase/serverless for WebSocket-based connections

### Authentication Services
- **Replit OIDC**: OpenID Connect provider for user authentication
- **Session Storage**: connect-pg-simple for PostgreSQL session persistence

### UI Component Libraries
- **Radix UI**: Accessible, unstyled component primitives for complex UI elements
- **Lucide React**: Comprehensive icon library for consistent iconography
- **Class Variance Authority**: Type-safe variant management for component styling

### Development and Build Tools
- **Vite**: Modern build tool with fast HMR and optimized production builds
- **esbuild**: Fast JavaScript bundler for server-side code compilation
- **PostCSS**: CSS processing with Tailwind CSS and Autoprefixer plugins

### File Upload and Processing
- **Multer**: Express middleware for handling multipart/form-data file uploads
- **File Validation**: Built-in MIME type and file size validation

### State Management and API
- **TanStack React Query**: Server state management with caching and synchronization
- **Date-fns**: Modern date utility library for timestamp formatting and manipulation

### Styling and Design
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **CSS Custom Properties**: Dynamic theming support with CSS variables
- **Responsive Design**: Mobile-first approach with breakpoint-based layouts