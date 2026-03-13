# Discord Media Bot

A comprehensive Discord bot that integrates with MyAnonaMouse (MAM) private tracker, Deluge torrent client, and Google Drive for automated audiobook/ebook downloading, processing, and cloud storage.

## 🚀 Features

### Core Functionality
- 🔍 **Smart Search**: Search MyAnonaMouse for audiobooks and ebooks with advanced filtering
- 📥 **Automatic Downloads**: Seamless torrent downloading to Deluge with duplicate detection
- ☁️ **Google Drive Integration**: Automatic upload to Google Drive with intelligent folder organization (unified upload system for all pathways)
- 📧 **Send to Kindle**: Automatic email delivery of ebooks directly to your Kindle device via Gmail API
- 🎵 **MP3→M4B Conversion**: Automatic audiobook format conversion for better compatibility
- 📚 **Ebook Format Conversion**: PDF/MOBI to EPUB conversion for Kindle compatibility
- 💎 **VIP/Freeleech Management**: Automatic freeleech setting for VIP torrents
- 🔄 **Duplicate Handling**: Smart duplicate detection with upload options for completed torrents (uses unified upload system)
- 🤖 **Discord Bot**: Intuitive slash commands with interactive button interfaces

### Advanced Features
- 📂 **Content Analysis**: Automatic detection of audiobooks, ebooks, and mixed media
- 🏷️ **Smart Organization**: Folder naming with content type prefixes (`[Audiobook]`, `[E-book]`, `[Mixed Media]`)
- ⏱️ **Long Operation Support**: Handles long-running operations (30+ minutes) with proper user notifications
- 🔗 **Direct Links**: Clickable Google Drive folder links in success messages
- 📊 **Detailed Status**: Comprehensive upload status with file counts and sizes

## 🔌 External Service Dependencies

### Required

**Discord** — Bot platform. Create an application and bot token at https://discord.com/developers/applications. You'll need `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and `DISCORD_GUILD_ID`.

**MyAnonaMouse (MAM)** — Private tracker for audiobooks and ebooks. The bot authenticates via your `mam_id` session cookie. Requires an active account with API access at https://www.myanonamouse.net.

**Deluge** — BitTorrent client that receives downloads. The bot communicates with Deluge's JSON-RPC Web UI (default port 8112). Any networked Deluge instance works; set `DELUGE_URL`, `DELUGE_HOST`, and `DELUGE_PASSWORD`.

**Google Drive** — Cloud storage for uploaded files. Requires a Google Cloud service account with Drive API access and a shared drive. Create a project and service account at https://console.cloud.google.com, then paste the credentials JSON into `GOOGLE_SERVICE_ACCOUNT_JSON`.

**Gmail API** — Used for Send to Kindle email delivery. Enabled in the same Google Cloud project as Drive, with domain-wide delegation configured so the service account can send email as a dedicated bot user. Setup: https://console.cloud.google.com → APIs & Services → Gmail API.

### AI (choose one or both)

**Ollama** — Local LLM server used for the `/askexpert` and related commands. Run any compatible model locally or on another host. Download and model docs at https://ollama.com. Set `OLLAMA_PRIMARY_HOST` and `OLLAMA_PRIMARY_MODEL`.

**llama-swap / llama.cpp** — Alternative OpenAI-compatible inference server. Set `OLLAMA_PRIMARY_TYPE=openai` to use any server that exposes an OpenAI-compatible `/v1/chat/completions` endpoint (llama-swap, llama.cpp server, vLLM, etc.).

**NVIDIA API** *(optional)* — Cloud-hosted LLM fallback via NVIDIA's inference API. If `NVIDIA_API_KEY` is set it is tried before Ollama. Get a key at https://build.nvidia.com.

### Optional

**NZBHydra2** — Usenet indexer aggregator used by hidden music/media commands. Web UI and API key at `http://your-host:5076`. Docs: https://github.com/theotherp/nzbhydra2.

**SABnzbd** — Usenet download client paired with NZBHydra2. API key found in SABnzbd Settings → General. Docs: https://sabnzbd.org.

**Bluesky** *(optional)* — Social posting integration. Uses standard Bluesky app passwords (not your main password). Generate one at https://bsky.app → Settings → App Passwords.

### Local tools (must be installed on the bot server)

**FFmpeg** — Required for MP3→M4B audiobook conversion. `sudo apt install ffmpeg` / `sudo dnf install ffmpeg`.

