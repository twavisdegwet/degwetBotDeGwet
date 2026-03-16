# Discord BookBot - Project Files Documentation

**Generated:** 2026-03-15

## Project Overview

Discord Media Bot that automates audiobook and ebook downloading from MyAnonaMouse (MAM) private tracker, using Deluge torrent client and Google Drive for storage. Features include MP3→M4B conversion, duplicate detection, Send to Kindle email integration, and AI-powered expert consultation system.

---

## Configuration Files

### `package.json`
**Purpose:** Node.js project manifest and build configuration
**Key Scripts:**
- `npm run dev` - Development mode (ts-node-dev with auto-reload)
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run production build
- `npm test` - Run Jest tests
- `npm run lint` - ESLint code quality check
- `npm run format` - Prettier code formatting
- `npm run zip-albums` - Run album zipper script

**Dependencies:** discord.js, express, googleapis, axios, zod, xml2js

---

### `tsconfig.json`
**Purpose:** TypeScript compiler configuration
**Key Settings:**
- Target: ES2022, Module: CommonJS
- Strict mode enabled with comprehensive type checking
- Output: `dist/` directory
- Source: `src/` directory
- Excludes: node_modules, dist

---

### `.env.local`
**Purpose:** Environment variables (not committed to git)
**Contains:** Discord tokens, Deluge credentials, MAM credentials, Google service account, Ollama hosts, etc.

---

### `.env.example`
**Purpose:** Template for environment variables
**Usage:** Copy to `.env.local` and fill in actual values

---

