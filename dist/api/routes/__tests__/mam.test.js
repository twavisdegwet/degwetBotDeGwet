"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const index_1 = require("../../index");
describe('MAM Endpoints', () => {
    describe('POST /api/mam/search', () => {
        test('should return 400 for missing text parameter', async () => {
            const response = await (0, supertest_1.default)(index_1.app)
                .post('/api/mam/search')
                .send({})
                .expect(400);
            expect(response.body).toHaveProperty('error', 'Invalid request parameters');
        });
        test('should return 400 for invalid perpage parameter', async () => {
            const response = await (0, supertest_1.default)(index_1.app)
                .post('/api/mam/search')
                .send({
                text: 'test',
                perpage: 200
            })
                .expect(400);
            expect(response.body).toHaveProperty('error', 'Invalid request parameters');
        });
        test('should accept valid search parameters', async () => {
            const response = await (0, supertest_1.default)(index_1.app)
                .post('/api/mam/search')
                .send({
                text: 'test',
                perpage: 10
            });
            expect([200, 500]).toContain(response.status);
        });
    });
    describe('POST /api/mam/freeleech', () => {
        test('should return 400 for missing id parameter', async () => {
            const response = await (0, supertest_1.default)(index_1.app)
                .post('/api/mam/freeleech')
                .send({})
                .expect(400);
            expect(response.body).toHaveProperty('error', 'Invalid request parameters');
        });
        test('should return 400 for invalid wedges parameter', async () => {
            const response = await (0, supertest_1.default)(index_1.app)
                .post('/api/mam/freeleech')
                .send({
                id: 123456,
                wedges: 20
            })
                .expect(400);
            expect(response.body).toHaveProperty('error', 'Invalid request parameters');
        });
    });
    describe('POST /api/mam/download', () => {
        test('should return 400 for missing parameters', async () => {
            const response = await (0, supertest_1.default)(index_1.app)
                .post('/api/mam/download')
                .send({})
                .expect(400);
            expect(response.body).toHaveProperty('error', 'Either id or dlHash must be provided');
        });
    });
    describe('GET /api/mam/status/:id', () => {
        test('should handle status requests', async () => {
            const response = await (0, supertest_1.default)(index_1.app)
                .get('/api/mam/status/test-id');
            expect([200, 500]).toContain(response.status);
        });
    });
});