**Calibre** — Required for ebook format conversion (PDF/MOBI→EPUB). `sudo apt install calibre` / `sudo dnf install calibre`.

---

## 🎯 Quick Start

### Prerequisites

- Node.js 18+
- At minimum: Discord bot token, MAM account, Deluge instance, Google Cloud service account

### Installation

```bash
# Clone repository
git clone <repository-url>
cd discordBot

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit configuration
nano .env.local
```

### Configuration

Edit `.env.local` with your credentials:

```bash
# Discord Bot
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_guild_id

# MyAnonaMouse
MAM_ID=your_mam_cookie_value
TORRENT_BASE_URL=https://www.myanonamouse.net

# Deluge Configuration
DELUGE_URL=http://192.168.x.x:8112/json
DELUGE_PASSWORD=your_deluge_password

# Google Drive (paste entire service account JSON as a single-line string)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
GOOGLE_DRIVE_FOLDER_ID=your_shared_drive_id

# Send to Kindle (Gmail API - uses same service account)
KINDLE_BOT_EMAIL=bot@yourdomain.com
TORRENT_BASE_URL=https://www.myanonamouse.net
```

### Setup Files

Place these files in the `samplefiles/` directory:
- `mp3tom4b.sh` - MP3 to M4B conversion script (requires FFmpeg)
- `ebookconvert.sh` - Ebook format conversion script (requires Calibre)

The Google service account credentials go directly in `.env.local` as `GOOGLE_SERVICE_ACCOUNT_JSON` (minify with `jq -c . service-account.json`).

### Running

```bash
# Development mode (API + Discord Bot)
npm run dev

# Production build
npm run build
npm start
```

## 📱 Discord Commands

### Primary Commands

#### `/getaudiobook`
Search and download audiobooks from MyAnonaMouse.

**Parameters:**
- `query` (required) - Book title, author, or keyword
- `author` (optional) - Filter by specific author
- `format` (optional) - File format (mp3, m4b, etc.)
- `freeleech` (optional) - Show only freeleech torrents
- `limit` (optional) - Number of results (default: 10, max: 25)

**Example:**
```
/getaudiobook query:Casino Royale author:Ian Fleming format:mp3 limit:5
```

#### `/getebook`
Search and download ebooks from MyAnonaMouse with optional Send to Kindle.

**Parameters:**
- `query` (required) - Book title, author, or keyword
- `kindle_email` (optional) - Your Kindle email address for automatic delivery
- `author`, `format`, `freeleech`, `limit` - Same as `/getaudiobook`

**Examples:**
```
# Download and upload to Google Drive
/getebook query:Foundation author:Isaac Asimov

# Download and send directly to Kindle
/getebook query:Foundation kindle_email:yourname@kindle.com
```

**Note:** When `kindle_email` is provided, the bot automatically sends the ebook to your Kindle device and then offers to also upload to Google Drive.

#### `/gdrive-upload`
Manually upload completed torrents to Google Drive (uses the same unified upload system as automatic uploads).

**Parameters:**
- `query` (required) - Search term to find the torrent to upload

#### `/gdrive-status`
Check Google Drive upload status and storage information.

#### `/askexpert`
Consult with one of our expert consultants for advice on any topic.

**Parameters:**
- `question` (required) - The question you want to ask our expert
- `expert` (optional) - Choose which expert to consult (default: random expert)
  - Available experts: Trump, Clyde, Cuddy, Emperor, Foghorn
  - "Random Expert" - Get a random expert for your question
- `context` (optional) - Number of recent messages to include as context (default: 10, max: 50)

**Example:**
```
/askexpert question:What's the best way to organize my audiobook collection?
```

#### `/help`
Display comprehensive help information.

### Utility Commands

#### Direct Upload from Downloads List
After using `/gdrive-status` to list downloads:
- Type `u[number]` to upload (e.g., `u1` for first torrent)
- Type `ua[number]` to upload with MP3→M4B conversion (e.g., `ua1`)

## 🔄 Complete Workflow

### Automatic Workflow
1. **Search**: User runs `/getaudiobook query:"book title"`
2. **Selection**: Bot displays numbered results with rich information
3. **Download**: User selects by typing a number
4. **Processing**: Bot automatically:
   - Sets VIP torrents as freeleech if needed
   - Checks for duplicates in Deluge
   - Downloads and adds the torrent
   - Monitors download progress
