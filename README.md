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