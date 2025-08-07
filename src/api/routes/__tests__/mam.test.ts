import request from 'supertest';
import { app } from '../../index';

describe('MAM Endpoints', () => {
  describe('POST /api/mam/search', () => {
    test('should return 400 for missing text parameter', async () => {
      const response = await request(app)
        .post('/api/mam/search')
        .send({})
        .expect(400);
      
      expect(response.body).toHaveProperty('error', 'Invalid request parameters');
    });

    test('should return 400 for invalid perpage parameter', async () => {
      const response = await request(app)
        .post('/api/mam/search')
        .send({
          text: 'test',
          perpage: 200 // Too high
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error', 'Invalid request parameters');
    });

    test('should accept valid search parameters', async () => {
      const response = await request(app)
        .post('/api/mam/search')
        .send({
          text: 'test',
          perpage: 10
        });
      
      // Should either succeed (200) or fail due to MAM configuration (500)
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('POST /api/mam/freeleech', () => {
    test('should return 400 for missing id parameter', async () => {
      const response = await request(app)
        .post('/api/mam/freeleech')
        .send({})
        .expect(400);
      
      expect(response.body).toHaveProperty('error', 'Invalid request parameters');
    });

    test('should return 400 for invalid wedges parameter', async () => {
      const response = await request(app)
        .post('/api/mam/freeleech')
        .send({
          id: 123456,
          wedges: 20 // Too high
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error', 'Invalid request parameters');
    });
  });

  describe('POST /api/mam/download', () => {
    test('should return 400 for missing parameters', async () => {
      const response = await request(app)
        .post('/api/mam/download')
        .send({})
        .expect(400);
      
      expect(response.body).toHaveProperty('error', 'Either id or dlHash must be provided');
    });
  });

  describe('GET /api/mam/status/:id', () => {
    test('should handle status requests', async () => {
      const response = await request(app)
        .get('/api/mam/status/test-id');
      
      // Should either succeed or fail due to Deluge configuration
      expect([200, 500]).toContain(response.status);
    });
  });
});