5. **Upload**: When download completes:
   - Analyzes content type (audiobook/ebook/mixed)
   - Prompts for MP3→M4B conversion if applicable (uses unified upload system)
   - Uploads to Google Drive with proper organization (uses unified upload system)
   - Provides clickable folder links

### Duplicate Handling
When a torrent already exists in Deluge:
- **If completed**: Offers immediate Google Drive upload with interactive buttons (uses unified upload system)
- **If downloading**: Informs user to wait and provides manual upload option
- **Smart detection**: Extracts torrent hash from error messages for precise matching

### Content Organization
Files are automatically organized in Google Drive:
- `[Audiobook] Author - Title` - For audio content
- `[E-book] Author - Title` - For text content
- `[Mixed Media] Author - Title` - For combined content

## 🎵 MP3 to M4B Conversion (Audiobooks)

### Automatic Detection
The bot automatically detects audiobooks with MP3 files and offers conversion:

### Conversion Process
1. **Detection**: Scans for MP3 files in completed torrents
2. **User Choice**: Prompts with interactive buttons for conversion preference
3. **Processing**: Uses `mp3tom4b.sh` script for high-quality conversion
4. **Metadata**: Preserves and enhances metadata (title, author, chapters)
5. **Upload**: Uploads both original MP3s and converted M4B file

### Conversion Features
- **Chapter Support**: Maintains chapter markers and metadata
- **Quality Preservation**: Lossless conversion process
- **Progress Tracking**: Shows conversion progress and estimated time
- **Error Handling**: Graceful fallback if conversion fails

## 📚 Ebook Format Conversion

### Automatic Detection
The bot automatically detects ebooks that could benefit from conversion:
- **PDF files** → Converts to both EPUB and MOBI
- **EPUB only** → Generates MOBI version
- **MOBI only** → Generates EPUB version

### Conversion Process
1. **Detection**: Scans for convertible ebook formats in completed torrents
2. **User Choice**: Prompts with interactive buttons for conversion preference
3. **Processing**: Uses Calibre's `ebook-convert` for high-quality conversion
4. **Metadata**: Preserves and enhances metadata (title, author, cover)
5. **Upload**: Uploads both EPUB and MOBI versions to Google Drive

### Conversion Features
- **Format Support**: PDF, EPUB, and MOBI input formats
- **Dual Output**: Always creates both EPUB + MOBI for maximum compatibility
- **Metadata Preservation**: Maintains title, author, and cover information
- **Quality Conversion**: Uses Calibre's industry-standard conversion engine
- **Auto-timeout**: Defaults to conversion after 60 seconds if no response

### Installation
```bash
# Fedora
sudo dnf install calibre

# Ubuntu/Debian
sudo apt install calibre
```

## 📧 Send to Kindle

### Automatic Email Delivery
The bot can automatically send ebooks directly to your Kindle device via email:

### How It Works
1. **Download**: Ebook downloads from MyAnonaMouse to Deluge
2. **Format Check**: Bot checks for EPUB files (Kindle-compatible)
3. **Auto-Convert**: Converts PDF/MOBI to EPUB if needed using Calibre
4. **Email Delivery**: Sends via Gmail API to your Kindle email address
5. **Confirmation**: Bot notifies you when email is sent successfully

### Setup Requirements
1. **Google Workspace**: Gmail API with domain-wide delegation configured
2. **Service Account**: Same account used for Google Drive (`discord-service-account.json`)
3. **Bot User**: Dedicated bot account (e.g., `bot@yourdomain.com`)
4. **Amazon Approval**: Add bot email to Kindle's approved sender list

### Amazon Kindle Configuration
1. Go to https://www.amazon.com/sendtokindle
2. Navigate to **Personal Document Settings**
3. Under **Approved Personal Document E-mail List**, add: `bot@yourdomain.com`
4. Click **Add Address**

### Usage Flow

**Without Kindle Email (Default):**
```
/getebook query:"book title"
→ Downloads → Auto-uploads to Google Drive
```

**With Kindle Email:**
```
/getebook query:"book title" kindle_email:yourname@kindle.com
→ Downloads → Auto-sends to Kindle → Offers Google Drive upload
```

### Features
- **Automatic Conversion**: PDF/MOBI → EPUB for best Kindle compatibility
- **Size Validation**: Checks Amazon's 50MB limit before sending
- **Progress Updates**: Real-time notifications during conversion and sending
- **Dual Delivery**: Option to send to Kindle AND upload to Google Drive
- **Format Support**: EPUB (direct), PDF (converts), MOBI (converts)

