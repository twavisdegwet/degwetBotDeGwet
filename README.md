# Discord Media Bot

A comprehensive Discord bot that integrates with MyAnonaMouse (MAM) private tracker, Deluge torrent client, and Google Drive for automated audiobook/ebook downloading, processing, and cloud storage.

## 🚀 Features

### Core Functionality
- 🔍 **Smart Search**: Search MyAnonaMouse for audiobooks and ebooks with advanced filtering
- 📥 **Automatic Downloads**: Seamless torrent downloading to Deluge with duplicate detection
- ☁️ **Google Drive Integration**: Automatic upload to Google Drive with intelligent folder organization
- 🎵 **MP3→M4B Conversion**: Automatic audiobook format conversion for better compatibility
- 💎 **VIP/Freeleech Management**: Automatic freeleech setting for VIP torrents
- 🔄 **Duplicate Handling**: Smart duplicate detection with upload options for completed torrents
- 🤖 **Discord Bot**: Intuitive slash commands with interactive button interfaces

### Advanced Features
- 📂 **Content Analysis**: Automatic detection of audiobooks, ebooks, and mixed media
- 🏷️ **Smart Organization**: Folder naming with content type prefixes (`[Audiobook]`, `[E-book]`, `[Mixed Media]`)
- ⏱️ **Long Operation Support**: Handles long-running operations (30+ minutes) with proper user notifications
- 🔗 **Direct Links**: Clickable Google Drive folder links in success messages
- 📊 **Detailed Status**: Comprehensive upload status with file counts and sizes

## 🎯 Quick Start

### Prerequisites

- Node.js 18+
- MyAnonaMouse account with API access
- Deluge torrent client with Web UI enabled
- Google Drive API service account (for cloud uploads)
- Discord bot token and server permissions

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
MAM_BASE_URL=https://www.myanonamouse.net

# Deluge Configuration
DELUGE_URL=http://192.168.2.124:8112/json
DELUGE_PASSWORD=your_deluge_password

# Google Drive (place service account JSON in samplefiles/)
GOOGLE_DRIVE_SHARED_DRIVE_ID=your_shared_drive_id
```

### Setup Files

Place these files in the `samplefiles/` directory:
- `discord-468217-313c7eccba67.json` - Google Drive service account credentials
- `mp3tom4b.sh` - MP3 to M4B conversion script

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
Search and download ebooks from MyAnonaMouse.

**Parameters:** Same as `/getaudiobook` but for ebook categories

#### `/gdrive-upload`
Manually upload completed torrents to Google Drive.

**Parameters:**
- `torrent_id` (required) - Deluge torrent ID
- `convert_mp3` (optional) - Convert MP3 files to M4B format

#### `/gdrive-status`
Check Google Drive upload status and storage information.

#### `/askexpert`
Consult with one of our expert consultants for advice on any topic.

**Parameters:**
- `question` (required) - The question you want to ask our expert
- `expert` (optional) - Choose which expert to consult (default: random expert)
  - Available experts: Trump, Clyde, Cuddy, Waifu
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
   - Prompts for MP3→M4B conversion if applicable
   - Uploads to Google Drive with proper organization
   - Provides clickable folder links

### Duplicate Handling
When a torrent already exists in Deluge:
- **If completed**: Offers immediate Google Drive upload with interactive buttons
- **If downloading**: Informs user to wait and provides manual upload option
- **Smart detection**: Extracts torrent hash from error messages for precise matching

### Content Organization
Files are automatically organized in Google Drive:
- `[Audiobook] Author - Title` - For audio content
- `[E-book] Author - Title` - For text content  
- `[Mixed Media] Author - Title` - For combined content

## 🎵 MP3 to M4B Conversion

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

## 🛠️ API Endpoints

### Health Check
- `GET /api/health` - Service status

### MAM Integration
- `POST /api/mam/search` - Search torrents with filtering
- `POST /api/mam/download` - Download and add to Deluge
- `POST /api/mam/freeleech` - Set torrent as freeleech
- `POST /api/mam/check-duplicate` - Check for existing torrents

### Upload Management
- `POST /api/uploads/torrent` - Upload torrent to Google Drive
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
- Google Drive service account with shared drive access
- MyAnonaMouse account with sufficient wedges for freeleech
- Deluge daemon with Web UI enabled
- Discord bot with appropriate server permissions

**File System:**
- Torrent download path: `/mnt/nas/nzb/completed/torrent`
- Temporary processing space for conversions
- Service account JSON: `samplefiles/discord-468217-313c7eccba67.json`

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
/gdrive-upload torrent_id:abc123def456 convert_mp3:true
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
- Check ffmpeg installation
- Ensure sufficient disk space for conversion

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
