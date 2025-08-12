interface BlueskySession {
    accessJwt: string;
    refreshJwt: string;
    handle: string;
    did: string;
    didDoc?: any;
    email?: string;
    emailConfirmed?: boolean;
    emailAuthFactor?: boolean;
    active?: boolean;
    status?: string;
}

interface BlueskySessionResponse {
    accessJwt: string;
    refreshJwt: string;
    handle: string;
    did: string;
    didDoc?: any;
    email?: string;
    emailConfirmed?: boolean;
    emailAuthFactor?: boolean;
    active?: boolean;
    status?: string;
}

interface BlueskyAuthError {
    error: string;
    message: string;
}

class BlueskyAuthManager {
    private session: BlueskySession | null = null;
    private sessionExpiry: number = 0;
    private readonly REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry

    private get pdsHost(): string {
        return process.env.BLUESKY_PDS_HOST || 'https://bsky.social';
    }

    private get handle(): string {
        const handle = process.env.BLUESKY_HANDLE;
        if (!handle) {
            throw new Error('BLUESKY_HANDLE environment variable is required');
        }
        return handle;
    }

    private get password(): string {
        const password = process.env.BLUESKY_PASSWORD;
        if (!password) {
            throw new Error('BLUESKY_PASSWORD environment variable is required');
        }
        return password;
    }

    private parseJwtExpiry(jwt: string): number {
        try {
            const payload = JSON.parse(atob(jwt.split('.')[1]));
            return payload.exp * 1000; // Convert to milliseconds
        } catch (error) {
            console.error('Failed to parse JWT expiry:', error);
            return Date.now() + (10 * 60 * 1000); // Default to 10 minutes from now
        }
    }

    private async createSession(): Promise<BlueskySession> {
        console.log('Creating new Bluesky session...');
        
        const response = await fetch(`${this.pdsHost}/xrpc/com.atproto.server.createSession`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                identifier: this.handle,
                password: this.password,
            }),
        });

        if (!response.ok) {
            const error = await response.json() as BlueskyAuthError;
            throw new Error(`Failed to create Bluesky session: ${error.error} - ${error.message}`);
        }

        const sessionData = await response.json() as BlueskySessionResponse;
        
        // Calculate expiry time
        this.sessionExpiry = this.parseJwtExpiry(sessionData.accessJwt);
        
        this.session = sessionData;
        console.log(`Bluesky session created for ${sessionData.handle}`);
        
        return sessionData;
    }

    private async refreshSession(): Promise<BlueskySession> {
        if (!this.session?.refreshJwt) {
            throw new Error('No refresh token available, need to create new session');
        }

        console.log('Refreshing Bluesky session...');

        const response = await fetch(`${this.pdsHost}/xrpc/com.atproto.server.refreshSession`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.session.refreshJwt}`,
            },
        });

        if (!response.ok) {
            console.log('Refresh failed, creating new session...');
            return await this.createSession();
        }

        const sessionData = await response.json() as BlueskySessionResponse;
        
        // Calculate expiry time
        this.sessionExpiry = this.parseJwtExpiry(sessionData.accessJwt);
        
        this.session = sessionData;
        console.log('Bluesky session refreshed');
        
        return sessionData;
    }

    private isSessionExpired(): boolean {
        if (!this.session) return true;
        return Date.now() >= (this.sessionExpiry - this.REFRESH_BUFFER_MS);
    }

    public async getValidSession(): Promise<BlueskySession> {
        if (!this.session || this.isSessionExpired()) {
            if (this.session?.refreshJwt && !this.isSessionExpired()) {
                return await this.refreshSession();
            } else {
                return await this.createSession();
            }
        }
        
        return this.session;
    }

    public async getAuthHeaders(): Promise<{ Authorization: string }> {
        const session = await this.getValidSession();
        return {
            Authorization: `Bearer ${session.accessJwt}`,
        };
    }

    public clearSession(): void {
        this.session = null;
        this.sessionExpiry = 0;
    }
}

// Export a singleton instance
export const blueskyAuth = new BlueskyAuthManager();
export type { BlueskySession, BlueskyAuthError };