### Gmail API Setup
The bot uses OAuth2 with domain-wide delegation (not app passwords):

1. **Enable Gmail API** in Google Cloud Console
2. **Configure Domain-Wide Delegation** in Google Workspace Admin:
   - Client ID: `YOUR_SERVICE_ACCOUNT_CLIENT_ID` (from service account JSON)
   - OAuth Scope: `https://www.googleapis.com/auth/gmail.send`
3. **Set Environment Variable**: `KINDLE_BOT_EMAIL=bot@yourdomain.com
TORRENT_BASE_URL=https://www.myanonamouse.net`

## 🛠️ API Endpoints

### Health Check
- `GET /api/health` - Service status

### MAM Integration
- `POST /api/mam/search` - Search torrents with filtering
- `POST /api/mam/download` - Download and add to Deluge
- `POST /api/mam/freeleech` - Set torrent as freeleech
- `POST /api/mam/check-duplicate` - Check for existing torrents

### Upload Management
- `POST /api/uploads/torrent` - Upload torrent to Google Drive (uses the same unified upload system as Discord commands)
- `GET /api/uploads/status` - Check upload status

## 🧪 Testing

### Available Tests

```bash
# Build project
npm run build

# Test individual components
node test-mam-connection.js        # MAM API connectivity
node test-deluge-connection.js     # Deluge connectivity
node test-mam-deluge-download.js   # Complete workflow

# Run Jest test suite
npm test
```

### Test Coverage
- MAM API authentication and search
- Deluge torrent management
- End-to-end download workflow
- Google Drive upload functionality
- Discord bot command handling

## 📊 System Status

### ✅ Fully Working Features

**Core Integration:**
- MAM authentication and comprehensive search
- Deluge torrent management with duplicate detection
- Google Drive uploads with service account authentication
- Discord bot with slash commands and button interactions

**Advanced Features:**
- Automatic VIP→freeleech conversion
- Content type detection and smart organization
- MP3→M4B conversion with metadata preservation
- Long-running operation support (handles 30+ minute conversions)
- Webhook token expiration handling
- Interactive button interfaces with proper cleanup

**User Experience:**
- Rich Discord embeds with detailed torrent information
- Clickable Google Drive folder links
- Progress indicators and status updates
- Error handling with user-friendly messages
- Timeout handling for user selections

### 🔧 System Requirements

**Service Dependencies:**
- Google Workspace with service account:
  - Google Drive API with shared drive access
  - Gmail API with domain-wide delegation
  - Bot user account for sending emails
- MyAnonaMouse account with sufficient wedges for freeleech
- Deluge daemon with Web UI enabled
- Discord bot with appropriate server permissions
- Amazon Kindle with bot email on approved sender list

**File System:**
- Torrent download path: `/mnt/nas/nzb/completed/torrent`
- Temporary processing space for conversions
- Service account JSON: `samplefiles/discord-service-account.json` (copy from `discord-service-account.example.json`)

## 🎯 Usage Examples

### Basic Audiobook Search
```
/getaudiobook query:Harry Potter
```

### Advanced Filtering
```
/getaudiobook query:Stephen King format:mp3 freeleech:true limit:15
```

### Manual Upload with Conversion
```
/gdrive-upload query:"exact torrent name"
```

### Quick Upload from List
1. Run `/gdrive-status` to see completed downloads
2. Type `ua2` to upload the 2nd torrent with MP3→M4B conversion

## 🚀 Advanced Configuration

### Google Drive Setup
1. Create Google Cloud project
2. Enable Google Drive API
3. Create service account
4. Generate JSON credentials
5. Share target drive with service account email
6. Place JSON file in `samplefiles/` directory

### Gmail API Setup (Send to Kindle)
1. **Enable Gmail API** in Google Cloud Console (same project as Drive)
2. **Create Bot User** in Google Workspace Admin:
   - Go to Users → Add new user
   - Create account (e.g., `bot@yourdomain.com`)
3. **Configure Domain-Wide Delegation** in Admin Console:
   - Security → API Controls → Domain-wide Delegation
   - Add service account Client ID: `YOUR_SERVICE_ACCOUNT_CLIENT_ID`
   - OAuth Scope: `https://www.googleapis.com/auth/gmail.send`
   - Click Authorize
4. **Configure Amazon Kindle**:
   - Go to https://www.amazon.com/sendtokindle
   - Add `bot@yourdomain.com` to approved senders
