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
  return { ApiError, NetworkError, saveOutreport: vi.fn(), updateOutreport: vi.fn() };
});

import { clear } from 'idb-keyval';
import { ApiError, NetworkError, saveOutreport, updateOutreport } from '../api/client';
import { enqueue, flushOutbox, getOutbox, removeQueued, updateQueued } from '../offline/outbox';

const mockSave = vi.mocked(saveOutreport);
const mockUpdate = vi.mocked(updateOutreport);

beforeEach(async () => {
  await clear();
  mockSave.mockReset();
  mockUpdate.mockReset();
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
    expect(mockUpdate).not.toHaveBeenCalled();
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

  it('treats duplicate:true as success and re-pushes current content', async () => {
    // duplicate means an earlier interrupted flush already delivered this id,
    // possibly with older content: the flush must push the current record.
    mockSave.mockResolvedValue({ duplicate: true });
    await enqueue('RC-DN', 'id-1', { 'TR.NO': 'A' });
    const res = await flushOutbox();
    expect(res.delivered).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith('RC-DN', 'id-1', { 'TR.NO': 'A' });
    expect(await getOutbox()).toHaveLength(0);
  });

  it('pushes an edit made while the save was in flight, then clears', async () => {
    let resolveSave: (v: { duplicate?: boolean }) => void;
    mockSave.mockImplementationOnce(
      () => new Promise((r) => (resolveSave = r)) as Promise<{ duplicate?: boolean }>,
    );
    await enqueue('RC-DN', 'id-1', { 'TR.NO': 'A' });
    const flush = flushOutbox();
    await vi.waitFor(() => expect(mockSave).toHaveBeenCalled());
    await updateQueued('id-1', { 'TR.NO': 'B' }); // user edits mid-request
    resolveSave!({});
    const res = await flush;
    expect(res.delivered).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith('RC-DN', 'id-1', { 'TR.NO': 'B' });
    expect(await getOutbox()).toHaveLength(0);
  });

  it('skips an item deleted locally mid-flush', async () => {
    mockSave.mockImplementation(async () => {
      await removeQueued('id-2'); // user deletes the later queued entry mid-flush
      return {};
    });
    await enqueue('RC-DN', 'id-1', {});
    await enqueue('RC-DN', 'id-2', {});
    const res = await flushOutbox();
    expect(res.delivered).toBe(1);
    expect(mockSave).toHaveBeenCalledTimes(1); // id-2 never sent
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
