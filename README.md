# Fastmail Archiver

A Node.js application that uses JMAP (JSON Meta Application Protocol) to interact with Fastmail's email services. The application monitors email movements in real-time using JMAP push notifications.

## Features

- **Real-time Email Tracking**: Monitor email movements using JMAP Server-Sent Events (SSE)
- **Inbox-focused Monitoring**: Tracks only Inbox and child folders to reduce noise
- **Mailbox Discovery**: Automatically maps all mailboxes with names and IDs
- **Detailed Logging**: Reports email movements with format: `📧 Email moved: "Subject" from Source → Destination`
- **Authenticated Sessions**: Secure JMAP session management with Fastmail
- **Docker Support**: Run in a containerized environment

## How It Works

The application uses the JMAP protocol (RFC 8620 and RFC 8621) to:

1. **Establish Session**: Authenticates with Fastmail's JMAP API and retrieves service capabilities
2. **Discover Mailboxes**: Fetches all mailboxes and builds a hierarchy map
3. **Initialize State**: Bulk loads current email states for Inbox-related folders
4. **Subscribe to Push Events**: Opens an EventSource connection to receive real-time notifications
5. **Track Changes**: When emails are moved, detects source and destination mailboxes

### JMAP Methods Used

- `GET /jmap/session` - Session establishment and capability discovery
- `Mailbox/get` - Retrieves mailbox list with names, roles, and hierarchy
- `Email/query` + `Email/get` - Bulk fetches emails for state initialization
- `Email/changes` - Detects which emails have been modified
- `Email/get` (targeted) - Fetches specific emails to identify mailbox changes
- Push subscription via EventSource at `/jmap/event/` endpoint

## Prerequisites

- Node.js 18+ (for native fetch API support)
- npm or yarn
- Fastmail account with API token

## Installation

```bash
npm install
```

## Configuration

The application requires a Fastmail API token with mail access permissions.

1. Generate a token at: https://www.fastmail.com/settings/security/tokens
2. Set the token as an environment variable:

```bash
export FASTMAIL_TOKEN="your_token_here"
```

## Usage

### Development Mode

Runs with auto-compilation and source maps:

```bash
npm run dev
```

### Docker

Build and run in a container:

```bash
# Build the image
npm run docker:build

# Run the container
npm run docker:run

# Build and run in one command
npm run docker:dev
```

Or manually:

```bash
docker build -t fastmail-archiver .
docker run --rm -e FASTMAIL_TOKEN="your_token_here" fastmail-archiver
```

## Development

### Available Scripts

- `npm run dev` - Build and run with source maps (development)
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run the compiled application
- `npm run lint` - Check code style and potential errors
- `npm run lint:fix` - Automatically fix linting issues
- `npm run test` - Run test suite

### Testing the Application

1. Start the application with `npm run dev`
2. Open Fastmail web interface
3. Move emails between folders
4. Observe console output for movement detection
5. Verify that only Inbox-related movements are reported

## Architecture

### State Management

The application maintains a global state map tracking which mailboxes each email belongs to:

```typescript
const emailStates = new Map<string, string[]>();
// Maps: email ID -> array of mailbox IDs
```

### Mailbox Filtering

Only emails in the Inbox and its child folders are tracked to reduce noise from other folders like Sent, Drafts, etc. The filtering uses mailbox hierarchy (parentId relationships) to identify relevant folders.

### Change Detection

When a push notification arrives:
1. Fetch the list of changed email IDs using `Email/changes`
2. Get current mailbox assignments for those emails
3. Compare with previous state to identify:
   - **Source mailboxes**: Where the email was removed from
   - **Destination mailboxes**: Where the email was added to
4. Log the movement with email subject and mailbox names

## Troubleshooting

### Common Issues

**Authentication failures**
- Verify `FASTMAIL_TOKEN` is set correctly
- Check that token has mail permissions
- Ensure token hasn't expired

**Push connection drops**
- Check network stability
- Monitor logs for connection errors
- Application will need to be restarted (automatic reconnection not yet implemented)

**Missing email changes**
- Verify the email is in Inbox or a child folder
- Check that state strings are being tracked properly
- Review console logs for JMAP errors

## Potential Future Enhancements

- [ ] Automatic reconnection logic for dropped push connections
- [ ] Archive emails based on age/rules
- [ ] Email search and filtering capabilities
- [ ] Database persistence for email metadata
- [ ] Configuration file support

## Technical Details

### Dependencies

- **jmap-jam** - JMAP client library
- **eventsource-client** - Server-Sent Events client for Node.js

### JMAP Specifications

- [RFC 8620](https://datatracker.ietf.org/doc/html/rfc8620) - Core JMAP protocol
- [RFC 8621](https://datatracker.ietf.org/doc/html/rfc8621) - JMAP for Mail

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.