5. **Set Environment Variable**: `KINDLE_BOT_EMAIL=bot@yourdomain.com
TORRENT_BASE_URL=https://www.myanonamouse.net`

### Deluge Configuration
Ensure Deluge Web UI is accessible and configured with:
- Proper download directories
- Web UI password set
- Network accessibility from bot server

### Discord Bot Setup
1. Create Discord application
2. Generate bot token
3. Add bot to server with required permissions:
   - Send Messages
   - Use Slash Commands
   - Embed Links
   - Add Reactions

## 🔍 Troubleshooting

### Common Issues

**Discord Commands Not Appearing:**
- Verify `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and `DISCORD_GUILD_ID`
- Check bot permissions in Discord server
- Look for "Successfully reloaded application (/) commands" in logs

**MAM Authentication Fails:**
- Verify `MAM_ID` cookie is current and valid
- Check for cookie expiration
- Ensure MAM account has API access

**Deluge Connection Issues:**
- Verify `DELUGE_URL` and `DELUGE_PASSWORD`
- Check Deluge Web UI accessibility
- Ensure Deluge daemon is running

**Google Drive Upload Fails:**
- Verify service account JSON file exists and is valid
- Check shared drive permissions
- Ensure sufficient storage space

**MP3 Conversion Fails:**
- Verify `mp3tom4b.sh` script exists and is executable
- Check FFmpeg installation (`ffmpeg --version`)
- Ensure sufficient disk space for conversion

**Ebook Conversion Fails:**
- Verify Calibre is installed (`ebook-convert --version`)
- Installation: `dnf install calibre` (Fedora) or `apt install calibre` (Ubuntu)
- Check `ebookconvert.sh` script exists and is executable
- Ensure sufficient disk space for conversion

**Send to Kindle Fails:**
- Verify `KINDLE_BOT_EMAIL` is set in `.env.local`
- Check Gmail API is enabled in Google Cloud Console
- Verify domain-wide delegation is configured with correct Client ID (`YOUR_SERVICE_ACCOUNT_CLIENT_ID`)
- Ensure OAuth scope `https://www.googleapis.com/auth/gmail.send` is added
- Check bot email (`bot@yourdomain.com`) is on Amazon Kindle's approved list
- Verify file size is under 50MB (Amazon's limit)
- Common error: "unauthorized_client" means domain-wide delegation not configured correctly

### Debug Commands

```bash
# Check service status
curl http://localhost:3000/api/health

# Test MAM connection
node test-mam-connection.js

# Test complete workflow
node test-mam-deluge-download.js

# Monitor logs
npm run dev  # Watch for detailed logging
```

## 📈 Performance Metrics

### Target Performance
- **Search Response**: < 5 seconds
- **Download Initiation**: < 10 seconds  
- **Upload Success Rate**: > 95%
- **Conversion Success Rate**: > 90%
- **User Command Response**: < 30 seconds

### Monitoring
- Automatic retry logic for failed operations
- Comprehensive error logging
- User notification for all status changes
- Graceful handling of network timeouts

## 🔮 Future Enhancements

### Planned Features
- **Folder Management**: Commands to list and delete Google Drive folders
- **Batch Operations**: Upload multiple torrents simultaneously
- **Advanced Organization**: Series-based folder organization
- **Storage Management**: Automatic cleanup and archiving
- **Multiple Cloud Providers**: Support for Dropbox, OneDrive
- **Plex Integration**: Auto-refresh library after uploads

### Enhancement Priorities
1. **High**: Google Drive folder management commands
2. **Medium**: Batch upload operations and advanced organization
3. **Low**: Additional cloud providers and external integrations

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with proper testing
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Add tests for new functionality
- Update documentation for user-facing changes
- Test with real MAM/Deluge/Google Drive connections
- Ensure Discord bot commands work properly

## 📞 Support

For issues, questions, or feature requests:
- **GitHub Issues**: Use the issue tracker for bug reports and feature requests
- **Documentation**: Check this README and inline code comments
- **Testing**: Use provided test scripts to verify functionality

## 🙏 Acknowledgments

- MyAnonaMouse community for the excellent private tracker
- Deluge team for the robust torrent client
- Discord.js community for the excellent library
- Google Drive API for reliable cloud storage
- FFmpeg team for audio conversion capabilities

---

**Note**: This bot is designed for use with legal content and private tracker compliance. Users are responsible for following all applicable laws and tracker rules.
