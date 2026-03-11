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
            verses.push(`${book.name} ${chapter}:${verse.verse} - "${verse.text}"`);
        }
    }
    return verses;
}

function getRandomVerses(count: number): string[] {
    const verses: string[] = [];
    const addedVerses = new Set<string>();
    
    while (verses.length < count) {
        const randomBook = bible.books[Math.floor(Math.random() * bible.books.length)];
        if (!randomBook.chapters.length) continue;
        
        const randomChapter = randomBook.chapters[Math.floor(Math.random() * randomBook.chapters.length)];
        if (!randomChapter.verses.length) continue;
        
        const randomVerse = randomChapter.verses[Math.floor(Math.random() * randomChapter.verses.length)];
        const verseKey = `${randomBook.name}-${randomChapter.chapter}-${randomVerse.verse}`;
        
        if (!addedVerses.has(verseKey)) {
            addedVerses.add(verseKey);
            verses.push(`${randomBook.name} ${randomChapter.chapter}:${randomVerse.verse} - "${randomVerse.text}"`);
        }
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

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    await sendRandomGarfieldComic(interaction.channel, interaction.user.id, 'waiting');

    try {
        const expertChoice = interaction.options.getString('expert') || 'random';
        const reference = interaction.options.getString('reference');
        const count = interaction.options.getInteger('count') || 1;

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
            verses = getRandomVerses(count);
            queryDescription = `${count} random verse${count > 1 ? 's' : ''}`;
        }

        const versesContent = verses.join('\n\n');

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

        const expertTask = `You're a witty Bible scholar with a sense of humor, known for making scripture relatable through humorous examples involving Garfield the Cat and his beloved lasagna.

Your task: Provide insights on the following Bible verse${verses.length > 1 ? 's' : ''}: ${queryDescription}

REQUIREMENTS:
1. FIRST, print the actual verse${verses.length > 1 ? 's' : ''} text exactly as provided below
2. THEN, provide your thoughtful interpretation or commentary on what the verse${verses.length > 1 ? 's' : ' '} mean${verses.length > 1 ? '' : 's'}
3. FINALLY, and THIS IS CRITICAL - provide a funny, creative example of how Garfield the Cat could use the teachings from these verse${verses.length > 1 ? 's' : ' '} to get more lasagna. Be specific and creative! The funnier, the better.

Your tone should be educational but also fun and engaging. Make the Garfield/lasagna connection clever and unexpected.

===== BIBLE VERSES TO ANALYZE =====
${versesContent}

===== END OF VERSES =====

Remember: You MUST print the verse text first, then your commentary, then end with a hilarious Garfield/lasagna example. Keep it under 8000 characters.`;

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
        const formattedResponse = `**${emoji} ${name}'s Biblical Wisdom on "${queryDescription}":**\n${cleanedResponse}`;

        const messageParts = splitMessageAtSentence(formattedResponse);
        
        await interaction.editReply({ content: messageParts[0] });
        
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
