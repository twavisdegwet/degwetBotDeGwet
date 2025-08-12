import { BLUESKY_ACCOUNTS } from '../../config/bluesky-accounts';

interface BlueskyPost {
    text: string;
    createdAt: string;
    author: {
        displayName: string;
        handle: string;
    };
}

interface BlueskyFeedItem {
    post: {
        record: {
            text: string;
            createdAt: string;
        };
        author: {
            displayName: string;
            handle: string;
        };
    };
}

interface BlueskyFeedResponse {
    feed: BlueskyFeedItem[];
}

interface BlueskySearchPost {
    record: {
        text: string;
        createdAt: string;
    };
    author: {
        displayName: string;
        handle: string;
    };
}

interface BlueskySearchResponse {
    posts: BlueskySearchPost[];
}

export async function searchBlueskyPosts(query: string, limit: number = 10): Promise<BlueskyPost[]> {
    try {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodedQuery}&limit=${limit}&sort=top`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error(`Failed to search posts for "${query}": ${response.status}`);
            // Fall back to regular feed if search fails
            return await fetchBlueskyPosts();
        }
        
        const data = await response.json() as BlueskySearchResponse;
        
        return data.posts.map(post => ({
            text: post.record.text,
            createdAt: post.record.createdAt,
            author: {
                displayName: post.author.displayName,
                handle: post.author.handle
            }
        }));
    } catch (error) {
        console.error(`Error searching posts for "${query}":`, error);
        // Fall back to regular feed if search fails
        return await fetchBlueskyPosts();
    }
}

export async function fetchBlueskyPosts(): Promise<BlueskyPost[]> {
    const allPosts: BlueskyPost[] = [];
    
    for (const account of BLUESKY_ACCOUNTS) {
        try {
            const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${account}&limit=3&filter=posts_no_replies`;
            const response = await fetch(url);
            
            if (!response.ok) {
                console.error(`Failed to fetch posts from ${account}: ${response.status}`);
                continue;
            }
            
            const data = await response.json() as BlueskyFeedResponse;
            
            const posts = data.feed.map(item => ({
                text: item.post.record.text,
                createdAt: item.post.record.createdAt,
                author: {
                    displayName: item.post.author.displayName,
                    handle: item.post.author.handle
                }
            }));
            
            allPosts.push(...posts);
        } catch (error) {
            console.error(`Error fetching posts from ${account}:`, error);
        }
    }
    
    // Sort by creation date (newest first)
    return allPosts
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function formatBlueskyPostsForPrompt(posts: BlueskyPost[]): string {
    if (posts.length === 0) {
        return "No posts available at this time.";
    }
    
    return posts.map((post, index) => {
        const timeAgo = getTimeAgo(new Date(post.createdAt));
        return `${index + 1}. ${post.author.displayName} (@${post.author.handle}) - ${timeAgo}:
   ${post.text}`;
    }).join('\n\n');
}

function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
        return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
        return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
}