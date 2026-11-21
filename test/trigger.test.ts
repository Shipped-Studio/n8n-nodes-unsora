import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POLL_WINDOW, UnsoraTrigger } from '../nodes/UnsoraTrigger/UnsoraTrigger.node';
import { BASE_URL, createPollContext } from './helpers';

const trigger = new UnsoraTrigger();

const clippings = (ids: Array<[string, string, string]>) => ({
	body: {
		success: true,
		data: ids.map(([id, status, updatedAt]) => ({ id, status, updatedAt, clips: [] })),
	},
});

describe('Unsora Trigger', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-01T09:00:00Z'));
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('skips existing events on the first poll, then emits only new ones', async () => {
		const staticData = {};
		const first = createPollContext({
			event: 'clippingCompleted',
			staticData,
			responses: [
				clippings([
					['c1', 'COMPLETED', '2026-10-01T10:00:00Z'],
					['c2', 'PROCESSING', '2026-10-01T11:00:00Z'],
				]),
			],
		});
		expect(await trigger.poll.call(first.context)).toBeNull();
		expect(first.requests[0].url).toBe(`${BASE_URL}/clippings/all`);
		expect(first.requests[0].qs).toEqual({
			status: 'COMPLETED',
			sort: 'updated',
			limit: POLL_WINDOW,
		});

		const second = createPollContext({
			event: 'clippingCompleted',
			staticData,
			responses: [
				clippings([
					['c1', 'COMPLETED', '2026-10-01T10:00:00Z'],
					['c2', 'COMPLETED', '2026-10-01T12:00:00Z'],
					['c3', 'COMPLETED', '2026-10-01T12:30:00Z'],
				]),
			],
		});
		const result = await trigger.poll.call(second.context);
		expect(result?.[0].map((item) => item.json.id)).toEqual(['c2', 'c3']);

		const third = createPollContext({
			event: 'clippingCompleted',
			staticData,
			responses: [clippings([['c3', 'COMPLETED', '2026-10-01T12:30:00Z']])],
		});
		expect(await trigger.poll.call(third.context)).toBeNull();
	});

	it('returns the latest event in manual test mode', async () => {
		const { context } = createPollContext({
			event: 'clippingCompleted',
			mode: 'manual',
			responses: [
				clippings([
					['old', 'COMPLETED', '2026-10-01T10:00:00Z'],
					['new', 'COMPLETED', '2026-10-02T10:00:00Z'],
				]),
			],
		});
		const result = await trigger.poll.call(context);
		expect(result?.[0]).toHaveLength(1);
		expect(result?.[0][0].json.id).toBe('new');
	});

	it('polls published and failed posts by status', async () => {
		for (const [event, status] of [
			['postPublished', 'PUBLISHED'],
			['postFailed', 'FAILED'],
		]) {
			const { context, requests } = createPollContext({
				event,
				mode: 'manual',
				responses: [
					{
						body: { data: { posts: [{ id: 'p1', status, publishedAt: '2026-10-01T10:00:00Z' }] } },
					},
				],
			});
			const result = await trigger.poll.call(context);
			expect(requests[0].url).toBe(`${BASE_URL}/posts`);
			expect(requests[0].qs).toEqual({ status, sort: 'updated', page: 1, limit: POLL_WINDOW });
			expect(result?.[0][0].json.id).toBe('p1');
		}
	});

	it('never floods old history when an old server returns every clipping', async () => {
		const history = Array.from({ length: 1500 }, (_, i) => [
			`old${i}`,
			'COMPLETED',
			new Date(Date.UTC(2025, 0, 1) + i * 60_000).toISOString(),
		]) as Array<[string, string, string]>;
		const staticData = {};
		const first = createPollContext({
			event: 'clippingCompleted',
			staticData,
			responses: [clippings(history)],
		});
		expect(await trigger.poll.call(first.context)).toBeNull();

		vi.setSystemTime(new Date('2026-10-01T09:05:00Z'));
		const second = createPollContext({
			event: 'clippingCompleted',
			staticData,
			responses: [clippings([...history, ['new1', 'COMPLETED', '2026-10-01T09:04:00Z']])],
		});
		const result = await trigger.poll.call(second.context);
		expect(result?.[0].map((item) => item.json.id)).toEqual(['new1']);

		const third = createPollContext({
			event: 'clippingCompleted',
			staticData,
			responses: [clippings([...history, ['new1', 'COMPLETED', '2026-10-01T09:04:00Z']])],
		});
		expect(await trigger.poll.call(third.context)).toBeNull();
		expect((staticData as { seenIds: string[] }).seenIds[0]).toBe('new1');
	});

	it('fires Post Failed again when a retried post fails again, with the post ID', async () => {
		const failed = (updatedAt: string) => ({
			body: { data: { posts: [{ id: 'p1', status: 'FAILED', updatedAt }] } },
		});
		const staticData = {};
		const first = createPollContext({
			event: 'postFailed',
			staticData,
			responses: [{ body: { data: { posts: [] } } }],
		});
		expect(await trigger.poll.call(first.context)).toBeNull();

		const second = createPollContext({
			event: 'postFailed',
			staticData,
			responses: [failed('2026-10-01T09:10:00Z')],
		});
		expect((await trigger.poll.call(second.context))?.[0][0].json.id).toBe('p1');

		const same = createPollContext({
			event: 'postFailed',
			staticData,
			responses: [failed('2026-10-01T09:10:00Z')],
		});
		expect(await trigger.poll.call(same.context)).toBeNull();

		const again = createPollContext({
			event: 'postFailed',
			staticData,
			responses: [failed('2026-10-01T09:30:00Z')],
		});
		expect((await trigger.poll.call(again.context))?.[0][0].json.id).toBe('p1');
	});
});