### `src/config/env.ts`
**Purpose:** Type-safe environment variable validation using Zod schemas
**Validates:**
- Discord: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`
- Deluge: `DELUGE_HOST`, `DELUGE_PORT`, `DELUGE_PASSWORD`, `DELUGE_RPC_URL`, `DELUGE_URL`
- MAM: `MAM_ID`, `MAM_USERNAME`, `MAM_PASSWORD`, `TORRENT_BASE_URL`
- Downloads: `DOWNLOADS_DIRECTORY`
- Server: `HTTP_PORT`, `NODE_ENV`
- NZB: `NZBHYDRA_URL`, `NZBHYDRA_API_KEY`, `SABNZBD_URL`, `SABNZBD_API_KEY`
- Google Drive: `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_DRIVE_FOLDER_ID`
- Ollama: `OLLAMA_PRIMARY_HOST`, `OLLAMA_PRIMARY_MODEL`, `OLLAMA_PRIMARY_TYPE`, `OLLAMA_SECONDARY_HOST`, `OLLAMA_SECONDARY_MODEL`, `OLLAMA_SECONDARY_TYPE`, `OLLAMA_APPEND_NOTHINK`
- Kindle: `KINDLE_BOT_EMAIL`, `KINDLE_EMAIL_MAPPINGS`
- Other: `NVIDIA_API_KEY`, `COMIC_IMAGE_PATH`, `BOT_DISPLAY_NAME`

**Exports:** `env` (validated config), `kindleEmailMappings` (parsed JSON)

---

### `jest.config.js`
**Purpose:** Jest testing framework configuration
**Settings:** ts-jest preset, node environment, tests in `src/**/__tests__/` and `*.test.ts`

---

### `src/test-setup.ts`
**Purpose:** Jest test setup file
**Usage:** Global test configuration and mocks

---

## Entry Points

### `src/index.ts`
**Purpose:** Main application entry point
**Function:** Imports and starts the API server (`src/api/index.ts`)
**One line:** `import './api/index';`

---

### `src/api/index.ts`
**Purpose:** Express API server entry point
**Functions:**
- Creates Express app with CORS enabled
- Imports Discord bot (starts automatically)
- Defines routes: `/`, `/health`, `/api/mam`, `/api/downloads`, `/api/uploads`
- Starts server on `HTTP_PORT` (default: 3000)

**Exports:** `app`, `server`

---

### `src/discord/index.ts`
**Purpose:** Discord bot client setup and command registration
**Functions:**
- Creates Discord client with intents (Guilds, GuildMessages, MessageContent, GuildPresences)
- Registers all slash commands
- Handles command interactions
- Handles button interactions (upload workflows, Kindle email, etc.)
- Manages interaction routing to appropriate handlers

**Registered Commands:**
| Command | File | Description |
|---------|------|-------------|
| `/getaudiobook` | `commands/getaudiobook.ts` | Search and download audiobooks from MAM |
| `/getebook` | `commands/getebook.ts` | Search and download ebooks from MAM |
| `/gdrive-upload` | `commands/gdrive-upload.ts` | Manual Google Drive upload |
| `/gdrive-status` | `commands/gdrive-status.ts` | Check Google Drive upload status |
| `/help` | `commands/help.ts` | Display bot help information |
| `/makefunnyjoke` | `commands/makefunnyjoke.ts` | Generate jokes (includes hidden commands) |
| `/makebadjoke` | `commands/makebadjoke.ts` | Generate bad jokes with personality |
| `/askexpert` | `commands/askexpert.ts` | AI expert consultation |
| `/expertnews` | `commands/expertnews.ts` | Expert commentary on news |
| `/askbible` | `commands/askbible.ts` | Bible verse lookup |

**Hidden Commands** (accessible via `/makefunnyjoke`):
- `/getmovie` - Hidden, triggered by `/makefunnyjoke lasagna`
- `/getmusic` - Hidden, triggered by `/makefunnyjoke kickodie`

**Button Handlers:**
- `auto_upload_*` - Automatic upload after download
- `duplicate_*` - Upload existing completed torrents
- `gdrive_upload:*` - Manual Google Drive upload
- `kindle_email_*` - Send to Kindle email delivery
- `auto_cancel_*` / `duplicate_cancel_*` - Cancel upload operations

**Exports:** `client`

---

## Discord Commands (`src/discord/commands/`)

### `commands/getaudiobook.ts`
**Purpose:** Search and download audiobooks from MyAnonaMouse
**Discord Command:** `/getaudiobook`
**Parameters:** `query` (search term), `kindle_email` (optional)
**Features:**
- MAM search via API
- Torrent download via Deluge
- MP3→M4B conversion option
- Google Drive upload option
- Send to Kindle email option

**Uses:** `src/bot/utils.ts`, `src/api/clients/mamClient.ts`, `src/api/clients/delugeClient.ts`, `src/bot/uploadUtils.ts`, `src/bot/emailUtils.ts`

---

### `commands/getebook.ts`
**Purpose:** Search and download ebooks from MyAnonaMouse
**Discord Command:** `/getebook`
**Parameters:** `query` (search term), `kindle_email` (optional)
**Features:**
- MAM search via API
- Torrent download via Deluge
- PDF/MOBI→EPUB conversion
- Send to Kindle email (auto-converts)
- Google Drive upload option

**Uses:** `src/discord/utils.ts`, `src/api/clients/mamClient.ts`, `src/api/clients/delugeClient.ts`, `src/discord/uploadUtils.ts`, `src/discord/emailUtils.ts`, `src/converters/ebookConverter.ts`

---

### `commands/gdrive-upload.ts`
**Purpose:** Manual Google Drive upload of completed torrents
**Discord Command:** `/gdrive-upload`
**Parameters:** `torrent_name` (autocomplete from completed torrents)
**Features:**
- Lists completed torrents from Deluge
- Uploads selected torrent to Google Drive
- Content type analysis (audiobook/ebook/mixed)

**Uses:** `src/discord/utils.ts`, `src/api/clients/delugeClient.ts`, `src/discord/uploadUtils.ts`

**Exports:** `data` (command definition), `execute` (command handler), `handleGDriveUploadInteraction` (button handler)

---

### `commands/gdrive-status.ts`
**Purpose:** Check Google Drive upload/download status
**Discord Command:** `/gdrive-status`
**Features:** Displays current upload/download status information

---

### `commands/help.ts`
**Purpose:** Display bot help information
**Discord Command:** `/help`
**Features:** Lists all available commands with descriptions

---

### `commands/makefunnyjoke.ts`
**Purpose:** Generate jokes and trigger hidden commands
**Discord Command:** `/makefunnyjoke`
**Parameters:** `input` (text input)
**Special Triggers:**
- `lasagna` → Triggers hidden `/getmovie` command
- `kickodie` → Triggers hidden `/getmusic` command
- Other inputs → Generates joke via AI

**Uses:** `src/bot/ollamautils.ts`, `src/bot/personalities.ts`

---

### `commands/makebadjoke.ts`
**Purpose:** Generate bad jokes with personality
**Discord Command:** `/makebadjoke`
**Features:** Uses personality system for joke generation

**Uses:** `src/discord/badjokes.ts`, `src/discord/personalities.ts`

---

### `commands/askexpert.ts`
**Purpose:** AI expert consultation system
**Discord Command:** `/askexpert`
**Parameters:** `question` (user question)
**Features:**
- 5 expert personalities (Trump, Clyde, Cuddy, Emperor, Foghorn)
- Ollama AI integration with failover
- Context-aware responses
- Discord-formatted output

**Uses:** `src/discord/ollamautils.ts`, `src/discord/personalities.ts`, `src/discord/agenticutils.ts`

---

### `commands/expertnews.ts`
**Purpose:** Expert commentary on news topics
**Discord Command:** `/expertnews`
**Parameters:** `topic` (news topic)
**Features:** AI-generated expert commentary on current events

**Uses:** `src/bot/ollamautils.ts`, `src/bot/personalities.ts`

---

### `commands/askbible.ts`
**Purpose:** Bible verse lookup
**Discord Command:** `/askbible`
**Parameters:** `reference` (bible reference like "John 3:16")
**Features:** Searches local Bible JSON files for verses

**Uses:** `data/bible.json`, `data/biblersv.json`

---

## API Routes (`src/api/routes/`)

### `routes/mam.ts`
**Purpose:** MyAnonaMouse API proxy endpoints
**Routes:**
- `POST /search` - Search MAM torrents
- `POST /download` - Download torrent
- `GET /freeleech` - Check freeleech status

**Uses:** `src/api/clients/mamClient.ts`

---

### `routes/downloads.ts`
**Purpose:** Torrent download management endpoints
**Routes:**
- `GET /` - List all downloads
- `GET /:id` - Get download status
- `POST /` - Start new download
- `DELETE /:id` - Cancel download

**Uses:** `src/api/clients/delugeClient.ts`, `src/api/clients/downloadManagement.ts`

---

### `routes/uploads.ts`
**Purpose:** Google Drive upload management endpoints
**Routes:**
- `POST /` - Upload file to Google Drive
- `GET /status` - Get upload status

**Uses:** `src/api/clients/uploadManagement.ts`

---

### `routes/__tests__/health.test.ts`
**Purpose:** Tests for health endpoint
**Tests:** `/health` endpoint response

---

### `routes/__tests__/mam.test.ts`
**Purpose:** Tests for MAM routes
**Tests:** MAM search and download endpoints

---

## API Clients (`src/api/clients/`)

### `clients/mamClient.ts`
**Purpose:** MyAnonaMouse API client
**Functions:**
- Search torrents by query
- Download torrent files
- Parse MAM HTML responses
- Handle authentication (mam_id cookie)

**Exports:** `searchMAM()`, `downloadTorrent()`

---

### `clients/delugeClient.ts`
**Purpose:** Deluge torrent client API wrapper
**Functions:**
- Connect to Deluge daemon
- Add torrents
- Get torrent status
- Get completed torrents list
- Delete torrents

**Exports:** `DelugeClient` class

---

### `clients/delugeClientManager.ts`
**Purpose:** Singleton Deluge connection manager
**Pattern:** Singleton for persistent Deluge connection
**Functions:**
- Get shared Deluge client instance
- Manage connection lifecycle

**Exports:** `getDelugeClient()`, `DelugeClientManager`

---

### `clients/downloadManagement.ts`
**Purpose:** Download tracking and management
**Functions:**
- Track download progress
- Manage download queue
- Handle download completion callbacks

---

### `clients/uploadManagement.ts`
**Purpose:** Google Drive upload coordination
**Functions:**
- Upload files to Google Drive
- Track upload progress
- Manage upload queue

---

### `clients/nzbhydraClient.ts`
**Purpose:** NZBHydra API client (for Usenet searches)
**Status:** Potentially unused - NZB functionality may not be active

---

### `clients/sabnzbdClient.ts`
**Purpose:** SABnzbd API client (for Usenet downloads)
**Status:** Potentially unused - Usenet functionality may not be active

---

## Bot Utilities (`src/discord/`)

### `utils.ts`
**Purpose:** Unified upload system and interaction handlers
**Key Functions:**
- `handleAutoUploadInteraction()` - Handle auto-upload button clicks
- `handleDuplicateUploadInteraction()` - Handle duplicate upload buttons
- `handleKindleEmailInteraction()` - Handle Kindle email delivery
- Content type analysis (audiobook/ebook/mixed)
- Upload workflow coordination

**Uses:** `src/discord/uploadUtils.ts`, `src/discord/emailUtils.ts`, `src/api/clients/delugeClient.ts`

---

### `uploadUtils.ts`
**Purpose:** Google Drive upload implementation
**Functions:**
- Upload files to Google Drive
- MP3→M4B conversion support
- Folder organization with content type prefixes
- Progress tracking

**Uses:** `googleapis`, `src/converters/mp3Converter.ts`

---

### `emailUtils.ts`
**Purpose:** Send to Kindle email functionality via Gmail API
**Functions:**
- Send email with attachments via Gmail API
- Uses service account with domain-wide delegation
- Impersonates bot user (`KINDLE_BOT_EMAIL`)
- Handles format conversion before sending

**Uses:** `googleapis`, `src/converters/ebookConverter.ts`

---

### `ollamautils.ts`
**Purpose:** Ollama API client with server failover
**Functions:**
- `sendChatMessage()` - Send message to Ollama
- Primary/secondary server failover
- Response sanitization (remove thinking tags)
- Discord character limit handling (2000 chars)
- Support for both Ollama native and OpenAI-compatible APIs

**Configuration:**
- `OLLAMA_PRIMARY_HOST`, `OLLAMA_PRIMARY_MODEL`, `OLLAMA_PRIMARY_TYPE`
- `OLLAMA_SECONDARY_HOST`, `OLLAMA_SECONDARY_MODEL`, `OLLAMA_SECONDARY_TYPE`
- `OLLAMA_APPEND_NOTHINK` - Disable thinking tags at source

**Location:** `src/discord/ollamautils.ts`

---

### `personalities.ts`
**Purpose:** Expert personality system
**Personalities:**
- Trump - Distinctive speaking style
- Clyde - Friendly assistant
- Cuddy - Caring, supportive
- Emperor - Regal, authoritative
- Foghorn - Southern drawl

**Functions:**
- `getPersonality()` - Get random personality for error messages
- `getExpertPersonality()` - Get specific personality for consultations
- Personality-driven response formatting

**Location:** `src/discord/personalities.ts`

---

### `badjokes.ts`
**Purpose:** Bad joke generation and personality integration
**Functions:**
- `getPersonality()` - Get personality for jokes/errors
- Joke generation logic

**Location:** `src/discord/badjokes.ts`

---

### `agenticutils.ts`
**Purpose:** Agentic AI chat system with tool calling
**Features:**
- Tool-based AI interactions
- Librarian agent integration
- MAM search tool access
- Multi-turn conversation support

**Uses:** `src/discord/ollamautils.ts`, `src/api/clients/mamClient.ts`

**Location:** `src/discord/agenticutils.ts`

---

### `presenceUtils.ts`
**Purpose:** Discord presence/bot status management
**Functions:** Update bot status and activity

**Location:** `src/discord/presenceUtils.ts`

---

### `garfieldMessages.ts`
**Purpose:** Garfield-themed messages
**Status:** Potentially unused or minimal usage

**Location:** `src/discord/garfieldMessages.ts`

---

## Converters (`src/converters/`)

### `converters/mp3Converter.ts`
**Purpose:** MP3 to M4B audiobook conversion
**Functions:**
- Convert MP3 files/folders to M4B format
- Uses external script at `src/converters/scripts/mp3tom4b.sh`
- Chapter markers support
- Metadata preservation

---

### `converters/ebookConverter.ts`
**Purpose:** Ebook format conversion
**Functions:**
- Convert PDF/MOBI to EPUB
- Uses Calibre's `ebook-convert` command
- Temporary file management

**Script:** `src/converters/scripts/ebookconvert.sh`

---

## Shared Utilities (`src/shared/`)

### `shared/logger.ts`
**Purpose:** Centralized logging utility
**Functions:** Structured logging for the application

---

## Bluesky Integration (`src/api/` and `src/config/`)

### `api/auth/bluesky-auth.ts`
**Purpose:** Bluesky authentication handling
**Status:** Potentially unused - Bluesky integration may be incomplete

---

### `api/clients/bskyclient.ts`
**Purpose:** Bluesky API client
**Status:** Potentially unused - Bluesky integration may be incomplete

---

### `config/bluesky-accounts.ts`
**Purpose:** Bluesky account configuration
**Status:** Potentially unused - Bluesky integration may be incomplete

---

## Shell Scripts (`src/converters/scripts/`)

### `converters/scripts/mp3tom4b.sh`
**Purpose:** MP3 to M4B conversion script
**Requirements:** ffmpeg
**Usage:** Called by `src/converters/mp3Converter.ts`

---

### `converters/scripts/ebookconvert.sh`
**Purpose:** Ebook format conversion script
**Requirements:** Calibre (ebook-convert command)
**Usage:** Called by `src/converters/ebookConverter.ts`

---

### `converters/scripts/albumzipper.sh`
**Purpose:** Zip music albums
**Usage:** Run via `npm run zip-albums`

---

## Data Files (`data/`)

### `data/bible.json`
**Purpose:** Bible text database (unspecified version)
**Usage:** `/askbible` command

---

### `data/biblersv.json`
**Purpose:** Bible text database (RSV version)
**Usage:** `/askbible` command

---

## Documentation Files

### `README.md`
**Purpose:** Project documentation and setup guide

---

### `SETUP.md`
**Purpose:** Detailed setup instructions

---

### `CLAUDE.md`
**Purpose:** Claude Code assistant guidance file
**Contains:** Architecture overview, development commands, key patterns

---

### `plan.md`
**Purpose:** Project planning and roadmap

---

## Example/Template Files

### `samplefiles/discord-service-account.example.json`
**Purpose:** Template for Google service account credentials

---

### `samplefiles/oauth-client.example.json`
**Purpose:** Template for OAuth client configuration

---

## Detailed API Routes Documentation

### `routes/mam.ts` (Complete)
**Purpose:** MyAnonaMouse API proxy with comprehensive search and download functionality

**Endpoints:**
| Method | Endpoint | Description | Used By |
|--------|----------|-------------|---------|
| POST | `/search` | Search MAM torrents with filters | `/getaudiobook`, `/getebook` |
| POST | `/download` | Download torrent to Deluge | `/getaudiobook`, `/getebook` |
| POST | `/freeleech` | Set torrent as freeleech using wedges | Auto-called before downloads |
| POST | `/check-duplicate` | Check if torrent exists in Deluge | Pre-download check |
| GET | `/test-connection` | Test MAM authentication | Debugging |
| GET | `/help` | API documentation | Debugging |

**Key Features:**
- Zod schema validation for all request parameters
- Automatic freeleech setting before download
- Duplicate detection with torrent info return
- Comprehensive search parameters (category, filetype, size ranges, seeders, etc.)

**Uses:** `mamClient.ts`, `delugeClientManager.ts`

---

### `routes/downloads.ts` (Complete)
**Purpose:** Deluge webhook and completed torrent management

**Endpoints:**
| Method | Endpoint | Description | Used By |
|--------|----------|-------------|---------|
| POST | `/webhook` | Handle Deluge torrent completion events | Deluge webhooks |
| GET | `/completed` | List completed torrents pending upload | Status checks |
| POST | `/upload-completed` | Upload all completed torrents to GDrive | Batch uploads |

**Key Features:**
- Webhook handler for `torrent_completed` events
- Integration with `uploadTorrentToGDrive()` from bot layer
- Batch upload capability

**Uses:** `downloadManagement.ts`, `delugeClientManager.ts`, `uploadUtils.ts`

---

### `routes/uploads.ts` (Complete)
**Purpose:** Google Drive upload management API

**Endpoints:**
| Method | Endpoint | Description | Used By |
|--------|----------|-------------|---------|
| GET | `/status` | Check GDrive auth and storage status | Debugging |
| POST | `/torrent` | Upload torrent files to GDrive | API clients |
| GET | `/files` | List files in GDrive folder | Debugging |

**Key Features:**
- Uses unified `uploadTorrentToGDrive()` from `uploadUtils.ts`
- Service account authentication checking
- Storage quota display

**Uses:** `uploadManagement.ts`, `uploadUtils.ts`

---

## Detailed API Clients Documentation

### `clients/downloadManagement.ts` (Complete)
**Purpose:** Deluge torrent management wrapper

**Functions:**
- `listCompletedTorrents()` - Get torrents with 100% progress in Seeding/Paused state
- `getTorrentFiles(torrentId)` - Get file list for a torrent
- `searchTorrents(query)` - Search completed torrents by name
- `getTorrentInfo(torrentId)` - Get save_path and name for torrent

**Uses:** `delugeClient.ts`

---

### `clients/uploadManagement.ts` (Complete)
**Purpose:** Google Drive upload client with content analysis and conversion

**Key Classes:**
- `UploadManagementClient` - Main client class

**Key Functions:**
- `uploadTorrent()` - Upload torrent with optional MP3/ebook conversion
- `analyzeContentType()` - Determine if content is audiobook/ebook/mixed
- `convertMp3ToM4bImproved()` - MP3 to M4B conversion with metadata
- `convertEbooksImproved()` - Ebook conversion to EPUB + MOBI
- `createFolder()` - Create GDrive folder with content type prefix
- `uploadFile()` - Upload individual file to GDrive

**Features:**
- Retry logic with exponential backoff for network errors
- Content type analysis (audiobook/ebook/mixed/unknown)
- Automatic folder naming with `[Audiobook]`, `[E-book]`, `[Mixed Media]` prefixes
- Temp directory management with cleanup
- Garfield-themed console logging

**Uses:** `mp3Converter.ts`, `ebookConverter.ts`, `googleapis`

---

### `clients/nzbhydraClient.ts` (Complete)
**Purpose:** NZBHydra API client for Usenet searches

**Functions:**
- `searchMovies(query, quality)` - Search for movies with 1080p 5.1 filter
- `searchMusic(query)` - Search for audio/MP3 content
- `getNzbUrl(guid)` - Get NZB download URL

**Features:**
- XML response parsing with xml2js
- Automatic 1080p 5.1 filtering for movies
- Results sorted by publication date

**Used By:** Hidden `/getmovie` and `/getmusic` commands (via `makefunnyjoke.ts`)

---

### `clients/sabnzbdClient.ts` (Complete)
**Purpose:** SABnzbd Usenet downloader client

**Functions:**
- `addNzb(nzbUrl, category)` - Add NZB to download queue

**Used By:** Hidden `/getmovie` and `/getmusic` commands (via `makefunnyjoke.ts`)

---

### `clients/bskyclient.ts` (Complete)
**Purpose:** Bluesky social media API client

**Functions:**
- `searchBlueskyPosts(query, limit)` - Search posts with authenticated/public API fallback
- `fetchBlueskyPosts()` - Fetch posts from configured accounts
- `formatBlueskyPostsForPrompt()` - Format posts for AI context
- `formatBlueskyPostsForPromptAnonymous()` - Format without author info

**Features:**
- Multi-account feed aggregation
- Authenticated search with public API fallback
- Local filtering fallback if API fails
- URL removal from post text

**Used By:** `/expertnews` command for news context

---

## Detailed Bot Utilities Documentation

### `utils.ts` (Complete)
**Purpose:** Central interaction handler and unified upload system

**Key Functions:**
- `handleBookSearch()` - Unified search/download/upload flow for audiobooks/ebooks
- `handleAutoUploadInteraction()` - Handle auto-upload button clicks
- `handleDuplicateUploadInteraction()` - Handle duplicate torrent upload
- `handleGDriveUploadInteraction()` - Handle manual GDrive upload
- `handleKindleEmailInteraction()` - Handle Send to Kindle delivery
- `analyzeContentAndUpload()` - Content analysis + upload with conversion options

**Features:**
- Unified upload workflow for all commands
- Button interaction state management
- Progress tracking with Discord embeds
- Error handling with personality-based messages

**Uses:** `uploadUtils.ts`, `emailUtils.ts`, `delugeClient.ts`, `personalities.ts`

---

### `uploadUtils.ts` (Complete)
**Purpose:** Google Drive upload implementation with progress tracking

**Key Functions:**
- `uploadTorrentToGDrive()` - Main upload function with conversion support
- `uploadSingleFileToGDrive()` - Upload individual file
- `createFolderWithContentType()` - Create folder with content type prefix

**Features:**
- MP3→M4B conversion prompting
- Ebook conversion prompting
- Progress bar formatting
- File size formatting utilities

**Uses:** `uploadManagement.ts`, `mp3Converter.ts`, `ebookConverter.ts`

---

### `emailUtils.ts` (Complete)
**Purpose:** Send to Kindle email delivery via Gmail API

**Key Functions:**
- `sendEmailViaGmail()` - Send email with attachments via Gmail API
- `sendToKindle()` - Send ebook to Kindle email address
- `convertAndSendToKindle()` - Convert ebook then send

**Features:**
- Service account with domain-wide delegation
- Bot user impersonation (`KINDLE_BOT_EMAIL`)
- Automatic PDF/MOBI→EPUB conversion before sending
- 50MB file size validation (Amazon limit)

**Uses:** `ebookConverter.ts`, `googleapis`

---

### `agenticutils.ts` (Complete)
**Purpose:** Agentic AI chat system with tool calling

**Key Functions:**
- `sendAgenticChat()` - Send message with tool-calling support
- `createLibrarianAgent()` - Create librarian agent with MAM search tool
- Tool execution handler for MAM searches

**Features:**
- Tool-based AI interactions
- Librarian agent for book recommendations
- Multi-turn conversation support
- Context retention

**Uses:** `ollamautils.ts`, `mamClient.ts`

---

### `personalities.ts` (Complete)
**Purpose:** Expert personality system with 6 characters

**Personalities:**
| Name | Style | Use Case |
|------|-------|----------|
| Trump | Distinctive speaking style, superlative-heavy | Error messages, jokes |
| Clyde | Friendly, helpful | General assistance |
| Cuddy | Caring, supportive | Encouraging messages |
| Emperor | Regal, authoritative | Formal responses |
| Foghorn | Southern drawl, folksy | Casual interactions |
| Bonzo | Witty, sarcastic | Humor, jokes |

**Functions:**
- `getPersonality()` - Get random personality for errors
- `getExpertPersonality(name)` - Get specific personality
- `formatPersonalityResponse()` - Format response with personality prefix

---

### `garfieldMessages.ts` (Complete)
**Purpose:** Garfield-themed waiting/completion messages

**Functions:**
- `getGarfieldWaitingMessage()` - Get themed waiting message
- `getGarfieldCompletionMessage()` - Get themed completion message

**Used By:** Comic delivery features in `utils.ts`

---

### `presenceUtils.ts` (Complete)
**Purpose:** Discord presence management

**Functions:**
- `setGamePresence()` - Set bot's game status
- `clearPresence()` - Clear bot status

**Features:** Shows when users are playing games (for comic delivery context)

---

## Utility Modules (Complete)

### `utils/mp3Converter.ts` (Complete)
**Purpose:** MP3 to M4B conversion wrapper

**Functions:**
- `convertMp3ToM4b()` - Convert directory of MP3s to M4B
- `convertFromMamDownload()` - Convert with MAM metadata
- `hasMP3Files()` - Check if directory has MP3 files

**Features:**
- Calls external `mp3tom4b.sh` script
- Metadata extraction from torrent name
- Chapter marker support via script

---

### `utils/ebookConverter.ts` (Complete)
**Purpose:** Ebook format conversion wrapper

**Functions:**
- `convertEbook()` - Convert single ebook to EPUB + MOBI
- `convertFromMamDownload()` - Convert all ebooks in directory
- `hasConvertibleEbooks()` - Check for PDFs or single-format ebooks

**Features:**
- Calls external `ebookconvert.sh` script
- Prefers converting PDFs first
- Creates both EPUB and MOBI outputs

---

### `utils/logger.ts` (Complete)
**Purpose:** Simple logging utility with environment filtering

**Functions:**
- `Logger.info()` - Info logs (hidden in production)
- `Logger.error()` - Error logs (always shown)
- `Logger.warn()` - Warning logs (hidden in production)
- `Logger.debug()` - Debug logs (development only)

---

## Bluesky Integration (Complete)

### `api/auth/bluesky-auth.ts` (Complete)
**Purpose:** Bluesky authentication manager

**Features:**
- JWT session management with refresh
- Automatic token refresh before expiry
- Session creation with credentials

**Environment Variables:**
- `BLUESKY_PDS_HOST` - Bluesky PDS server
- `BLUESKY_HANDLE` - Account handle
- `BLUESKY_PASSWORD` - Account password

---

### `config/bluesky-accounts.ts` (Complete)
**Purpose:** Configured Bluesky accounts for feed aggregation

**Accounts:**
- Chicago Tribune (DID)
- Heather Cherone - Chicago reporter
- PBS News
- Trump Truth Social reposter
- Bloomberg
- Washington Post
- New York Times

---

## Data Files (Complete)

### `books/bible.json`
**Purpose:** Bible text database (NRSV or similar modern translation)
**Structure:**
```json
{
  "books": [
    {
      "name": "Genesis",
      "chapters": [
        {
          "chapter": 1,
          "verses": [
            {"id": 1, "verse": 1, "text": "..."}
          ]
        }
      ]
    }
  ]
}
```

---

### `books/biblersv.json`
**Purpose:** Bible text database (RSV - Revised Standard Version)
**Structure:** Same as `bible.json`

---

## Sample/Template Files

### `samplefiles/discord-service-account.example.json`
**Purpose:** Template for Google service account credentials
**Usage:** Copy to actual path and configure with real credentials

---

### `samplefiles/oauth-client.example.json`
**Purpose:** Template for OAuth 2.0 client configuration
**Usage:** Configure for Gmail API domain-wide delegation

---

## Unknown/Empty Directories

### `heath/`
**Purpose:** Unknown - directory exists but is empty
**Status:** May be leftover from previous development or reserved for future use

---

## Unused or Potentially Unused Files Analysis

### Confirmed Used Files
All files documented above are actively used except the following:

### Potentially Unused Files

| File | Status | Notes |
|------|--------|-------|
| `src/api/clients/nzbhydraClient.ts` | ⚠️ Limited use | Only used by hidden `/getmovie` and `/getmusic` commands (triggered via `/makefunnyjoke lasagna/kickodie`) |
| `src/api/clients/sabnzbdClient.ts` | ⚠️ Limited use | Only used by hidden commands above |
| `src/api/auth/bluesky-auth.ts` | ✅ Used | Used by `bskyclient.ts` for authenticated Bluesky API access |
| `src/config/bluesky-accounts.ts` | ✅ Used | Imported by `bskyclient.ts` for account list |
| `src/api/clients/bskyclient.ts` | ✅ Used | Used by `/expertnews` command for news context |
| `src/bot/garfieldMessages.ts` | ✅ Used | Used by `utils.ts` for comic delivery messages |

### Environment Variables That May Be Unused
Check `.env.local` for these - they may not be actively used:
- `BLUESKY_PDS_HOST`, `BLUESKY_HANDLE`, `BLUESKY_PASSWORD` - Only used if Bluesky auth is needed
- `NZBHYDRA_URL`, `NZBHYDRA_API_KEY` - Only for hidden commands
- `SABNZBD_URL`, `SABNZBD_API_KEY` - Only for hidden commands

### Notes on "Unused" Designations
- **Hidden commands are intentional**: The `/getmovie` and `/getmusic` commands are intentionally hidden and only accessible via `/makefunnyjoke lasagna` and `/makefunnyjoke kickodie` respectively. This is documented behavior, not accidental unused code.
- **Bluesky integration is active**: While it may appear unused, the Bluesky client is actively used by `/expertnews` to fetch news context for AI commentary.

---

## Layout Improvement Suggestions

### Current Structure Analysis

The current folder structure has some organizational issues that could be confusing:

```
src/
├── api/
│   ├── clients/       # API clients (MAM, Deluge, NZB, etc.)
│   ├── routes/        # Express route handlers
│   └── auth/          # Authentication (Bluesky)
├── bot/
│   ├── commands/      # Discord slash commands
│   ├── utils.ts       # Bot utilities
│   ├── uploadUtils.ts # Upload helpers
│   ├── emailUtils.ts  # Email helpers
│   └── ...            # Other bot utilities
├── utils/
│   ├── mp3Converter.ts
│   ├── ebookConverter.ts
│   └── logger.ts
└── config/
    ├── env.ts
    └── bluesky-accounts.ts
