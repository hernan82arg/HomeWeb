const request = require('supertest');
const axios = require('axios');

jest.mock('axios');

const { app, apiLogin } = require('./server');

const agent = request.agent(app);

beforeEach(() => {
    jest.clearAllMocks();
});

async function authenticateAgent(a) {
    const originalWebPassword = process.env.WEB_PASSWORD;
    process.env.WEB_PASSWORD = 'test-web-password';
    await a.post('/login').send({ password: 'test-web-password' });
    process.env.WEB_PASSWORD = originalWebPassword;
}

describe('POST /login', () => {
    const originalWebPassword = process.env.WEB_PASSWORD;

    afterEach(() => {
        process.env.WEB_PASSWORD = originalWebPassword;
    });

    test('returns 200 with correct password', async () => {
        process.env.WEB_PASSWORD = 'test-password';

        const res = await request(app).post('/login').send({ password: 'test-password' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
    });

    test('returns 401 with wrong password', async () => {
        process.env.WEB_PASSWORD = 'test-password';

        const res = await request(app).post('/login').send({ password: 'wrong' });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ success: false, message: 'Invalid password' });
    });

    test('returns 503 when WEB_PASSWORD is not set', async () => {
        delete process.env.WEB_PASSWORD;

        const res = await request(app).post('/login').send({ password: 'anything' });

        expect(res.status).toBe(503);
        expect(res.body).toEqual({ success: false, message: 'Login not configured' });
    });
});

describe('POST /control/:device/:action', () => {
    test('returns 401 when not authenticated', async () => {
        const res = await request(app).post('/control/living/on');

        expect(res.status).toBe(401);
    });

    test('returns success when authenticated and API call succeeds', async () => {
        const authedAgent = request.agent(app);
        await authenticateAgent(authedAgent);

        axios.post.mockResolvedValue({ data: 'fake-session-id' });
        axios.get.mockResolvedValue({ data: { ok: true } });
        await apiLogin();

        const res = await authedAgent.post('/control/living/on');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            success: true,
            message: 'Bulb living turned on',
        });
    });

    test('returns 500 when API call fails', async () => {
        const authedAgent = request.agent(app);
        await authenticateAgent(authedAgent);

        axios.post.mockResolvedValue({ data: 'fake-session-id' });
        await apiLogin();
        axios.get.mockRejectedValue(new Error('API unreachable'));

        const res = await authedAgent.post('/control/room/off');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({
            success: false,
            message: 'Failed to control bulb',
        });
    });

    test('returns 400 for invalid device', async () => {
        const authedAgent = request.agent(app);
        await authenticateAgent(authedAgent);

        const res = await authedAgent.post('/control/kitchen/on');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            success: false,
            message: 'Invalid device or action',
        });
        expect(axios.get).not.toHaveBeenCalled();
    });

    test('returns 400 for invalid action', async () => {
        const authedAgent = request.agent(app);
        await authenticateAgent(authedAgent);

        const res = await authedAgent.post('/control/living/restart');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            success: false,
            message: 'Invalid device or action',
        });
        expect(axios.get).not.toHaveBeenCalled();
    });

    test('forwards device and action to upstream API', async () => {
        const authedAgent = request.agent(app);
        await authenticateAgent(authedAgent);

        axios.post.mockResolvedValue({ data: 'fake-session-id' });
        axios.get.mockResolvedValue({ data: { ok: true } });
        await apiLogin();

        await authedAgent.post('/control/room/off');

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

describe('GET /', () => {
    test('redirects to /login when not authenticated', async () => {
        const res = await request(app).get('/');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/login');
    });

    test('serves index.html when authenticated', async () => {
        const authedAgent = request.agent(app);
        await authenticateAgent(authedAgent);

        const res = await authedAgent.get('/');

        expect(res.status).toBe(200);
        expect(res.text).toContain('Tapo Bulb Control');
    });
});

describe('POST /logout', () => {
    test('destroys session and returns success', async () => {
        const authedAgent = request.agent(app);
        await authenticateAgent(authedAgent);

        const res = await authedAgent.post('/logout');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });

        // Should be redirected after logout
        const afterLogout = await authedAgent.get('/');
        expect(afterLogout.status).toBe(302);
    });
});
