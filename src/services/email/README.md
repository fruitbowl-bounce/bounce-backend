# Email Service

This email service provides asynchronous email sending with background workers, supporting multiple email providers (SMTP, SendGrid) and template-based emails.

## Features

- **Background Processing**: Uses BullMQ with Redis for asynchronous email sending
- **Multiple Providers**: Supports SMTP, SendGrid, and Mock (for development)
- **Template System**: Handlebars-based templates with multi-language support
- **Event-Based**: Configure email events in `config/mailer.yml`
- **Retry Logic**: Automatic retry with exponential backoff
- **Non-Blocking**: API responses don't wait for email delivery

## Configuration

### Environment Variables

#### Email Provider Selection
```bash
EMAIL_PROVIDER=smtp  # Options: smtp, sendgrid, mock
```

#### SMTP Configuration
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-password
SMTP_FROM=noreply@example.com
SMTP_FROM_NAME=Nebryx
SMTP_REJECT_UNAUTHORIZED=true
SMTP_LOGO_LINK=https://example.com/logo.png
```

#### SendGrid Configuration
```bash
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM=noreply@example.com
SENDGRID_FROM_NAME=Barong
```

#### Worker Configuration
```bash
EMAIL_WORKER_CONCURRENCY=5  # Number of concurrent email jobs
EMAIL_WORKER_MAX_JOBS=10    # Max jobs per second
```

## Usage

### Basic Usage

```javascript
const emailService = require('./services/email');

// Send an email
await emailService.sendEmail({
  eventKey: 'user.email.confirmation.token',
  to: 'user@example.com',
  language: 'en',
  data: {
    user: {
      email: 'user@example.com',
    },
    record: {
      domain: 'https://example.com',
      token: 'confirmation-token-here',
    },
  },
});
```

### Example: Email Confirmation

```javascript
const emailService = require('./services/email');

router.post('/email/confirm', async (req, res) => {
  const { email, token } = req.body;
  
  // Enqueue email (non-blocking)
  await emailService.sendEmail({
    eventKey: 'user.email.confirmation.token',
    to: email,
    language: 'en',
    data: {
      user: { email },
      record: {
        domain: process.env.FRONTEND_URL,
        token,
      },
    },
  });
  
  // API responds immediately
  res.json({ message: 'Confirmation email sent' });
});
```

### Example: Password Reset

```javascript
await emailService.sendEmail({
  eventKey: 'user.password.reset.token',
  to: user.email,
  language: user.language || 'en',
  data: {
    user: {
      email: user.email,
    },
    record: {
      domain: process.env.FRONTEND_URL,
      token: resetToken,
    },
  },
});
```

### Example: Session Notification

```javascript
await emailService.sendEmail({
  eventKey: 'session.create',
  to: user.email,
  language: user.language || 'en',
  data: {
    user: {
      email: user.email,
    },
    record: {
      user_ip: req.ip,
      user_agent: req.headers['user-agent'],
    },
  },
});
```

## Email Events Configuration

Email events are configured in `config/mailer.yml`:

```yaml
events:
  - name: Email Confirmation
    key: user.email.confirmation.token
    templates:
      en:
        subject: Registration Confirmation
        template_path: email_confirmation.en.html
      ru:
        subject: Подтверждение Регистрации
        template_path: email_confirmation.ru.html
```

## Templates

Templates are stored in `templates/email/` and use Handlebars syntax:

```html
<p>Hello {{user.email}}!</p>
{{#if record.token}}
  <a href="{{record.domain}}/confirm?token={{record.token}}">Confirm</a>
{{/if}}
```

## Architecture

1. **Email Service** (`emailService.js`): Provider abstraction (SMTP/SendGrid/Mock)
2. **Email Queue** (`emailQueue.js`): BullMQ queue and worker setup
3. **Template Service** (`templateService.js`): Handlebars template rendering
4. **Worker**: Processes email jobs asynchronously from Redis queue

## Error Handling

- Failed emails are automatically retried (3 attempts with exponential backoff)
- Failed jobs are kept for 24 hours for debugging
- Successful jobs are cleaned up after 1 hour
- All errors are logged via Winston logger

## Development

Use `EMAIL_PROVIDER=mock` for development to avoid sending real emails. Mock emails are logged and stored in memory.