```

### Issues Identified

1. **Blurred responsibilities between `api/` and `bot/`**: 
   - `src/bot/utils.ts` imports from `src/api/clients/`
   - `src/api/routes/uploads.ts` imports from `src/bot/uploadUtils.ts`
   - This creates circular dependency potential

2. **`src/utils/` vs `src/bot/` utilities**:
   - `src/utils/` contains converter wrappers and logger
   - `src/bot/` contains upload, email, ollama utilities
   - The distinction is unclear (utils for non-Discord, bot for Discord-specific?)

3. **API clients mixed with API routes**:
   - `api/clients/` contains service clients (MAM, Deluge)
   - `api/routes/` contains Express handlers
   - These serve different purposes but are grouped together

4. **`samplefiles/` at root level**:
   - Contains shell scripts AND template JSON files
   - Scripts are executable code, templates are configuration

### Suggested Restructuring

```
src/
├── index.ts                    # Main entry point
├── config/
│   ├── env.ts                  # Environment validation
│   └── bluesky-accounts.ts     # Bluesky configuration
├── clients/                    # External service clients (moved from api/clients/)
│   ├── mam/
│   │   ├── client.ts           # MAM API client
│   │   └── types.ts            # MAM types/interfaces
│   ├── deluge/
│   │   ├── client.ts           # Deluge client
│   │   └── manager.ts          # Connection manager (singleton)
│   ├── nzb/
│   │   ├── hydraClient.ts      # NZBHydra client
│   │   └── sabnzbdClient.ts    # SABnzbd client
│   ├── google/
│   │   ├── driveClient.ts      # Google Drive client
│   │   └── gmailClient.ts      # Gmail API client
│   └── bluesky/
│       ├── client.ts           # Bluesky API client
│       └── auth.ts             # Bluesky authentication
├── converters/                 # File conversion utilities (moved from src/utils/)
│   ├── mp3Converter.ts         # MP3 → M4B conversion
│   ├── ebookConverter.ts       # Ebook format conversion
│   └── scripts/                # Shell scripts (moved from samplefiles/)
│       ├── mp3tom4b.sh
│       ├── ebookconvert.sh
│       └── albumzipper.sh
├── discord/                    # Discord bot code (renamed from bot/)
│   ├── index.ts                # Discord client setup
│   ├── commands/
│   │   ├── getaudiobook.ts
│   │   ├── getebook.ts
│   │   └── ...
│   ├── handlers/               # Interaction handlers (extracted from utils.ts)
│   │   ├── buttonHandler.ts
│   │   ├── commandHandler.ts
│   │   └── autocompleteHandler.ts
│   ├── features/
│   │   ├── upload/
│   │   │   ├── uploadFlow.ts   # Unified upload system
│   │   │   └── gdrive.ts       # Google Drive upload
│   │   ├── email/
│   │   │   └── kindle.ts       # Send to Kindle
│   │   ├── ai/
│   │   │   ├── ollama.ts       # Ollama client
│   │   │   ├── personalities.ts
│   │   │   ├── agentic.ts      # Agentic chat system
│   │   │   └── jokes.ts        # Bad jokes system
│   │   └── comics/
│   │       └── garfield.ts     # Garfield comic delivery
│   └── utils/
│       ├── presence.ts         # Presence management
│       └── logger.ts           # Logger (or keep in shared/)
├── api/                        # Express API server
│   ├── index.ts                # Express app setup
│   ├── routes/
│   │   ├── mam.ts
│   │   ├── downloads.ts
│   │   └── uploads.ts
│   └── middleware/             # Express middleware (if any)
├── shared/                     # Shared utilities
│   ├── logger.ts               # Logger (accessible everywhere)
│   └── types.ts                # Shared TypeScript types
└── data/                       # Data files (moved from root)
    ├── bible.json
    └── biblersv.json
