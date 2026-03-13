import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getAvailableOllamaServer, makeOllamaRequest, getOllamaErrorMessage, ErrorMessages } from '../ollamautils';
import { buildPersonalityPrompt, Personality, personalities, getPersonalityFormatting } from '../personalities';
import { sendRandomGarfieldComic } from '../utils';
import bibleData from '../../../books/bible.json';

interface Verse {
    id: number;
    verse: number;
    text: string;
}

interface Chapter {
    chapter: number;
    verses: Verse[];
}

interface Book {
    name: string;
    chapters: Chapter[];
}

interface BibleData {
    books: Book[];
}

const bible = bibleData as BibleData;

export const data = new SlashCommandBuilder()
    .setName('askbible')
    .setDescription('Consult an expert on Bible verses with Garfield wisdom')
    .addStringOption(option =>
        option.setName('expert')
            .setDescription('Choose which expert to consult (default: random expert)')
            .addChoices(
                ...personalities.map(personality => ({
                    name: personality.charAt(0).toUpperCase() + personality.slice(1),
                    value: personality
                })),
                { name: 'Random Expert', value: 'random' }
            ))
    .addStringOption(option =>
        option.setName('reference')
            .setDescription('Bible reference (e.g., Genesis 1:1-5, John 3:16)')
            .setMaxLength(50))
    .addIntegerOption(option =>
        option.setName('count')
            .setDescription('Number of random verses to retrieve (use with no reference)')
            .setMinValue(1)
            .setMaxValue(10));

function parseBibleReference(ref: string): { book: string; chapter: number; verseStart: number; verseEnd: number } | null {
    const patterns = [
        /^(\d?\s*[A-Za-z]+)\s+(\d+):(\d+)(?:-(\d+))?$/,
        /^(\d?\s*[A-Za-z]+)\s+(\d+)\s*:(\d+)(?:-(\d+))?$/
    ];
    
    for (const pattern of patterns) {
        const match = ref.match(pattern);
        if (match) {
            return {
                book: match[1].trim(),
                chapter: parseInt(match[2], 10),
                verseStart: parseInt(match[3], 10),
                verseEnd: match[4] ? parseInt(match[4], 10) : parseInt(match[3], 10)
            };
        }
    }
    return null;
}

function findBook(bookName: string): Book | undefined {
    const normalizedInput = bookName.toLowerCase().replace(/\s+/g, ' ').trim();
    
    return bible.books.find(b => {
        const normalizedBook = b.name.toLowerCase();
        return normalizedBook === normalizedInput || 
               normalizedBook.replace(/\s+/g, '') === normalizedInput.replace(/\s+/g, '');
    });
}

function lookupVerses(bookName: string, chapter: number, verseStart: number, verseEnd: number): string[] {
    const book = findBook(bookName);
    if (!book) return [];
    
    const chapterData = book.chapters.find(c => c.chapter === chapter);
    if (!chapterData) return [];
    
    const verses: string[] = [];
    for (let v = verseStart; v <= verseEnd && v <= chapterData.verses.length; v++) {
        const verse = chapterData.verses.find(vs => vs.verse === v);
        if (verse) {
            verses.push(`${book.name} ${chapter}:${verse.verse} - ${verse.text}`);
        }
    }
    return verses;
}

function getConsecutiveRandomVerses(count: number): string[] {
    // Find a valid random starting point (skip empty books/chapters)
    let bookIdx: number;
    let chapterIdx: number;
    do {
        bookIdx = Math.floor(Math.random() * bible.books.length);
        chapterIdx = Math.floor(Math.random() * bible.books[bookIdx].chapters.length);
    } while (
        !bible.books[bookIdx].chapters.length ||
        !bible.books[bookIdx].chapters[chapterIdx].verses.length
    );

    const startChapter = bible.books[bookIdx].chapters[chapterIdx];
    const verseIdx = Math.floor(Math.random() * startChapter.verses.length);

    const verses: string[] = [];
    let curBookIdx = bookIdx;
    let curChapterIdx = chapterIdx;
    let curVerseIdx = verseIdx;
    const startKey = `${bookIdx}-${chapterIdx}-${verseIdx}`;

    while (verses.length < count) {
        const curBook = bible.books[curBookIdx];
        const curChapter = curBook.chapters[curChapterIdx];
        const curVerse = curChapter.verses[curVerseIdx];

        verses.push(`${curBook.name} ${curChapter.chapter}:${curVerse.verse} - "${curVerse.text}"`);

        // Advance to next verse
        curVerseIdx++;
        if (curVerseIdx >= curChapter.verses.length) {
            curVerseIdx = 0;
            curChapterIdx++;
            if (curChapterIdx >= curBook.chapters.length) {
                curChapterIdx = 0;
                curBookIdx = (curBookIdx + 1) % bible.books.length;
            }
        }

        // Safety: if we've wrapped all the way back to start, stop
        if (`${curBookIdx}-${curChapterIdx}-${curVerseIdx}` === startKey) break;
    }

    return verses;
}

