import { ChatInputCommandInteraction, SlashCommandBuilder, ChannelType, Collection, Message } from 'discord.js';
import { getAvailableOllamaServer, makeOllamaRequest, getOllamaErrorMessage, ErrorMessages } from '../ollamautils';
import { buildPersonalityPrompt, Personality, personalities, formatExpertResponse, getPersonalityFormatting } from '../personalities';

interface NewsArticle {
    title: string;
    description: string;
    url: string;
    publishedAt: string;
    content?: string;
    source: {
        name: string;
    };
}

interface NewsResponse {
    status: string;
    totalResults: number;
    articles: NewsArticle[];
}

export const data = new SlashCommandBuilder()
    .setName('expertnews')
    .setDescription('Ask one of our expert consultants to summarize today\'s news headlines')
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
        option.setName('category')
            .setDescription('News category to focus on (default: general)')
            .addChoices(
                { name: 'General', value: 'general' },
                { name: 'Business', value: 'business' },
                { name: 'Entertainment', value: 'entertainment' },
                { name: 'Health', value: 'health' },
                { name: 'Science', value: 'science' },
                { name: 'Sports', value: 'sports' },
                { name: 'Technology', value: 'technology' }
            ))
    .addIntegerOption(option =>
        option.setName('context')
            .setDescription('Number of recent messages to include as context (default: 5)')
            .setMinValue(0)
            .setMaxValue(25));

async function fetchTopHeadlines(category?: string): Promise<NewsArticle[]> {
    const apiKey = '751ec1083d624883bfe62353bb4b38bc';
    let url: string;
    
    if (category && category !== 'general') {
        // Use category-based filtering
        url = `https://newsapi.org/v2/top-headlines?country=us&category=${category}&pageSize=10&apiKey=${apiKey}`;
    } else {
        // Use specific sources for general news
        const sources = 'associated-press,bbc-news,the-wall-street-journal';
        url = `https://newsapi.org/v2/top-headlines?sources=${sources}&pageSize=10&apiKey=${apiKey}`;
    }
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`News API returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json() as NewsResponse;
        if (data.status !== 'ok') {
            throw new Error(`News API error: ${data.status}`);
        }
        
        return data.articles || [];
    } catch (error) {
        console.error('Error fetching news:', error);
        throw error;
    }
}

function formatNewsForPrompt(articles: NewsArticle[]): string {
    if (articles.length === 0) {
        return "No news articles available at this time.";
    }
    
    return articles.map((article, index) => {
        return `${index + 1}. ${article.title}
   ${article.description || 'No description available'}
   ${article.content || ''}`.trim();
    }).join('\n\n');
}

function splitMessageAtSentence(text: string, maxLength: number = 1800): string[] {
    if (text.length <= maxLength) {
        return [text];
    }
    
    const messages: string[] = [];
    let currentMessage = '';
    
    // Split by sentences (looking for . ! ? followed by space or end of string)
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

    try {
        const expertChoice = interaction.options.getString('expert') || 'random';
        const category = interaction.options.getString('category') || 'general';
        const contextLimit = interaction.options.getInteger('context') || 5;

        // Get the specified number of messages from the channel for context
        let messages: Collection<string, Message<true>> | undefined;
        if (interaction.channel?.type === ChannelType.GuildText && contextLimit > 0) {
            messages = await interaction.channel.messages.fetch({ limit: contextLimit });
        }

        // Prepare message context
        let messageContext = `[COMMAND ISSUED BY: ${interaction.user.username}]\n\n`;
        if (messages && contextLimit > 0) {
            const messageArray = Array.from(messages.values());
            messageContext += messageArray.map(msg => `${msg.author.username}: ${msg.content}`).reverse().join('\n');
        }

        // Fetch news headlines
        console.log(`Fetching ${category} news headlines...`);
        const articles = await fetchTopHeadlines(category);
        
        if (articles.length === 0) {
            await interaction.editReply({ 
                content: "Sorry, I couldn't fetch any news headlines right now. The news API might be having issues or there might not be any articles in that category." 
            });
            return;
        }

        // Get available Ollama server with failover
        const server = await getAvailableOllamaServer();
        console.log(`Using ${server.name} Ollama server (${server.host}) with model ${server.model}`);

        // Determine which expert to consult
        let selectedExpert: Personality;
        
        if (expertChoice === 'random') {
            selectedExpert = personalities[Math.floor(Math.random() * personalities.length)];
        } else if (personalities.includes(expertChoice as Personality)) {
            selectedExpert = expertChoice as Personality;
        } else {
            // Default to random if invalid choice
            selectedExpert = personalities[Math.floor(Math.random() * personalities.length)];
        }

        console.log(`Getting expert news summary from ${selectedExpert} for ${category} news`);

        // Format news for the prompt
        const newsContent = formatNewsForPrompt(articles);
        
        // Define the expert task for news summarization
        const expertTask = `You are hosting your own nightly news show! You must present today's top news stories as if you're a news anchor delivering the evening news broadcast. You should:

1. Open with a greeting appropriate to your personality
2. Select and focus on the 3 most important/interesting stories from the headlines (choose ones most relevant to the chat context, or your personal favorites if none apply)
3. Present each story with context and your unique perspective
4. Connect stories together when possible, showing relationships between events
5. Add context, background, or implications that help viewers understand why these stories matter
6. If you need to fabricate reasonable context or background details to make the stories more engaging and understandable, do so confidently
7. Close with your signature sign-off

CRITICAL: Your entire news broadcast must be under 4000 characters total. Write in a flowing, natural speaking style as if you're on TV. Address your audience directly. Make it engaging, informative, and distinctly in your character's voice, but keep it concise.

TODAY'S TOP HEADLINES${category && category !== 'general' ? ` (${category.toUpperCase()} FOCUS)` : ''}:
${newsContent}

Now deliver your concise nightly news broadcast focusing on your top 3 story picks!`;
        
        // Get prompt and make Ollama request
        const prompt = buildPersonalityPrompt(selectedExpert, expertTask, messageContext);
        const response = await makeOllamaRequest(prompt, server);
        
        // Format the response directly without Q&A format (since this is a news broadcast)
        const { emoji, name } = getPersonalityFormatting(selectedExpert);
        const cleanedResponse = response.response.replace(/\n\n+/g, '\n');
        const formattedResponse = `**${emoji} ${name}'s News Broadcast:**\n${cleanedResponse}`;
        
        // Split the message if it's too long
        const messageParts = splitMessageAtSentence(formattedResponse);
        
        // Send the first part as the reply
        await interaction.editReply({ content: messageParts[0] });
        
        // Send additional parts as follow-ups if needed
        for (let i = 1; i < messageParts.length; i++) {
            await interaction.followUp({ content: messageParts[i] });
        }

    } catch (err) {
        const errorMessages: ErrorMessages = {
            timeout: 'News briefing timed out - our expert is still reading the headlines!',
            network: 'Can\'t reach our news sources or expert panel - network issues!',
            server: 'News analysis system error!',
            general: 'Our news expert is currently unavailable - try again soon!'
        };

        const errorMessage = getOllamaErrorMessage(err, errorMessages);
        console.error('Expert news consultation failure:', err);
        await interaction.editReply({ content: errorMessage });
    }
}