```

### Benefits of Restructuring

1. **Clear separation of concerns**:
   - `clients/` = External service communication
   - `converters/` = File format conversion
   - `discord/` = Discord-specific code
   - `api/` = Express HTTP API
   - `shared/` = Cross-cutting utilities

2. **Reduced circular dependency risk**:
   - Clients don't import from Discord or API layers
   - Discord features import from clients, converters
   - API routes import from clients, converters

3. **Better discoverability**:
   - All Discord commands in `discord/commands/`
   - All AI features in `discord/features/ai/`
   - All upload logic in `discord/features/upload/`

4. **Scalability**:
   - Easy to add new clients
   - Easy to add new Discord features
   - Clear place for new converters

### Migration Considerations

If restructuring:
1. Update all import paths
2. Keep backward compatibility during transition
3. Update `tsconfig.json` path mappings if using them
4. Update any hardcoded paths in shell scripts
5. Test thoroughly after each major move

### Alternative: Minimal Changes

If full restructuring is too much, consider these minimal improvements:

1. **Move shell scripts to dedicated folder**:
   ```
   scripts/
   ├── mp3tom4b.sh
   ├── ebookconvert.sh
   └── albumzipper.sh
   ```

2. **Move data files out of root**:
   ```
   data/
   ├── bible.json
   └── biblersv.json
   ```

3. **Rename `src/bot/` to `src/discord/`** for clarity

4. **Add README.md files** in each folder explaining its purpose

---

## Command-to-Files Mapping

### `/getaudiobook` Command Flow
```
commands/getaudiobook.ts
  ↓
