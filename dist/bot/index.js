"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = void 0;
const discord_js_1 = require("discord.js");
const env_1 = require("../config/env");
const axios_1 = __importDefault(require("axios"));
const downloadManagement_1 = require("../api/clients/downloadManagement");
const delugeClient_1 = require("../api/clients/delugeClient");
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent
    ]
});
exports.client = client;
const commands = [
    new discord_js_1.SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows available commands and how to use the book download bot'),
    new discord_js_1.SlashCommandBuilder()
        .setName('getaudiobook')
        .setDescription('🎧 Search for audiobooks and download them automatically')
        .addStringOption(option => option.setName('query')
        .setDescription('Audiobook title, author, or keyword')
        .setRequired(true))
        .addStringOption(option => option.setName('author')
        .setDescription('Filter by author (optional)'))
        .addStringOption(option => option.setName('format')
        .setDescription('Filter by audio format (optional)')
        .addChoices({ name: 'MP3', value: 'mp3' }, { name: 'FLAC', value: 'flac' }, { name: 'M4A', value: 'm4a' }, { name: 'M4B', value: 'm4b' }))
        .addBooleanOption(option => option.setName('freeleech')
        .setDescription('Only show freeleech torrents (optional)'))
        .addIntegerOption(option => option.setName('limit')
        .setDescription('Number of results (5-25)')
        .setMinValue(5)
        .setMaxValue(25)),
    new discord_js_1.SlashCommandBuilder()
        .setName('getebook')
        .setDescription('📖 Search for e-books and download them automatically')
        .addStringOption(option => option.setName('query')
        .setDescription('E-book title, author, or keyword')
        .setRequired(true))
        .addStringOption(option => option.setName('author')
        .setDescription('Filter by author (optional)'))
        .addStringOption(option => option.setName('format')
        .setDescription('Filter by e-book format (optional)')
        .addChoices({ name: 'EPUB', value: 'epub' }, { name: 'MOBI', value: 'mobi' }, { name: 'AZW3', value: 'azw3' }, { name: 'PDF', value: 'pdf' }, { name: 'TXT', value: 'txt' }))
        .addBooleanOption(option => option.setName('freeleech')
        .setDescription('Only show freeleech torrents (optional)'))
        .addIntegerOption(option => option.setName('limit')
        .setDescription('Number of results (5-25)')
        .setMinValue(5)
        .setMaxValue(25)),
    new discord_js_1.SlashCommandBuilder()
        .setName('listdownloads')
        .setDescription('📂 List downloaded files')
        .addStringOption(option => option.setName('query')
        .setDescription('Search term to filter files (optional)')
        .setRequired(false))
        .addIntegerOption(option => option.setName('limit')
        .setDescription('Maximum number of files to show (1-50)')
        .setMinValue(1)
        .setMaxValue(50)
        .setRequired(false)),
    new discord_js_1.SlashCommandBuilder()
        .setName('gdrive-status')
        .setDescription('☁️ Check Google Drive authentication status'),
    new discord_js_1.SlashCommandBuilder()
        .setName('gdrive-upload')
        .setDescription('☁️ Upload a completed torrent to Google Drive')
        .addStringOption(option => option.setName('query')
        .setDescription('Search term to find the torrent to upload')
        .setRequired(true))
        .addBooleanOption(option => option.setName('convert_mp3')
        .setDescription('Convert MP3 files to M4B audiobook format')
        .setRequired(false)),
];
const rest = new discord_js_1.REST({ version: '10' }).setToken(env_1.env.DISCORD_TOKEN);
async function registerCommands() {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(discord_js_1.Routes.applicationCommands(env_1.env.DISCORD_CLIENT_ID), { body: commands });
        console.log('Successfully reloaded application (/) commands globally.');
    }
    catch (error) {
        console.error('Error registering commands:', error);
    }
}
client.once('ready', () => {
    console.log(`Ready! Logged in as ${client.user?.tag}`);
    registerCommands();
});
async function handleBookSearch(interaction, bookType) {
    await interaction.deferReply();
    const query = interaction.options.getString('query', true);
    const author = interaction.options.getString('author');
    const format = interaction.options.getString('format');
    const freeleech = interaction.options.getBoolean('freeleech') || false;
    const limit = interaction.options.getInteger('limit') || 10;
    const searchParams = {
        text: query,
        perpage: limit,
        srchIn: ['title', 'author'],
        searchType: 'all'
    };
    if (author) {
        searchParams.srchIn = ['author'];
    }
    if (bookType === 'audiobook') {
        searchParams.cat = [
            '39', '49', '50', '83', '51', '97', '40', '41', '106', '42', '52', '98',
            '54', '55', '43', '99', '84', '44', '56', '45', '57', '85', '87', '119',
            '88', '58', '59', '46', '47', '53', '89', '100', '108', '48', '111'
        ];
    }
    else {
        searchParams.cat = [
            '60', '71', '72', '90', '61', '73', '101', '62', '63', '107', '64', '74',
            '102', '76', '77', '65', '103', '115', '91', '66', '78', '67', '79', '80',
            '92', '118', '94', '120', '95', '81', '82', '68', '69', '75', '96', '104',
            '109', '70', '112'
        ];
    }
    if (format) {
        searchParams.filetype = format;
    }
    if (freeleech) {
        searchParams.searchType = 'fl';
    }
    const response = await axios_1.default.post('http://localhost:3000/api/mam/search', searchParams);
    const results = response.data.results;
    if (results.length === 0) {
        await interaction.editReply(`No ${bookType === 'audiobook' ? 'audiobooks' : 'e-books'} found matching your criteria.`);
        return;
    }
    const bookTypeName = bookType === 'audiobook' ? 'Audiobook' : 'E-Book';
    let message = `**${bookTypeName} Search Results for "${query}":**\n\n`;
    message += `Please select a book by typing its number:\n\n`;
    const filters = [];
    if (author)
        filters.push(`Author: ${author}`);
    if (format)
        filters.push(`Format: ${format.toUpperCase()}`);
    if (freeleech)
        filters.push('Freeleech only');
    if (filters.length > 0) {
        message += `*Filters: ${filters.join(', ')}*\n\n`;
    }
    results.slice(0, 5).forEach((torrent, index) => {
        message += `**${index + 1}.** ${torrent.title}\n`;
        if (torrent.author) {
            message += `   ✍️ ${torrent.author}\n`;
        }
        if (torrent.narrator && bookType === 'audiobook') {
            message += `   🎙️ ${torrent.narrator}\n`;
        }
        if (torrent.series) {
            message += `   📚 ${torrent.series}\n`;
        }
        message += `   📁 ${torrent.catname} | 💾 ${torrent.size} | 🌱 ${torrent.seeders} seeders\n`;
        message += `   🆔 ID: ${torrent.id} | Free: ${torrent.isFree ? '✅' : '❌'} | VIP: ${torrent.isVip ? '✅' : '❌'}\n`;
        if (torrent.filetype) {
            message += `   📄 Format: ${torrent.filetype.toUpperCase()}\n`;
        }
        message += `\n`;
    });
    if (results.length > 5) {
        message += `... and ${results.length - 5} more results`;
    }
    const { Collection } = require('@discordjs/collection');
    if (!interaction.client.bookSearchResults) {
        interaction.client.bookSearchResults = new Collection();
    }
    interaction.client.bookSearchResults.set(interaction.user.id, {
        results: results.slice(0, 5),
        query,
        timestamp: Date.now()
    });
    await interaction.editReply(message);
    const filter = (m) => m.author.id === interaction.user.id && /^\d+$/.test(m.content) && parseInt(m.content) <= results.length && parseInt(m.content) > 0;
    const collector = interaction.channel.createMessageCollector({
        filter,
        time: 60000,
        max: 1
    });
    collector.on('collect', async (m) => {
        const selection = parseInt(m.content) - 1;
        const selectedTorrent = results[selection];
        await m.reply(`You selected: **${selectedTorrent.title}**`);
        if (selectedTorrent.isVip && !selectedTorrent.isFree) {
            try {
                await axios_1.default.post('http://localhost:3000/api/mam/freeleech', {
                    id: selectedTorrent.id,
                    wedges: 1
                });
                await m.reply(`✅ Successfully set torrent ${selectedTorrent.id} as freeleech!`);
            }
            catch (error) {
                await m.reply(`❌ Failed to set freeleech: ${error.response?.data?.error || error.message}`);
            }
        }
        try {
            const duplicateCheck = await axios_1.default.post('http://localhost:3000/api/mam/check-duplicate', {
                torrentId: selectedTorrent.id
            });
            if (duplicateCheck.data.isDuplicate) {
                await m.reply(`⚠️ This torrent already exists in Deluge:\n**${duplicateCheck.data.existingTorrent.name}**\nState: ${duplicateCheck.data.existingTorrent.state}\nProgress: ${duplicateCheck.data.existingTorrent.progress}%`);
                return;
            }
        }
        catch (error) {
            console.log('Duplicate check failed:', error);
        }
        try {
            const downloadResponse = await axios_1.default.post('http://localhost:3000/api/mam/download', {
                id: selectedTorrent.id.toString()
            });
            if (downloadResponse.data.isDuplicate) {
                await m.reply(`⚠️ This torrent already exists in Deluge:\n**${downloadResponse.data.torrentInfo.name}**\nState: ${downloadResponse.data.torrentInfo.state}\nProgress: ${downloadResponse.data.torrentInfo.progress}%`);
            }
            else {
                await m.reply(`✅ Successfully added torrent to Deluge!\nID: ${downloadResponse.data.torrentId}\nName: ${downloadResponse.data.torrentInfo?.name || selectedTorrent.title}`);
                await m.reply(`🔄 Will automatically upload to Google Drive once download completes...`);
                setTimeout(async () => {
                    await monitorAndAutoUpload(m, downloadResponse.data.torrentId, selectedTorrent.title, bookType === 'audiobook');
                }, 5000);
            }
        }
        catch (error) {
            await m.reply(`❌ Failed to download: ${error.response?.data?.error || error.message}`);
        }
    });
    collector.on('end', async (_collected, reason) => {
        if (reason === 'time') {
            if (interaction.client.bookSearchResults) {
                interaction.client.bookSearchResults.delete(interaction.user.id);
            }
            const channel = interaction.channel;
            if (channel) {
                await channel.send(`⏰ ${bookType === 'audiobook' ? 'Audiobook' : 'E-book'} selection timed out for "${query}". Please try the command again.`);
            }
        }
    });
}
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand())
        return;
    const { commandName } = interaction;
    try {
        if (commandName === 'help') {
            await interaction.reply({
                embeds: [{
                        title: '📚 Book Download Bot Features',
                        description: 'MyAnonaMouse book download bot with Google Drive integration',
                        fields: [
                            {
                                name: '🎧 Audiobook Search & Download',
                                value: 'Search for audiobooks with VIP/freeleech handling\n• Multiple audio formats: MP3, FLAC, M4A, M4B\n• Automatic duplicate detection\n• Freeleech for VIP torrents\n• Author and format filtering',
                                inline: false
                            },
                            {
                                name: '📖 E-Book Search & Download',
                                value: 'Search for e-books with VIP/freeleech handling\n• Multiple e-book formats: EPUB, MOBI, AZW3, PDF, TXT\n• Automatic duplicate detection\n• Freeleech for VIP torrents\n• Author and format filtering',
                                inline: false
                            },
                            {
                                name: '📂 Download Management',
                                value: 'List and manage completed torrents\n• Content type detection (audiobook 🎵, e-book 📖, mixed 📚)\n• File count and size analysis\n• Direct upload to Google Drive\n• MP3→M4B conversion for audiobooks',
                                inline: false
                            },
                            {
                                name: '☁️ Google Drive Integration',
                                value: 'Automatic and manual uploads to Google Drive\n• Automatic upload when downloads complete\n• Manual upload with `/gdrive-upload`\n• Content analysis and folder organization\n• Clickable folder links in success messages',
                                inline: false
                            },
                            {
                                name: '🔄 MP3 to M4B Conversion',
                                value: 'Automatic conversion for audiobook files\n• Triggered automatically for all audiobooks\n• Manual conversion with `convert_mp3` flag\n• From `/listdownloads` use `ua[number]` command\n• Creates M4B with proper metadata',
                                inline: false
                            }
                        ],
                        color: 0x00AE86,
                        footer: {
                            text: 'Made for MyAnonaMouse book lovers 📖'
                        }
                    }]
            });
        }
        else if (commandName === 'getaudiobook') {
            await handleBookSearch(interaction, 'audiobook');
        }
        else if (commandName === 'getebook') {
            await handleBookSearch(interaction, 'ebook');
        }
        else if (commandName === 'listdownloads') {
            await handleListDownloads(interaction);
        }
        else if (commandName === 'gdrive-status') {
            await handleGDriveStatus(interaction);
        }
        else if (commandName === 'gdrive-upload') {
            await handleGDriveUpload(interaction);
        }
    }
    catch (error) {
        console.error('Error handling command:', error);
        const errorMessage = 'There was an error while executing this command!';
        if (interaction.deferred) {
            await interaction.editReply(errorMessage);
        }
        else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    }
});
const delugeClient = new delugeClient_1.DelugeClient(env_1.env.DELUGE_URL, env_1.env.DELUGE_PASSWORD);
async function handleListDownloads(interaction) {
    await interaction.deferReply();
    const query = interaction.options.getString('query') || '';
    const limit = interaction.options.getInteger('limit') || 20;
    try {
        const downloadManager = new downloadManagement_1.DownloadManager(delugeClient);
        let torrents;
        if (query) {
            torrents = await downloadManager.searchTorrents(query);
        }
        else {
            torrents = await downloadManager.listCompletedTorrents();
        }
        torrents = torrents.slice(0, limit);
        if (torrents.length === 0) {
            await interaction.editReply('No completed torrents found matching your search.');
            return;
        }
        let message = `**Completed Torrents${query ? ` matching "${query}"` : ''}:**\n\n`;
        const torrentAnalysis = [];
        for (let i = 0; i < torrents.length; i++) {
            const torrent = torrents[i];
            try {
                const files = await downloadManager.getTorrentFiles(torrent.id);
                const analysis = analyzeContentType(files);
                torrentAnalysis.push({ torrent, analysis });
                message += `**${i + 1}.** ${analysis.emoji} ${analysis.label} ${torrent.name}\n`;
                const contentParts = [];
                if (analysis.audioFiles.length > 0) {
                    contentParts.push(`${analysis.audioFiles.length} audio`);
                }
                if (analysis.ebookFiles.length > 0) {
                    contentParts.push(`${analysis.ebookFiles.length} ebook`);
                }
                if (analysis.otherFiles.length > 0) {
                    contentParts.push(`${analysis.otherFiles.length} other`);
                }
                if (contentParts.length > 0) {
                    message += `   📊 ${contentParts.join(', ')} files | 💾 ${formatFileSize(analysis.totalSize)}\n`;
                }
                message += `\n`;
            }
            catch (error) {
                console.error(`Error analyzing torrent ${torrent.id}:`, error);
                torrentAnalysis.push({
                    torrent,
                    analysis: {
                        type: 'unknown',
                        audioFiles: [],
                        ebookFiles: [],
                        otherFiles: [],
                        totalSize: 0,
                        emoji: '📁',
                        label: ''
                    }
                });
                message += `**${i + 1}.** 📁 ${torrent.name}\n   ⚠️ Could not analyze files\n\n`;
            }
        }
        if (torrents.length >= limit) {
            message += `*Showing ${limit} of ${torrents.length} torrents. Use the limit option to see more.*\n\n`;
        }
        const { Collection } = require('@discordjs/collection');
        if (!interaction.client.torrentList) {
            interaction.client.torrentList = new Collection();
        }
        interaction.client.torrentList.set(interaction.user.id, {
            torrents: torrentAnalysis,
            timestamp: Date.now()
        });
        message += `**Options:**\n`;
        message += `• Reply with a number to see detailed files\n`;
        message += `• Reply with "u[number]" to upload to Google Drive (e.g., "u1" for first torrent)\n`;
        message += `• Reply with "ua[number]" to upload audiobook with MP3→M4B conversion`;
        await interaction.editReply(message);
        const filter = (m) => {
            if (m.author.id !== interaction.user.id)
                return false;
            const content = m.content.toLowerCase().trim();
            if (content.match(/^ua?\d+$/)) {
                const match = content.match(/^(ua?)(\d+)$/);
                if (match) {
                    const number = parseInt(match[2]);
                    return number > 0 && number <= torrents.length;
                }
            }
            if (/^\d+$/.test(content)) {
                const number = parseInt(content);
                return number > 0 && number <= torrents.length;
            }
            return false;
        };
        const collector = interaction.channel.createMessageCollector({
            filter,
            time: 120000,
            max: 1
        });
        collector.on('collect', async (m) => {
            const content = m.content.toLowerCase().trim();
            if (content.match(/^ua?\d+$/)) {
                const match = content.match(/^(ua?)(\d+)$/);
                if (match) {
                    const isAudiobook = match[1] === 'ua';
                    const selection = parseInt(match[2]) - 1;
                    const selectedData = torrentAnalysis[selection];
                    await m.reply(`🚀 Starting upload of **${selectedData.torrent.name}** to Google Drive...${isAudiobook ? '\n🎵 MP3→M4B conversion enabled' : ''}`);
                    try {
                        const uploadResponse = await axios_1.default.post('http://localhost:3000/api/uploads/torrent', {
                            torrentId: selectedData.torrent.id,
                            convertMp3ToM4b: isAudiobook
                        });
                        if (uploadResponse.data.success) {
                            const analysis = selectedData.analysis;
                            let successMessage = `✅ Successfully uploaded ${analysis.emoji} **${selectedData.torrent.name}** to Google Drive!\n\n`;
                            successMessage += `📁 Uploaded ${uploadResponse.data.uploadedFiles.length} files`;
                            if (analysis.totalSize > 0) {
                                successMessage += ` (${formatFileSize(analysis.totalSize)})`;
                            }
                            successMessage += '\n';
                            const contentParts = [];
                            if (analysis.audioFiles.length > 0) {
                                contentParts.push(`${analysis.audioFiles.length} audio file${analysis.audioFiles.length > 1 ? 's' : ''}`);
                            }
                            if (analysis.ebookFiles.length > 0) {
                                contentParts.push(`${analysis.ebookFiles.length} e-book file${analysis.ebookFiles.length > 1 ? 's' : ''}`);
                            }
                            if (analysis.otherFiles.length > 0) {
                                contentParts.push(`${analysis.otherFiles.length} other file${analysis.otherFiles.length > 1 ? 's' : ''}`);
                            }
                            if (contentParts.length > 0) {
                                successMessage += `${analysis.emoji} Content: ${contentParts.join(', ')}\n`;
                            }
                            if (uploadResponse.data.convertedFile) {
                                successMessage += `🎵 Converted to: ${uploadResponse.data.convertedFile}\n`;
                            }
                            if (uploadResponse.data.folderId) {
                                successMessage += `📂 [View Folder](https://drive.google.com/drive/folders/${uploadResponse.data.folderId})\n`;
                                successMessage += `📂 Folder ID: ${uploadResponse.data.folderId}`;
                            }
                            await m.reply(successMessage);
                        }
                        else {
                            await m.reply(`❌ Upload failed: ${uploadResponse.data.error}\n\nPartially uploaded files: ${uploadResponse.data.uploadedFiles.length}`);
                        }
                    }
                    catch (error) {
                        console.error('Error uploading torrent:', error);
                        await m.reply(`❌ Upload failed: ${error.response?.data?.error || error.message}`);
                    }
                }
                return;
            }
            const selection = parseInt(content) - 1;
            const selectedData = torrentAnalysis[selection];
            try {
                const files = await downloadManager.getTorrentFiles(selectedData.torrent.id);
                if (files.length === 0) {
                    await m.reply(`No files found for torrent: **${selectedData.torrent.name}**`);
                    return;
                }
                const analysis = selectedData.analysis;
                let fileList = `**${analysis.emoji} Files in ${selectedData.torrent.name}:**\n\n`;
                fileList += `📊 **Content Analysis:** ${analysis.label}\n`;
                fileList += `   • ${analysis.audioFiles.length} audio files\n`;
                fileList += `   • ${analysis.ebookFiles.length} e-book files\n`;
                fileList += `   • ${analysis.otherFiles.length} other files\n`;
                fileList += `   • Total size: ${formatFileSize(analysis.totalSize)}\n\n`;
                fileList += `**Files:**\n`;
                fileList += files.slice(0, 20).map((file, index) => `${index + 1}. ${file.path} (${formatFileSize(file.size)})`).join('\n');
                if (files.length > 20) {
                    fileList += `\n\n*Showing first 20 of ${files.length} files*`;
                }
                fileList += `\n\n**Upload Options:**\n`;
                fileList += `• Reply "u${selection + 1}" to upload to Google Drive\n`;
                if (analysis.audioFiles.length > 0) {
                    fileList += `• Reply "ua${selection + 1}" to upload with MP3→M4B conversion`;
                }
                await m.reply(fileList);
            }
            catch (error) {
                console.error('Error getting torrent files:', error);
                await m.reply('An error occurred while getting files for the selected torrent.');
            }
        });
        collector.on('end', (_collected, reason) => {
            if (reason === 'time') {
                if (interaction.client.torrentList) {
                    interaction.client.torrentList.delete(interaction.user.id);
                }
            }
        });
    }
    catch (error) {
        console.error('Error listing downloads:', error);
        await interaction.editReply('An error occurred while listing downloads. Please try again later.');
    }
}
function formatFileSize(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
function analyzeContentType(files) {
    const audioExtensions = ['.mp3', '.m4a', '.m4b', '.flac', '.wav', '.aac'];
    const ebookExtensions = ['.epub', '.mobi', '.azw3', '.azw', '.pdf', '.txt', '.fb2'];
    const audioFiles = [];
    const ebookFiles = [];
    const otherFiles = [];
    let totalSize = 0;
    for (const file of files) {
        const ext = require('path').extname(file.path).toLowerCase();
        const fileName = require('path').basename(file.path);
        totalSize += file.size;
        if (audioExtensions.includes(ext)) {
            audioFiles.push(fileName);
        }
        else if (ebookExtensions.includes(ext)) {
            ebookFiles.push(fileName);
        }
        else {
            otherFiles.push(fileName);
        }
    }
    let type;
    let emoji;
    let label;
    if (audioFiles.length > 0 && ebookFiles.length > 0) {
        type = 'mixed';
        emoji = '📚';
        label = '[Mixed Media]';
    }
    else if (audioFiles.length > 0) {
        type = 'audiobook';
        emoji = '🎵';
        label = '[Audiobook]';
    }
    else if (ebookFiles.length > 0) {
        type = 'ebook';
        emoji = '📖';
        label = '[E-book]';
    }
    else {
        type = 'unknown';
        emoji = '📁';
        label = '';
    }
    return {
        type,
        audioFiles,
        ebookFiles,
        otherFiles,
        totalSize,
        emoji,
        label
    };
}
async function monitorAndAutoUpload(message, torrentId, torrentName, isAudiobook) {
    const maxAttempts = 60;
    let attempts = 0;
    const checkInterval = setInterval(async () => {
        attempts++;
        try {
            const downloadManager = new downloadManagement_1.DownloadManager(delugeClient);
            const completedTorrents = await downloadManager.listCompletedTorrents();
            const isCompleted = completedTorrents.some(t => t.id === torrentId);
            if (isCompleted) {
                clearInterval(checkInterval);
                await message.reply(`🎉 **${torrentName}** download completed! Starting upload to Google Drive...`);
                try {
                    const uploadResponse = await axios_1.default.post('http://localhost:3000/api/uploads/torrent', {
                        torrentId: torrentId,
                        convertMp3ToM4b: isAudiobook
                    });
                    if (uploadResponse.data.success) {
                        let successMessage = `✅ **${torrentName}** automatically uploaded to Google Drive!\n\n`;
                        successMessage += `📁 Uploaded ${uploadResponse.data.uploadedFiles.length} files\n`;
                        if (uploadResponse.data.convertedFile) {
                            successMessage += `🎵 Converted to: ${uploadResponse.data.convertedFile}\n`;
                        }
                        if (uploadResponse.data.folderId) {
                            successMessage += `📂 [View Folder](https://drive.google.com/drive/folders/${uploadResponse.data.folderId})\n`;
                            successMessage += `📂 Folder ID: ${uploadResponse.data.folderId}`;
                        }
                        await message.reply(successMessage);
                    }
                    else {
                        await message.reply(`❌ Auto-upload failed for **${torrentName}**: ${uploadResponse.data.error}\n\nPartially uploaded files: ${uploadResponse.data.uploadedFiles.length}`);
                    }
                }
                catch (error) {
                    console.error('Error in auto-upload:', error);
                    await message.reply(`❌ Auto-upload failed for **${torrentName}**: ${error.response?.data?.error || error.message}`);
                }
            }
            else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                await message.reply(`⏰ Auto-upload timeout for **${torrentName}**. The download may still be in progress. You can manually upload using \`/gdrive-upload\` once it completes.`);
            }
        }
        catch (error) {
            console.error('Error checking torrent completion:', error);
            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                await message.reply(`❌ Error monitoring **${torrentName}** for completion. You can manually upload using \`/gdrive-upload\` once it completes.`);
            }
        }
    }, 30000);
}
async function handleGDriveStatus(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const response = await axios_1.default.get('http://localhost:3000/api/uploads/status');
        if (response.data.success) {
            if (response.data.authenticated) {
                const user = response.data.user;
                let userDisplay = 'Unknown';
                if (user && user.displayName) {
                    userDisplay = `${user.displayName} (${user.emailAddress || 'N/A'})`;
                }
                else if (user && user.emailAddress) {
                    userDisplay = user.emailAddress;
                }
                else {
                    userDisplay = 'Service account connected';
                }
                const storage = response.data.storage;
                let storageDisplay = 'Storage information not available';
                if (storage && storage.usage && storage.limit) {
                    storageDisplay = `Used: ${formatFileSize(parseInt(storage.usage))} / ${formatFileSize(parseInt(storage.limit))}`;
                }
                await interaction.editReply({
                    embeds: [{
                            title: '☁️ Google Drive Status',
                            description: '✅ Service account connected to Google Drive',
                            fields: [
                                {
                                    name: '👤 Service Account',
                                    value: userDisplay,
                                    inline: false
                                },
                                {
                                    name: '📁 Target Folder',
                                    value: response.data.folderId,
                                    inline: false
                                },
                                {
                                    name: '💾 Storage',
                                    value: storageDisplay,
                                    inline: false
                                }
                            ],
                            color: 0x4285f4
                        }]
                });
            }
            else {
                await interaction.editReply({
                    embeds: [{
                            title: '☁️ Google Drive Status',
                            description: '❌ Service account not connected',
                            fields: [
                                {
                                    name: 'Service Account File',
                                    value: response.data.serviceAccountFileExists ? 'Configured' : 'Not configured',
                                    inline: false
                                },
                                {
                                    name: 'Issue',
                                    value: response.data.error || 'Service account authentication failed',
                                    inline: false
                                }
                            ],
                            color: 0xff0000
                        }]
                });
            }
        }
        else {
            await interaction.editReply('❌ Failed to check Google Drive status.');
        }
    }
    catch (error) {
        console.error('Error checking gdrive status:', error);
        await interaction.editReply('❌ An error occurred while checking Google Drive status.');
    }
}
async function handleGDriveUpload(interaction) {
    await interaction.deferReply();
    const query = interaction.options.getString('query', true);
    const convertMp3 = interaction.options.getBoolean('convert_mp3') || false;
    try {
        const downloadManager = new downloadManagement_1.DownloadManager(delugeClient);
        const torrents = await downloadManager.searchTorrents(query);
        if (torrents.length === 0) {
            await interaction.editReply(`No completed torrents found matching "${query}".`);
            return;
        }
        let message = `**Completed Torrents matching "${query}":**\n\n`;
        message += torrents.slice(0, 10).map((torrent, index) => `${index + 1}. ${torrent.name}`).join('\n');
        if (torrents.length > 10) {
            message += `\n\n*Showing first 10 of ${torrents.length} torrents*`;
        }
        message += `\n\nReply with a number to upload that torrent to Google Drive.`;
        if (convertMp3) {
            message += `\n🎵 MP3 to M4B conversion is enabled.`;
        }
        await interaction.editReply(message);
        const { Collection } = require('@discordjs/collection');
        if (!interaction.client.uploadTorrentList) {
            interaction.client.uploadTorrentList = new Collection();
        }
        interaction.client.uploadTorrentList.set(interaction.user.id, {
            torrents: torrents.slice(0, 10),
            convertMp3,
            timestamp: Date.now()
        });
        const filter = (m) => m.author.id === interaction.user.id &&
            /^\d+$/.test(m.content) &&
            parseInt(m.content) <= Math.min(torrents.length, 10) &&
            parseInt(m.content) > 0;
        const collector = interaction.channel.createMessageCollector({
            filter,
            time: 60000,
            max: 1
        });
        collector.on('collect', async (m) => {
            const selection = parseInt(m.content) - 1;
            const selectedTorrent = torrents[selection];
            await m.reply(`🚀 Starting upload of **${selectedTorrent.name}** to Google Drive...`);
            try {
                const uploadResponse = await axios_1.default.post('http://localhost:3000/api/uploads/torrent', {
                    torrentId: selectedTorrent.id,
                    convertMp3ToM4b: convertMp3
                });
                if (uploadResponse.data.success) {
                    let successMessage = `✅ Successfully uploaded **${selectedTorrent.name}** to Google Drive!\n\n`;
                    successMessage += `📁 Uploaded ${uploadResponse.data.uploadedFiles.length} files\n`;
                    if (uploadResponse.data.convertedFile) {
                        successMessage += `🎵 Converted to: ${uploadResponse.data.convertedFile}\n`;
                    }
                    if (uploadResponse.data.folderId) {
                        successMessage += `📂 [View Folder](https://drive.google.com/drive/folders/${uploadResponse.data.folderId})\n`;
                        successMessage += `📂 Folder ID: ${uploadResponse.data.folderId}`;
                    }
                    await m.reply(successMessage);
                }
                else {
                    await m.reply(`❌ Upload failed: ${uploadResponse.data.error}\n\nPartially uploaded files: ${uploadResponse.data.uploadedFiles.length}`);
                }
            }
            catch (error) {
                console.error('Error uploading torrent:', error);
                await m.reply(`❌ Upload failed: ${error.response?.data?.error || error.message}`);
            }
        });
        collector.on('end', (_collected, reason) => {
            if (reason === 'time') {
                if (interaction.client.uploadTorrentList) {
                    interaction.client.uploadTorrentList.delete(interaction.user.id);
                }
            }
        });
    }
    catch (error) {
        console.error('Error in gdrive-upload:', error);
        await interaction.editReply('❌ An error occurred while preparing the upload.');
    }
}
if (env_1.env.DISCORD_TOKEN && env_1.env.DISCORD_TOKEN !== 'your_discord_bot_token_here') {
    client.login(env_1.env.DISCORD_TOKEN);
    console.log('Discord bot starting...');
}
else {
    console.log('Discord bot token not configured. Skipping Discord bot startup.');
}
//# sourceMappingURL=index.js.map