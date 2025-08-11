import { ChatInputCommandInteraction, SlashCommandBuilder, ChannelType, Collection, Message } from 'discord.js';
import { getAvailableOllamaServer, makeOllamaRequest, getOllamaErrorMessage, ErrorMessages } from '../ollamautils';
import { buildPersonalityPrompt, Personality, personalities, formatExpertResponse } from '../personalities';

interface NewsArticle {
    title: string;
    description: string;
    url: string;
    publishedAt: string;
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
        const expertTask = `You are being asked to summarize today's top news headlines. Review the headlines below and provide your take on the most important stories, trends, or themes you notice. Address chat participants directly and share your perspective in your characteristic style. Keep responses under 300 words with minimal new lines - it should read like a discord message!

NEWS HEADLINES (${category.toUpperCase()} CATEGORY):
${newsContent}

Please summarize the key stories and share your thoughts on what's happening in the news today.`;
        
        // Get prompt and make Ollama request
        const prompt = buildPersonalityPrompt(selectedExpert, expertTask, messageContext);
        const response = await makeOllamaRequest(prompt, server);
        
        // Format the response using centralized formatting
        const questionText = `Summarize today's ${category} news headlines`;
        const formattedResponse = formatExpertResponse(selectedExpert, questionText, response.response);
        
        await interaction.editReply({ content: formattedResponse });

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