src/bot/utils.ts (handleBookSearch)
  ↓
src/api/routes/mam.ts (POST /search)
  ↓
src/api/clients/mamClient.ts
  ↓
[User selects torrent]
  ↓
src/api/routes/mam.ts (POST /download)
  ↓
src/api/clients/delugeClient.ts + delugeClientManager.ts
  ↓
[Download complete]
  ↓
src/bot/uploadUtils.ts (uploadTorrentToGDrive)
  ↓
src/api/clients/uploadManagement.ts
  ↓
src/utils/mp3Converter.ts (if converting)
  ↓
samplefiles/mp3tom4b.sh
```

### `/getebook` Command Flow
```
commands/getebook.ts
  ↓
src/bot/utils.ts (handleBookSearch)
  ↓
src/api/routes/mam.ts (POST /search)
  ↓
src/api/clients/mamClient.ts
  ↓
[User selects torrent]
  ↓
src/api/routes/mam.ts (POST /download)
  ↓
src/api/clients/delugeClient.ts
  ↓
[Download complete]
  ↓
src/bot/uploadUtils.ts OR src/bot/emailUtils.ts (if Kindle email)
  ↓
src/utils/ebookConverter.ts (if converting)
  ↓
samplefiles/ebookconvert.sh
```

### `/askexpert` Command Flow
```
commands/askexpert.ts
  ↓
