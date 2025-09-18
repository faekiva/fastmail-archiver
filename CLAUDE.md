# Fastmail Archiver - JMAP Application

This is a Node.js application that uses the JMAP (JSON Meta Application Protocol) to interact with Fastmail's email services. The application currently implements real-time email movement tracking using JMAP push notifications.

## Project Overview

### Current Functionality
- **JMAP Session Management**: Establishes authenticated sessions with Fastmail's JMAP API
- **Mailbox Discovery**: Fetches and maps all mailboxes with their names and IDs
- **Real-time Push Events**: Subscribes to JMAP push notifications using Server-Sent Events (SSE)
- **Email Movement Tracking**: Detects and reports when emails are moved between mailboxes
- **Inbox-focused Monitoring**: Only tracks emails in the Inbox folder and its child folders to reduce noise

### Key Features
- Uses `jmap-jam` library for JMAP client functionality
- Implements streaming fetch API for push notifications (Node.js compatible)
- Maintains email state tracking to identify source/destination mailboxes
- Provides detailed logging for email movements with format: `📧 Email moved: "Subject" from Source → Destination`

## Technical Implementation

### Authentication
- Requires `FASTMAIL_TOKEN` environment variable (Bearer token)
- Token must have appropriate JMAP permissions for mail access

### JMAP Specifications Used
- **RFC 8620**: Core JMAP protocol for push notifications and session management
- **RFC 8621**: JMAP for Mail specification for email-specific operations
- **EventSource/SSE**: Server-Sent Events for real-time push notifications

### Key JMAP Methods Used
1. **Session establishment**: `GET /jmap/session` - Gets API endpoints and capabilities
2. **Mailbox/get**: Retrieves mailbox list with names, roles, and hierarchy
3. **Email/query + Email/get**: Bulk fetches emails for state initialization
4. **Email/changes**: Detects which emails have been modified
5. **Email/get** (targeted): Fetches specific emails to see mailbox changes
6. **Push subscription**: EventSource connection to `/jmap/event/` endpoint

### Architecture Patterns

#### State Management
```typescript
// Global email state tracking
const emailStates = new Map<string, string[]>();
// Maps email ID -> array of mailbox IDs
```

#### Mailbox Filtering
- Only tracks emails in Inbox and its child folders
- Uses mailbox hierarchy (parentId relationships) to identify relevant folders
- Filters both initial state and ongoing changes

#### Change Detection
- Compares previous vs current mailbox arrays for each email
- Identifies source mailboxes (removed from) and destination mailboxes (added to)
- Handles three scenarios: moves, additions, removals

## Development Commands

```bash
# Development with auto-compilation
npm run dev

# Production build and run
npm run start

# Linting
npm run lint
npm run lint:fix

# Testing
npm run test
```

## Working with JMAP

### Understanding JMAP Push Events
JMAP push events contain state change notifications:
```json
{
  "changed": {
    "accountId": {
      "Email": "newStateString"
    }
  }
}
```

When this occurs, use `Email/changes` with the previous state to get specific changed email IDs, then `Email/get` to fetch current mailbox assignments.

### Common JMAP Patterns

1. **Batch Operations**: Always batch related JMAP calls in single requests using `methodCalls` array
2. **State Tracking**: JMAP uses state strings to enable efficient incremental sync
3. **Reference Chaining**: Use `#ids` syntax to chain query results to get operations
4. **Property Selection**: Always specify `properties` array to minimize bandwidth

### Debugging Tips
- Check session capabilities for supported extensions
- Verify push event URL parameters: `{types}`, `{closeafter}`, `{ping}`
- Monitor both console logs and network traffic for JMAP requests
- Test push events by manually moving emails in Fastmail web interface

## Code Structure

### Main Components
- `main()`: Entry point, handles session, initialization, and push subscription
- `initializeEmailStates()`: Bulk loads current email states for tracked mailboxes
- `handleEmailChanges()`: Processes push notifications and detects movements
- `arraysEqual()`: Utility for comparing mailbox ID arrays

### Error Handling
- Graceful degradation when push events fail
- Comprehensive logging for debugging JMAP interactions
- Proper cleanup on process termination (SIGINT)

## Future Enhancement Ideas
- Archive emails based on age/rules
- Export email data to various formats
- Implement email search and filtering
- Add support for other JMAP object types (Calendar, Contacts)
- Database persistence for email metadata
- Web dashboard for monitoring

## Troubleshooting

### Common Issues
1. **Authentication failures**: Verify FASTMAIL_TOKEN is valid and has mail permissions
2. **Push connection drops**: Check network stability and implement reconnection logic
3. **Missing email changes**: Verify accountId matches and state strings are properly tracked

### Testing the Application
1. Start with `npm run dev`
2. Move emails in Fastmail web interface
3. Observe console output for movement detection
4. Check that only Inbox-related movements are reported