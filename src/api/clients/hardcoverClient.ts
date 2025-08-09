import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';
import { env } from '../../config/env';

// Define Zod schemas for response validation
const HardcoverBookSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  release_date: z.string().nullable()
});

export type HardcoverBook = z.infer<typeof HardcoverBookSchema>;

const HardcoverSearchResponseSchema = z.object({
  data: z.object({
    books: z.array(HardcoverBookSchema)
  })
});

export type HardcoverSearchResponse = z.infer<typeof HardcoverSearchResponseSchema>;

// Define the Hardcover client class
export class HardcoverClient {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: env.HARDCOVER_API_URL,
      headers: {
        'Authorization': `Bearer ${env.HARDCOVER_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });
  }

  /**
   * Search for books using GraphQL query
   */
  async searchBooks(query: string, limit: number = 10): Promise<HardcoverBook[]> {
    try {
      const graphqlQuery = `
        query SearchBooks($query: String!, $limit: Int!) {
          books(
            where: {
              _or: [
                {title: {_ilike: $query}},
                {description: {_ilike: $query}}
              ]
            },
            limit: $limit,
            order_by: {id: desc}
          ) {
            id
            title
            description
            release_date
          }
        }
      `;

      const response = await this.axiosInstance.post('', {
        query: graphqlQuery,
        variables: {
          query: `%${query}%`,
          limit
        }
      });

      if (response.data.errors) {
        console.error('Hardcover API errors:', response.data.errors);
        return [];
      }

      const validatedResponse = HardcoverSearchResponseSchema.parse(response.data);
      return validatedResponse.data.books;
      
    } catch (error) {
      console.error('Error searching Hardcover books:', error);
      if (error instanceof z.ZodError) {
        console.error('Validation errors:', error.errors);
      }
      throw new Error(`Failed to search books: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific book by ID
   */
  async getBookById(id: number): Promise<HardcoverBook | null> {
    try {
      const graphqlQuery = `
        query GetBook($id: Int!) {
          books(where: {id: {_eq: $id}}) {
            id
            title
            description
            release_date
          }
        }
      `;

      const response = await this.axiosInstance.post('', {
        query: graphqlQuery,
        variables: {
          id
        }
      });

      if (response.data.errors) {
        console.error('Hardcover API errors:', response.data.errors);
        return null;
      }

      const validatedResponse = HardcoverSearchResponseSchema.parse(response.data);
      return validatedResponse.data.books[0] || null;
      
    } catch (error) {
      console.error('Error getting book by ID:', error);
      if (error instanceof z.ZodError) {
        console.error('Validation errors:', error.errors);
      }
      throw new Error(`Failed to get book: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get recent books (for testing and fallback recommendations)
   */
  async getRecentBooks(limit: number = 20): Promise<HardcoverBook[]> {
    try {
      return await this.searchBooks('', limit);
    } catch (error) {
      console.error('Error getting recent books:', error);
      return [];
    }
  }

  /**
   * Format book data for display
   */
  formatBookForDisplay(book: HardcoverBook): any {
    return {
      id: book.id,
      title: book.title,
      description: book.description,
      publishedYear: book.release_date ? new Date(book.release_date).getFullYear() : undefined,
      hardcoverId: book.id.toString()
    };
  }
}