src/bot/ollamautils.ts (sendChatMessage)
  ↓
src/bot/personalities.ts (getExpertPersonality)
  ↓
[Ollama API call with failover]
  ↓
src/bot/agenticutils.ts (if using agentic mode)
```

### `/expertnews` Command Flow
```
commands/expertnews.ts
  ↓
src/api/clients/bskyclient.ts (searchBlueskyPosts)
  ↓
src/api/auth/bluesky-auth.ts (authentication)
  ↓
src/config/bluesky-accounts.ts (account list)
  ↓
src/bot/ollamautils.ts (generate commentary)
  ↓
src/bot/personalities.ts
```

### `/gdrive-upload` Command Flow
```
commands/gdrive-upload.ts
  ↓
src/api/clients/delugeClient.ts (list completed torrents)
  ↓
[User selects torrent]
  ↓
src/bot/uploadUtils.ts (uploadTorrentToGDrive)
  ↓
src/api/clients/uploadManagement.ts
```

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Discord Commands | 10 (8 visible + 2 hidden) |
| API Routes | 3 main route files |
| API Clients | 7 clients |
| Bot Utilities | 9 utility files |
| Converter Scripts | 3 shell scripts |
| Data Files | 2 Bible JSON files |
| Config Files | 2 (env + bluesky accounts) |
| Test Files | 2 test files |

**Total Source Files:** ~35 TypeScript files + 3 shell scripts

---