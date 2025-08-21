# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Discord Media Bot that automates audiobook and ebook downloading from MyAnonaMouse (MAM) private tracker, using Deluge torrent client and Google Drive for storage. The bot provides Discord slash commands for searching, downloading, and managing media content with intelligent processing features like MP3→M4B conversion and duplicate detection.

## Development Commands

```bash
# Development (starts API server + Discord bot)
npm run dev

# Build TypeScript to JavaScript
npm run build

# Production
npm start

# Testing
npm test

# Code quality
npm run lint
npm run format
```

## Architecture Overview

The codebase is organized into three main layers:

### 1. API Layer (`src/api/`)
- **Entry point**: `src/api/index.ts` - Express server that imports and starts Discord bot
- **Client abstractions**: Separate client classes for external services:
  - `mamClient.ts` - MyAnonaMouse API integration with search and download
  - `delugeClient.ts` - Deluge torrent client management
  - `uploadManagement.ts` - Google Drive uploads with content analysis
  - `delugeClientManager.ts` - Singleton pattern for Deluge connection management
- **Routes**: RESTful endpoints for MAM search, downloads, and uploads

### 2. Discord Bot Layer (`src/bot/`)
- **Entry point**: `src/bot/index.ts` - Discord client setup and command registration
- **Commands**: Slash commands in `commands/` directory, each exports `data` and `execute`
- **Core utilities**: `utils.ts` contains unified upload system and interaction handlers
- **AI Integration**: Advanced Ollama-powered expert consultation and librarian systems
  - `ollamautils.ts` - Core Ollama API client with server failover
  - `agenticutils.ts` - Agentic chat system with tool calling capabilities 
  - `personalities.ts` - Expert personality system with 5+ character types
  - `personalities/librarian.ts` - Specialized librarian agent with MAM integration

### 3. Configuration (`src/config/`)
- **Environment**: `env.ts` uses Zod schemas for type-safe environment validation
- **File**: `.env.local` contains all service credentials and configuration

## Key Architectural Patterns

### Unified Upload System
The bot uses a centralized upload system (`src/bot/utils.ts`) that handles:
- Content type analysis (audiobook/ebook/mixed media)
- MP3→M4B conversion with user interaction
- Google Drive folder organization with content type prefixes
- Progress tracking and user notifications

### Button Interaction Handling
All Discord button interactions are routed through standardized handlers:
- `handleAutoUploadInteraction()` - For automatic uploads after download completion
- `handleDuplicateUploadInteraction()` - For uploading existing completed torrents
- `handleGDriveUploadInteraction()` - For manual upload commands

### Client Management
External service clients use consistent patterns:
- Singleton management for persistent connections (Deluge)
- Automatic authentication and session handling
- Zod schemas for response validation
- Comprehensive error handling with user-friendly messages

### Expert Consultation System
The bot features an advanced AI consultation system powered by Ollama:
- **Multiple Personalities**: 5 distinct expert personalities (Trump, Clyde, Cuddy, Emperor, Foghorn) each with unique response styles
- **Context Awareness**: Incorporates recent chat history for natural conversation flow
- **Server Failover**: Automatic failover between primary/secondary Ollama servers
- **Character Consistency**: Personality-driven responses maintain character throughout interactions
- **Discord Integration**: Responses formatted specifically for Discord's 2000-character limit

### Librarian Agent System  
Specialized agentic AI for book discovery and recommendations:
- **Agentic Architecture**: Uses tool-calling capabilities to search MAM and provide recommendations
- **Interactive Follow-up**: Supports conversational refinement of search queries
- **Format Filtering**: Can filter by audiobook, ebook, or any format
- **Context Retention**: Maintains conversation history for multi-turn interactions
- **MAM Integration**: Direct access to MyAnonaMouse search capabilities

### Express API Server
The bot hosts a RESTful API server alongside the Discord functionality:
- **Health Monitoring**: `/health` endpoint for service status checks
- **MAM Proxy**: `/api/mam` routes for search, download, and freeleech operations
- **Upload Management**: `/api/uploads` for Google Drive upload coordination
- **Download Tracking**: `/api/downloads` for torrent status and management
- **CORS Enabled**: Cross-origin requests supported for external integrations

## Environment Configuration

The bot requires extensive configuration in `.env.local`. Key environment variables:

### Discord
- `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`

### MyAnonaMouse 
- `MAM_ID` (cookie value for authentication)
- `MAM_USERNAME`, `MAM_PASSWORD`, `MAM_COOKIE`

### Deluge
- `DELUGE_URL`, `DELUGE_PASSWORD`
- `DELUGE_HOST`, `DELUGE_PORT`, `DELUGE_RPC_URL`

### Google Drive
- `GOOGLE_SERVICE_ACCOUNT_PATH` (path to JSON credentials)
- `GOOGLE_DRIVE_FOLDER_ID` (shared drive ID)

### File System
- `DOWNLOADS_DIRECTORY` (default: `/mnt/nas/nzbget/nzb/completed/torrent`)

### Ollama AI Services
- `OLLAMA_PRIMARY_HOST`, `OLLAMA_PRIMARY_MODEL` (primary AI server)
- `OLLAMA_SECONDARY_HOST`, `OLLAMA_SECONDARY_MODEL` (failover server)

### API Server
- `HTTP_PORT` (default: 3000) - Express server port

## Testing Strategy

The project uses Jest with TypeScript:
- Test files in `__tests__` directories or with `.test.ts` suffix
- Setup file: `src/test-setup.ts`
- Test existing endpoints: `src/api/routes/__tests__/`

## Integration Dependencies

### External Files in `samplefiles/`
- `discord-468217-313c7eccba67.json` - Google Drive service account credentials
- `mp3tom4b.sh` - MP3 to M4B conversion script (requires ffmpeg)

### Service Requirements
- Deluge daemon with Web UI enabled
- MyAnonaMouse account with API access and freeleech capability  
- Google Drive shared drive with service account permissions
- Ollama server(s) with AI models for expert consultation and librarian features

## Development Notes

### Hidden Features
- `getmovie` command is intentionally hidden but accessible via `/makefunnyjoke lasagna`
- This is documented in comments to prevent accidental re-registration

### Error Handling
- All interactions include personality-based error messages via `getPersonality()`
- Comprehensive webhook timeout handling for long-running operations
- Graceful fallbacks for failed conversions or uploads

### Code Patterns
- Strict TypeScript configuration with comprehensive type checking
- Zod schemas for runtime validation of external API responses
- Consistent async/await patterns with proper error boundaries
- Discord interaction state management to prevent duplicate responses