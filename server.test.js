const request = require('supertest');
const axios = require('axios');

jest.mock('axios');

const { app, login } = require('./server');

beforeEach(() => {
    jest.clearAllMocks();
});

describe('POST /control/:device/:action', () => {
    test('returns success when API call succeeds', async () => {
        axios.post.mockResolvedValue({ data: 'fake-session-id' });
        axios.get.mockResolvedValue({ data: { ok: true } });

        // Ensure session exists
        await login();

        const res = await request(app).post('/control/living/on');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            success: true,
            message: 'Bulb living turned on',
        });
    });

    test('returns 500 when API call fails', async () => {
        axios.post.mockResolvedValue({ data: 'fake-session-id' });
        await login();

        axios.get.mockRejectedValue(new Error('API unreachable'));

        const res = await request(app).post('/control/room/off');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({
            success: false,
            message: 'Failed to control bulb',
        });
    });

    test('returns 400 for invalid device', async () => {
        const res = await request(app).post('/control/kitchen/on');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            success: false,
            message: 'Invalid device or action',
        });
        expect(axios.get).not.toHaveBeenCalled();
    });

    test('returns 400 for invalid action', async () => {
        const res = await request(app).post('/control/living/restart');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            success: false,
            message: 'Invalid device or action',
        });
        expect(axios.get).not.toHaveBeenCalled();
    });

    test('forwards device and action to upstream API', async () => {
        axios.post.mockResolvedValue({ data: 'fake-session-id' });
        axios.get.mockResolvedValue({ data: { ok: true } });
        await login();

        await request(app).post('/control/room/off');

        expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('/actions/l530/off?device=room'),
            expect.objectContaining({
                headers: { Authorization: 'Bearer fake-session-id' },
            }),
        );
    });
});

describe('GET /healthcheck', () => {
    const originalPassword = process.env.API_PASSWORD;

    afterEach(() => {
        process.env.API_PASSWORD = originalPassword;
    });

    test('returns 200 when API authenticates successfully', async () => {
        process.env.API_PASSWORD = 'test-password';
        axios.post.mockResolvedValue({ data: 'session-id' });

        const res = await request(app).get('/healthcheck');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok' });
    });

    test('returns 503 when API_PASSWORD is not set', async () => {
        delete process.env.API_PASSWORD;

        const res = await request(app).get('/healthcheck');

        expect(res.status).toBe(503);
        expect(res.body).toEqual({ status: 'error', message: 'API_PASSWORD not configured' });
    });

    test('returns 503 when API authentication fails', async () => {
        process.env.API_PASSWORD = 'wrong-password';
        axios.post.mockRejectedValue(new Error('Unauthorized'));

        const res = await request(app).get('/healthcheck');

        expect(res.status).toBe(503);
        expect(res.body).toEqual({ status: 'error', message: 'API authentication failed' });
    });
});

describe('GET / (static files)', () => {
    test('serves index.html', async () => {
        const res = await request(app).get('/');

        expect(res.status).toBe(200);
        expect(res.text).toContain('Tapo Bulb Control');
    });
});
