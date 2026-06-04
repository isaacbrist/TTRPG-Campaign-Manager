/**
 * Tests for the API helper module (lib/api.ts).
 * We replace global.fetch with a jest.fn() so no real network calls are made.
 */
import '@testing-library/jest-dom';

jest.unmock('@/lib/api');
import { getCampaigns, createCampaign, deleteCampaign } from '@/lib/api';

// ── Helpers ────────────────────────────────────────────────────────────────

function mockFetch(body: unknown, status = 200) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => (h === 'content-length' ? '10' : null) },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── getCampaigns ───────────────────────────────────────────────────────────

describe('getCampaigns', () => {
  test('calls GET /campaigns and returns the paginated result', async () => {
    const fakePage = {
      items: [
        { id: 1, name: 'Campaign A', createdAt: '2025-01-01T00:00:00Z' },
        { id: 2, name: 'Campaign B', createdAt: '2025-02-01T00:00:00Z' },
      ],
      page: 1,
      pageSize: 20,
      totalCount: 2,
      totalPages: 1,
    };

    mockFetch(fakePage);

    const result = await getCampaigns();

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/campaigns');
    expect(opts.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(result.items).toHaveLength(2);
    expect(result.totalCount).toBe(2);
    expect(result.items[0].name).toBe('Campaign A');
  });

  test('throws when the server returns a non-2xx status', async () => {
    mockFetch({ title: 'Internal Error' }, 500);

    await expect(getCampaigns()).rejects.toThrow(/API error 500/);
  });
});

// ── createCampaign ─────────────────────────────────────────────────────────

describe('createCampaign', () => {
  test('calls POST /campaigns with the correct JSON body', async () => {
    const payload = { name: 'New Campaign', description: 'Desc', setting: 'Homebrew' };
    const created  = { id: 5, ...payload, createdAt: '2025-03-01T00:00:00Z' };

    mockFetch(created, 201);

    const result = await createCampaign(payload);

    const [url, opts] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/campaigns');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual(payload);
    expect(result).toEqual(created);
  });

  test('throws when the server returns a 400 Bad Request', async () => {
    mockFetch({ title: 'Validation error' }, 400);

    await expect(createCampaign({ name: '' })).rejects.toThrow(/API error 400/);
  });
});

// ── deleteCampaign ─────────────────────────────────────────────────────────

describe('deleteCampaign', () => {
  test('calls DELETE /campaigns/{id}', async () => {
    // 204 No Content
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: { get: () => '0' },
      json: () => Promise.resolve(undefined),
      text: () => Promise.resolve(''),
    });

    await deleteCampaign(7);

    const [url, opts] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/campaigns/7');
    expect(opts.method).toBe('DELETE');
  });

  test('throws when the server returns 404', async () => {
    mockFetch('Not Found', 404);

    await expect(deleteCampaign(99)).rejects.toThrow(/API error 404/);
  });
});