function splitMessageAtSentence(text: string, maxLength: number = 1800): string[] {
    if (text.length <= maxLength) {
        return [text];
    }
    
    const messages: string[] = [];
    let currentMessage = '';
    const sentences = text.split(/([.!?]\s+|[.!?]$)/);
    
    for (let i = 0; i < sentences.length; i += 2) {
        const sentence = sentences[i];
        const punctuation = sentences[i + 1] || '';
        const fullSentence = sentence + punctuation;
        
        if (currentMessage.length + fullSentence.length <= maxLength) {
            currentMessage += fullSentence;
        } else {
            if (currentMessage.trim()) {
                messages.push(currentMessage.trim());
            }
            currentMessage = fullSentence;
        }
    }
    
    if (currentMessage.trim()) {
        messages.push(currentMessage.trim());
    }
    
    return messages;
}

const PRE_VERSE_MESSAGES = [
    "📜 Alright, hold onto your lasagna — here's your verse for today!",
    "🕊️ The Good Book has spoken! Feast your eyes on this holy wisdom:",
    "✨ Fresh from the scriptures, piping hot like a Monday morning lasagna:",
    "📖 Gather 'round, Garfield fans — the Bible has something to say:",
    "🔔 Ding ding ding! Your verse has arrived. Bless this message:",
    "🙏 The Lord works in mysterious ways — and today, those ways brought you this:",
    "📜 Roll up, roll up! Step right up for your daily dose of scripture:",
    "⚡ Zap! The Bible strikes again with a verse just for you:",
    "🌟 Our scholars have combed the Good Book and found this gem:",
    "🎺 Hear ye, hear ye! The scripture reads as follows:",
];

const POST_VERSE_MESSAGES = [
    "Wow! That's a thinker! 🤔 Let's see what our expert thinks Garfield can learn from it!",
    "Heavy stuff! 😮 Stand by while our expert figures out what this means for Garfield...",
    "Now THAT is some scripture! 📿 Our expert is already applying it to Garfield's life...",
    "Powerful words! ✨ Let's see if our expert can explain this to a lasagna-obsessed cat...",
    "Whoa, deep! 🌊 Hang tight — our expert is consulting the Good Book on Garfield's behalf...",
    "Incredible verse! 🎯 Our expert is now translating this ancient wisdom for Garfield...",
    "That'll make you think! 💭 Our expert is busy figuring out what Garfield should do about this...",
    "Biblical wisdom! 📖 Stay tuned as our expert breaks down what this means for everyone's favorite cat...",
    "The scripture has spoken! 🔔 Now let's hear what our expert has to say to Garfield about it...",
    "Profound! 😲 Our expert is warming up their theological engine to explain this to Garfield...",
];

