import { BLUESKY_ACCOUNTS } from '../../config/bluesky-accounts';
import { blueskyAuth } from '../auth/bluesky-auth';

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
        // Try authenticated search API first
        console.log(`Attempting authenticated search for "${query}"`);
        const authHeaders = await blueskyAuth.getAuthHeaders();
        const encodedQuery = encodeURIComponent(query);
        const url = `https://bsky.social/xrpc/app.bsky.feed.searchPosts?q=${encodedQuery}&limit=${limit}&sort=top`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)',
                'Accept': 'application/json',
                ...authHeaders
            }
        });
        
        if (response.ok) {
            const data = await response.json() as BlueskySearchResponse;
            console.log(`Authenticated search API worked! Found ${data.posts.length} posts for "${query}"`);
            return data.posts.map(post => ({
                text: post.record.text,
                createdAt: post.record.createdAt,
                author: {
                    displayName: post.author.displayName,
                    handle: post.author.handle
                }
            }));
        } else {
            console.log(`Authenticated search API returned ${response.status}, trying public API...`);
        }
        
    } catch (error) {
        console.log(`Authenticated search failed, trying public API:`, error);
    }

    try {
        // Try public search API as fallback
        const encodedQuery = encodeURIComponent(query);
        const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodedQuery}&limit=${limit}&sort=top`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)',
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json() as BlueskySearchResponse;
            console.log(`Public search API worked! Found ${data.posts.length} posts for "${query}"`);
            return data.posts.map(post => ({
                text: post.record.text,
                createdAt: post.record.createdAt,
                author: {
                    displayName: post.author.displayName,
                    handle: post.author.handle
                }
            }));
        } else {
            console.log(`Public search API returned ${response.status}, falling back to local filtering`);
        }
        
    } catch (error) {
        console.log(`Public search API failed, falling back to local filtering:`, error);
    }
    
    // Fallback: Filter local posts
    try {
        console.log(`Filtering local posts for "${query}"`);
        const allPosts = await fetchBlueskyPosts();
        
        // Create search terms (split query and make case-insensitive)
        const searchTerms = query.toLowerCase().split(/\s+/);
        
        // Filter posts that contain any of the search terms
        const filteredPosts = allPosts.filter(post => {
            const postText = post.text.toLowerCase();
            const authorName = post.author.displayName.toLowerCase();
            const authorHandle = post.author.handle.toLowerCase();
            
            return searchTerms.some(term => 
                postText.includes(term) || 
                authorName.includes(term) || 
                authorHandle.includes(term)
            );
        });
        
        // If we found matches, return them (limited)
        if (filteredPosts.length > 0) {
            console.log(`Found ${filteredPosts.length} local posts matching "${query}"`);
            return filteredPosts.slice(0, limit);
        }
        
        // If no matches, return all posts but note the failed search
        console.log(`No local posts found matching "${query}", returning general feed`);
        return allPosts.slice(0, limit);
        
    } catch (error) {
        console.error(`Error filtering posts for "${query}":`, error);
        // Final fallback to regular feed
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

export function formatBlueskyPostsForPromptAnonymous(posts: BlueskyPost[]): string {
    if (posts.length === 0) {
        return "No posts available at this time.";
    }
    
    return posts.map((post) => {
        const timeAgo = getTimeAgo(new Date(post.createdAt));
        return `${timeAgo}:
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