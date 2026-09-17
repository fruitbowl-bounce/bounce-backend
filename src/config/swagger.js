const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Nebryx API',
      version: '1.0.0',
      description: 'RESTful API for Nebryx authentication and authorization platform',
      contact: {
        name: 'Nebryx API Support',
      },
    },
    servers: [
      {
        url: process.env.APP_DOMAIN ? `https://${process.env.APP_DOMAIN}` : 'http://localhost:3000',
        description: 'Production server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from login endpoint',
        },
        SessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'nebryx.session',
          description: 'Session cookie authentication',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            errors: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of error messages',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            uid: {
              type: 'string',
              description: 'Unique user identifier',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            role: {
              type: 'string',
              description: 'User role',
            },
            level: {
              type: 'integer',
              description: 'User level',
            },
            state: {
              type: 'string',
              enum: ['active', 'pending', 'banned', 'deleted'],
              description: 'User state',
            },
            otp: {
              type: 'boolean',
              description: 'Whether 2FA is enabled',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Session: {
          type: 'object',
          properties: {
            uid: {
              type: 'string',
            },
            email: {
              type: 'string',
              format: 'email',
            },
            role: {
              type: 'string',
            },
            level: {
              type: 'integer',
            },
            state: {
              type: 'string',
            },
            csrf_token: {
              type: 'string',
              description: 'CSRF token for subsequent requests',
            },
          },
        },
        Profile: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
            },
            first_name: {
              type: 'string',
            },
            last_name: {
              type: 'string',
            },
            dob: {
              type: 'string',
              format: 'date',
            },
            address: {
              type: 'string',
            },
            postcode: {
              type: 'string',
            },
            city: {
              type: 'string',
            },
            country: {
              type: 'string',
            },
            metadata: {
              type: 'object',
            },
          },
        },
        Phone: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
            },
            number: {
              type: 'string',
            },
            country: {
              type: 'string',
            },
            validated_at: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
          },
        },
        Document: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
            },
            doc_type: {
              type: 'string',
            },
            doc_number: {
              type: 'string',
            },
            upload: {
              type: 'string',
              description: 'URL to uploaded document',
            },
            metadata: {
              type: 'object',
            },
          },
        },
        APIKey: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
            },
            kid: {
              type: 'string',
              description: 'Key identifier',
            },
            algorithm: {
              type: 'string',
            },
            scope: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            state: {
              type: 'string',
              enum: ['active', 'inactive'],
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Activity: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
            },
            user_id: {
              type: 'integer',
            },
            action: {
              type: 'string',
            },
            result: {
              type: 'string',
              enum: ['succeed', 'failed'],
            },
            topic: {
              type: 'string',
            },
            user_ip: {
              type: 'string',
            },
            user_agent: {
              type: 'string',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Identity',
        description: 'Authentication and identity management endpoints',
      },
      {
        name: 'Resource',
        description: 'User resource management endpoints (requires authentication)',
      },
      {
        name: 'Admin',
        description: 'Administrative endpoints (requires admin authentication)',
      },
      {
        name: 'Public',
        description: 'Public endpoints',
      },
    ],
  },
  apis: [
    './src/routes/v2/identity/**/*.js',
    './src/routes/v2/resource/**/*.js',
    './src/routes/v2/public/**/*.js',
    './src/routes/v2/admin/**/*.js',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

