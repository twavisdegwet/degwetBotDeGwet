# Discord Media Bot

A comprehensive Discord bot that integrates with MyAnonaMouse (MAM), Deluge, and Google Drive for automated audiobook/ebook downloading, processing, and cloud storage. Features AI-powered expert consultation and Send to Kindle email delivery.

## 🚀 Quick Start

```bash
# Clone and install
git clone <repository-url>
cd discordBot
npm install

# Copy and configure environment
cp .env.example .env.local
# Edit .env.local with your credentials (see SETUP.md)

# Run in development mode
npm run dev
```

For detailed setup instructions, see **[SETUP.md](SETUP.md)**.

## ⚠️ Critical Requirements

> **Deluge is REQUIRED** - This bot relies on Deluge torrent client for all downloads. It must be running and accessible before starting the bot. See [Deluge Setup in SETUP.md](#deluge-bit-torrent-client) for configuration details.

### Required Services

| Service | Status | Notes |
|---------|--------|-------|
| Deluge | **Required** | Torrent client with Web UI enabled |
| Discord Bot | Required | Create at Discord Developer Portal |
| MyAnonaMouse | Required | Private tracker account |
| Google Drive | Required | Service account with shared drive access |
| FFmpeg | Required | For MP3→M4B audiobook conversion |
| Calibre | Required | For ebook format conversion |

## ✨ Key Features

- **Search & Download**: Search MyAnonaMouse and download torrents via Deluge
- **Cloud Upload**: Automatic Google Drive uploads with intelligent organization
- **Send to Kindle**: Email ebooks directly to your Kindle device
- **Format Conversion**: MP3→M4B audiobook conversion, ebook format conversion (PDF/MOBI↔EPUB)
- **AI Consultation**: Chat with expert personalities for advice on any topic
- **Duplicate Detection**: Smart handling of existing torrents with manual upload options

## 📱 Discord Commands

| Command | Description |
|---------|-------------|
| `/getaudiobook` | Search and download audiobooks from MAM |
| `/getebook` | Search and download ebooks (with optional Kindle delivery) |
| `/gdrive-upload` | Manually upload completed torrents to Google Drive |
| `/gdrive-status` | Check upload status and list completed downloads |
| `/askexpert` | Consult with AI experts for advice |
| `/help` | Display help information |

### Example Usage

```
/getaudiobook query:"Casino Royale" author:"Ian Fleming" format:mp3
/getebook query:"Foundation" kindle_email:yourname@kindle.com
/askexpert question:"What's the best audiobook player for iOS?"
```

## 📚 Documentation

- **[SETUP.md](SETUP.md)** - Complete installation and configuration guide
- **[LICENSE](LICENSE)** - GPLv3 license terms

## 🔌 Service Dependencies

- **Discord Bot** - Create at https://discord.com/developers/applications
- **MyAnonaMouse** - Private tracker account at https://www.myanonamouse.net
- **Deluge** - BitTorrent client with Web UI enabled
- **Google Drive** - Google Cloud service account with Drive API
- **Gmail API** - For Send to Kindle email delivery (same Google Cloud project)
- **Ollama** (optional) - Local AI server for expert consultation

See **[SETUP.md](SETUP.md)** for detailed setup instructions for each service.

## 🛠️ Development

```bash
# Build TypeScript
npm run build

# Run in production
npm start

# Run tests
npm test

# Code quality
npm run lint
npm run format
```

## 📋 Requirements

- Node.js 18+
- FFmpeg (for audiobook conversion)
- Calibre (for ebook conversion)
- Linux/Unix environment

---

## 🎭 Admin Features (Hidden)

These features are not shown in the public help but are available to deployed administrators:

### Hidden Commands

| Command | Description |
|---------|-------------|
| `/makefunnyjoke lasagna` | Search and download movies from MAM |
| `/makefunnyjoke kickodie` | Search and download music from MAM |

> **Note:** These are intentionally hidden from regular users - the bot pretends these commands don't exist. Use them directly to access full search/download for movies and music.

---

## 🤖 AI Personalities

The bot includes 6 configurable expert personalities for the `/askexpert`, `/askbible`, and `/makebadjoke` commands:

| Personality | Description |
|-------------|-------------|
| `trump` | Brash, confident, name-drops achievements |
| `clyde` | Former Discord AI, overly enthusiastic |
| `cuddy` | Grumpy former member, complains while helping |
| `emperor` | Warhammer 40K Emperor, divine gravitas |
| `foghorn` | Foghorn Leghorn, bombastic Southern rooster |
| `bonzo` | Direct, concise, no-nonsense assistant |

### Customizing Personalities

**Location:** `src/bot/personalities.ts`

Each personality is defined in the `buildPersonalityPrompt()` function with:
- Core traits and characteristics
- Speech patterns and catchphrases
- Answer style guidelines

**LLM Compatibility:**

Tested and working well with:
- **GLM** series models
- **Minimax M2.5**

Not recommended:
- **Qwen** - Tends to break character and refuses roleplay; the personalities don't stick

To add a new personality:
1. Add it to the `personalities` array in `src/bot/personalities.ts:1`
2. Add a case in `buildPersonalityPrompt()` defining the character
3. Add emoji/name mapping in `getPersonalityFormatting()`
4. Test thoroughly - some models refuse to stay in character!

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **Issues**: Report bugs and request features on GitHub
- **Documentation**: Check [SETUP.md](SETUP.md) for detailed guides
- **Testing**: Use test scripts to verify functionality

## 📄 License

This project is licensed under the GNU General Public License v3.0 (GPLv3) - see the [LICENSE](LICENSE) file for details.

---

**Note**: This bot is designed for use with legal content. Users are responsible for following all applicable laws and tracker rules.