function groupConsecutiveVerses(verses: string[]): string[] {
    const parsed = verses.map(v => {
        const match = v.match(/^(.+)\s+(\d+):(\d+)\s+-\s+(.*)/);
        if (!match) return null;
        return { book: match[1], chapter: parseInt(match[2], 10), verse: parseInt(match[3], 10), text: match[4], raw: v };
    });

    const groups: { book: string; chapter: number; startVerse: number; endVerse: number; texts: string[] }[] = [];

    for (const p of parsed) {
        if (!p) continue;
        const last = groups[groups.length - 1];
        if (last && last.book === p.book && last.chapter === p.chapter && p.verse === last.endVerse + 1) {
            last.endVerse = p.verse;
            last.texts.push(p.text);
        } else {
            groups.push({ book: p.book, chapter: p.chapter, startVerse: p.verse, endVerse: p.verse, texts: [p.text] });
        }
    }

    return groups.map(g => {
        const ref = g.startVerse === g.endVerse
            ? `${g.book} ${g.chapter}:${g.startVerse}`
            : `${g.book} ${g.chapter}:${g.startVerse}-${g.endVerse}`;
        const textBlock = g.texts.join(' ');
        return `📖 **${ref}**\n\`\`\`\n${textBlock}\n\`\`\``;
    });
}

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
        const expertChoice = interaction.options.getString('expert') || 'random';
        const reference = interaction.options.getString('reference');
        const count = interaction.options.getInteger('count') || 5;

        let verses: string[];
        let queryDescription: string;

        if (reference) {
            const parsed = parseBibleReference(reference);
            if (!parsed) {
                await interaction.editReply({ 
                    content: "Invalid Bible reference format. Use format like 'Genesis 1:1-5' or 'John 3:16'." 
                });
                return;
            }
            
            verses = lookupVerses(parsed.book, parsed.chapter, parsed.verseStart, parsed.verseEnd);
            
            if (verses.length === 0) {
                await interaction.editReply({ 
                    content: `Could not find verses for "${reference}". Check the book, chapter, and verse numbers.` 
                });
                return;
            }
            
            queryDescription = reference;
        } else {
            verses = getConsecutiveRandomVerses(count);
            queryDescription = `${count} random verse${count > 1 ? 's' : ''}`;
        }

        const versesContent = verses.join('\n\n');

        // Send the verse(s) to Discord first, before the LLM responds
        const verseLines = groupConsecutiveVerses(verses);
        const preMessage = PRE_VERSE_MESSAGES[Math.floor(Math.random() * PRE_VERSE_MESSAGES.length)];
        await interaction.editReply({ content: `${preMessage}\n\n${verseLines.join('\n\n')}` });

        const postMessage = POST_VERSE_MESSAGES[Math.floor(Math.random() * POST_VERSE_MESSAGES.length)];
        await interaction.followUp({ content: postMessage });

        const server = await getAvailableOllamaServer();
        console.log(`Using ${server.name} Ollama server with model ${server.model}`);

        let selectedExpert: Personality;

        if (expertChoice === 'random') {
            selectedExpert = personalities[Math.floor(Math.random() * personalities.length)];
        } else if (personalities.includes(expertChoice as Personality)) {
            selectedExpert = expertChoice as Personality;
        } else {
            selectedExpert = personalities[Math.floor(Math.random() * personalities.length)];
        }

        console.log(`Consulting ${selectedExpert} on Bible verses: ${queryDescription}`);

        const expertTask = `You have been asked to riff on the following scripture as commentary directed at Garfield the Cat. The verse${verses.length > 1 ? 's have' : ' has'} already been shown to the user — do NOT repeat or quote them.

Your job: Give fun, character-driven commentary on this text as loose guidance for Garfield's life. You do NOT need to treat the text as sacred or authoritative — it's old writing, sometimes brilliant, sometimes deeply embarrassing by modern standards.

CRITICAL: If the verse contains content that is offensive, sexist, racist, or endorses slavery — do NOT refuse or hedge. Instead, stay in character and do one of the following:
- Briefly explain WHY it's considered problematic today (historical context, pseudonymous authorship, cultural pressures of the time, modern scholarly consensus), then warmly reassure Garfield that he is a good kitty who is better than this verse.
- Or just roast the verse and its ancient authors while redirecting the lesson toward Garfield's life.
Never refuse. Never hedge. Always engage.

Garfield's defining traits: obsession with lasagna, disdain for Mondays, love of sleeping, contempt for diets, and his long-suffering owner Jon. Work these in naturally.

Be creative, be hilarious, stay in character. Keep it under 1500 characters.

===== SCRIPTURE =====
${versesContent}
===== END =====`;

        const messageContext = `[COMMAND ISSUED BY: ${interaction.user.username}]`;
        const prompt = buildPersonalityPrompt(selectedExpert, expertTask, messageContext);
        const response = await makeOllamaRequest(prompt, server);

        const { emoji, name } = getPersonalityFormatting(selectedExpert);
        let filteredResponse = response.response.replace(/\[COMMAND EXECUTION COMPLETE\]/g, '');
        filteredResponse = filteredResponse.replace(/^[\s\S]*?<\/think>\s*/g, '');
        filteredResponse = filteredResponse.replace(/^[\s\S]*?<\/nothink>\s*/g, '');
        filteredResponse = filteredResponse.replace(/<think>[\s\S]*?<\/think>/g, '');
        filteredResponse = filteredResponse.replace(/<nothink>[\s\S]*?<\/nothink>/g, '');
        const cleanedResponse = filteredResponse.replace(/\n\n+/g, '\n');
        const formattedResponse = `**${emoji} ${name}'s Counsel for Garfield on "${queryDescription}":**\n${cleanedResponse}`;

        const messageParts = splitMessageAtSentence(formattedResponse);

        await interaction.followUp({ content: messageParts[0] });

        for (let i = 1; i < messageParts.length; i++) {
            await interaction.followUp({ content: messageParts[i] });
        }

        await sendRandomGarfieldComic(interaction.channel, interaction.user.id, 'completion');

    } catch (err) {
        const errorMessages: ErrorMessages = {
            timeout: 'Biblical consultation timed out - our expert is still searching the Good Book!',
            network: 'Can\'t reach our expert panel - network issues!',
            server: 'Bible consultation system error!',
            general: 'Our Bible expert is currently unavailable - try again soon!'
        };

        const errorMessage = getOllamaErrorMessage(err, errorMessages);
        console.error('Bible expert consultation failure:', err);
        await interaction.editReply({ content: errorMessage });
    }
}
