import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/client', () => {
  class ApiError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  class NetworkError extends Error {}
  return { ApiError, NetworkError, saveOutreport: vi.fn() };
});

import { clear } from 'idb-keyval';
import { ApiError, NetworkError, saveOutreport } from '../api/client';
import { enqueue, flushOutbox, getOutbox, removeQueued, updateQueued } from '../offline/outbox';

const mockSave = vi.mocked(saveOutreport);

beforeEach(async () => {
  await clear();
  mockSave.mockReset();
});

describe('outbox flush', () => {
  it('delivers queued items sequentially and clears them', async () => {
    mockSave.mockResolvedValue({});
    await enqueue('RC-DN', 'id-1', { 'TR.NO': 'A' });
    await enqueue('RC-DN', 'id-2', { 'TR.NO': 'B' });
    const res = await flushOutbox();
    expect(res).toEqual({ delivered: 2, failed: 0, stopped: false });
    expect(await getOutbox()).toHaveLength(0);
    expect(mockSave).toHaveBeenCalledTimes(2);
  });

  it('stops on network error, leaving remaining items pending', async () => {
    mockSave.mockRejectedValueOnce(new NetworkError('offline'));
    await enqueue('RC-DN', 'id-1', {});
    await enqueue('RC-DN', 'id-2', {});
    const res = await flushOutbox();
    expect(res.stopped).toBe(true);
    const items = await getOutbox();
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.status === 'pending')).toBe(true);
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('marks VALIDATION failures as error and continues', async () => {
    mockSave
      .mockRejectedValueOnce(new ApiError('VALIDATION', 'bad mobile'))
      .mockResolvedValueOnce({});
    await enqueue('RC-DN', 'id-1', {});
    await enqueue('RC-DN', 'id-2', {});
    const res = await flushOutbox();
    expect(res).toMatchObject({ delivered: 1, failed: 1 });
    const items = await getOutbox();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'id-1', status: 'error', message: 'bad mobile' });
  });

  it('treats duplicate:true as success', async () => {
    mockSave.mockResolvedValue({ duplicate: true });
    await enqueue('RC-DN', 'id-1', {});
    const res = await flushOutbox();
    expect(res.delivered).toBe(1);
    expect(await getOutbox()).toHaveLength(0);
  });

  it('skips error items on subsequent flushes until edited', async () => {
    mockSave.mockRejectedValueOnce(new ApiError('VALIDATION', 'bad'));
    await enqueue('RC-DN', 'id-1', {});
    await flushOutbox();
    mockSave.mockResolvedValue({});
    await flushOutbox();
    expect((await getOutbox())[0].status).toBe('error'); // untouched

    await updateQueued('id-1', { 'TR.NO': 'fixed' }); // edit re-queues it
    const res = await flushOutbox();
    expect(res.delivered).toBe(1);
    expect(await getOutbox()).toHaveLength(0);
  });

  it('is single-flight: concurrent calls share one run', async () => {
    let resolveFirst: (v: object) => void;
    mockSave.mockImplementationOnce(
      () => new Promise((r) => (resolveFirst = r)) as Promise<{ duplicate?: boolean }>,
    );
    await enqueue('RC-DN', 'id-1', {});
    const p1 = flushOutbox();
    const p2 = flushOutbox();
    expect(p1).toBe(p2);
    await vi.waitFor(() => expect(mockSave).toHaveBeenCalled());
    resolveFirst!({});
    await p1;
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('removeQueued deletes a local entry', async () => {
    await enqueue('RC-DN', 'id-1', {});
    await removeQueued('id-1');
    expect(await getOutbox()).toHaveLength(0);
  });
});
