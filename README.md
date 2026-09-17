# Nebryx

Nebryx is a modern, enterprise-grade authentication and authorization platform built with Node.js. It provides secure user management, session handling, and comprehensive access control features.

## Features

- **User Authentication & Authorization**: Secure login, registration, and session management
- **RBAC (Role-Based Access Control)**: Fine-grained permissions and role management
- **Session Management**: Redis-backed session storage with configurable expiration
- **API Key Authentication**: Programmatic access with secure API keys
- **Two-Factor Authentication (2FA)**: OTP support via TOTP
- **Activity Logging**: Comprehensive audit trail for all user actions
- **User Profiles**: Flexible profile management system
- **Phone Verification**: SMS-based phone number verification
- **Document Management**: Secure document upload and storage
- **Encrypted Data Storage**: Sensitive data encryption at rest
- **CSRF Protection**: Built-in CSRF token validation
- **Email Service**: Asynchronous email delivery with background workers
- **Multi-language Support**: Internationalization ready

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL/MariaDB with Sequelize ORM
- **Cache/Sessions**: Redis
- **Job Queue**: BullMQ (Redis-based)
- **Email**: SMTP / SendGrid support
- **SMS**: Twilio / AWS SNS support

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- MySQL/MariaDB
- Redis

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Generate JWT keys:
```bash
openssl genrsa -out config/keys/private.pem 2048
openssl rsa -in config/keys/private.pem -pubout -out config/keys/public.pem
```

4. Run migrations to create database tables:
```bash
npm run migrate
```

5. Seed initial permissions data:
```bash
npm run seed
```

6. Start the server:
```bash
npm run dev
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

## Database Setup

The application uses MySQL/MariaDB. Make sure your database is running and accessible.

**Important**: Before running migrations, ensure:
- MySQL server is running
- Database credentials in `.env` are correct
- Database specified in `DB_NAME` exists (or create it manually)

To create the database manually:
```sql
CREATE DATABASE nebryx_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Then run migrations:
```bash
npm run migrate
```

## Configuration

Key environment variables to configure:

- `APP_DOMAIN` - Your application domain (e.g., app.local.ai)
- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - Database configuration
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` - Redis configuration
- `EMAIL_PROVIDER` - Email service provider (smtp, sendgrid, mock)
- `SMTP_*` or `SENDGRID_*` - Email provider credentials
- `PHONE_VERIFICATION` - SMS provider (twilio_sms, twilio_verify, aws_sns, mock)
- `TWILIO_*` or `AWS_*` - SMS provider credentials

See `.env.example` for all available configuration options.

## API Documentation

Nebryx provides comprehensive Swagger/OpenAPI documentation for all API endpoints.

**Access the Swagger UI:**
- **Swagger UI**: `http://localhost:3000/api/v2/swagger`
- **JSON Specification**: `http://localhost:3000/api/v2/swagger.json`

The documentation includes:
- **Identity endpoints**: Authentication, registration, password reset, email confirmation
- **Resource endpoints**: User profiles, API keys, documents, phones (requires authentication)
- **Admin endpoints**: User management, permissions, activities (requires admin authentication)
- **Public endpoints**: Health checks, configuration

## API Endpoints

### Identity Endpoints (`/api/v2/nebryx/identity`)
- `POST /sessions` - Create session (login)
- `DELETE /sessions` - Destroy session (logout)
- `POST /users` - Create user (registration)
- `POST /email/generate_code` - Request email confirmation
- `POST /email/confirm_code` - Confirm email address
- `POST /password/generate_code` - Request password reset
- `POST /password/confirm_code` - Reset password
- `GET /password/validate` - Validate password strength
- `GET /ping` - Health check
- `GET /time` - Server timestamp
- `GET /configs` - Get configurations

### Resource Endpoints (`/api/v2/nebryx/resource`)
- `GET /users/me` - Get current user
- `PUT /users/me` - Update current user
- `PUT /users/password` - Change password
- `GET /users/activity/:topic` - Get user activity
- `GET /profiles/me` - Get user profiles
- `POST /profiles` - Create profile
- `GET /phones/me` - Get user phones
- `POST /phones` - Add phone
- `GET /documents/me` - Get user documents
- `POST /documents` - Upload document
- `GET /api_keys` - List API keys
- `POST /api_keys` - Create API key
- `DELETE /api_keys/:id` - Delete API key

## Architecture

### Project Structure

```
nebryx/
├── src/
│   ├── config/          # Configuration files
│   ├── middleware/       # Express middleware
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic services
│   │   ├── email/       # Email service
│   │   └── sms/         # SMS service
│   ├── utils/           # Utility functions
│   └── server.js        # Application entry point
├── templates/           # Email templates
├── config/              # Configuration files (mailer, etc.)
├── db/                  # Database migrations and seeders
└── logs/                # Application logs
```

### Key Components

- **Models**: Database models using Sequelize ORM
- **Services**: Business logic layer (Auth, Encryption, JWT, Session, Email, SMS)
- **Middleware**: Authentication, authorization, validation, error handling
- **Routes**: RESTful API endpoints organized by feature
- **Utils**: Helper functions (logger, UID generator, etc.)

## Email Service

Nebryx includes a robust email service with:
- Background job processing (BullMQ)
- Multiple provider support (SMTP, SendGrid)
- Template-based emails (Handlebars)
- Multi-language support
- Automatic retry on failure

See `src/services/email/README.md` for detailed documentation.

## Security Features

- Password strength validation
- Bcrypt password hashing
- JWT token-based authentication
- CSRF protection
- Rate limiting
- Encrypted sensitive data storage
- Secure session management

## Development

```bash
# Development mode with auto-reload
npm run dev

# Run migrations
npm run migrate

# Rollback last migration
npm run migrate:undo

# Run seeders
npm run seed

# Run tests
npm test
```

## License

MIT
