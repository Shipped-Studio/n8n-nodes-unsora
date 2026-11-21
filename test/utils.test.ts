import { describe, expect, it } from 'vitest';
import { parseRetryAfter } from '../nodes/Unsora/shared/transport';
import {
	extractJobIds,
	extractList,
	extractTotalPages,
	toIsoDateTime,
	toList,
	withClipUrls,
} from '../nodes/Unsora/shared/utils';

describe('toIsoDateTime', () => {
	it('reads wall-clock values in the given time zone', () => {
		expect(toIsoDateTime('2026-11-02T09:30:00', 'Europe/Berlin')).toBe('2026-11-02T08:30:00.000Z');
		expect(toIsoDateTime('2026-07-02T09:30:00', 'Europe/Berlin')).toBe('2026-07-02T07:30:00.000Z');
		expect(toIsoDateTime('2026-07-02T09:30', 'America/New_York')).toBe('2026-07-02T13:30:00.000Z');
		expect(toIsoDateTime('2026-07-02T09:30:00', 'UTC')).toBe('2026-07-02T09:30:00.000Z');
	});

	it('keeps values that already carry an offset', () => {
		expect(toIsoDateTime('2026-07-02T09:30:00+02:00', 'America/New_York')).toBe(
			'2026-07-02T07:30:00.000Z',
		);
		expect(toIsoDateTime('2026-07-02T09:30:00Z', 'Asia/Tokyo')).toBe('2026-07-02T09:30:00.000Z');
	});

	it('handles empty, numeric and DateTime-like values', () => {
		expect(toIsoDateTime('', 'UTC')).toBeUndefined();
		expect(toIsoDateTime(Date.UTC(2026, 0, 1), 'UTC')).toBe('2026-01-01T00:00:00.000Z');
		expect(toIsoDateTime({ toISO: () => '2026-01-01T10:00:00.000+01:00' }, 'UTC')).toBe(
			'2026-01-01T10:00:00.000+01:00',
		);
	});
});

describe('list helpers', () => {
	it('splits comma and newline separated lists', () => {
		expect(toList('a, b\nc,,')).toEqual(['a', 'b', 'c']);
		expect(toList(['x', ' y '])).toEqual(['x', 'y']);
		expect(toList(undefined)).toEqual([]);
	});

	it('finds records in every list shape the API returns', () => {
		expect(extractList({ success: true, data: [{ id: 1 }] })).toEqual([{ id: 1 }]);
		expect(extractList({ success: true, generations: [{ id: 2 }] })).toEqual([{ id: 2 }]);
		expect(extractList({ data: { posts: [{ id: 3 }], pagination: {} } })).toEqual([{ id: 3 }]);
		expect(extractList({ data: { uploads: [{ id: 4 }] } })).toEqual([{ id: 4 }]);
		expect(extractList({ voices: [{ id: 5 }] })).toEqual([{ id: 5 }]);
	});

	it('reads total pages from both pagination shapes', () => {
		expect(extractTotalPages({ pagination: { totalPages: 3 } })).toBe(3);
		expect(extractTotalPages({ data: { pagination: { totalPages: 4 } } })).toBe(4);
		expect(extractTotalPages({ data: [] })).toBeUndefined();
	});

	it('collects job IDs from single and multi create responses', () => {
		expect(extractJobIds({ generation: { id: 'g1' } })).toEqual(['g1']);
		expect(extractJobIds({ generations: [{ id: 'a' }, { id: 'b' }] })).toEqual(['a', 'b']);
		expect(extractJobIds({ data: { id: 'c1' } })).toEqual(['c1']);
	});
});

describe('parseRetryAfter', () => {
	it('uses Retry-After seconds when present, capped at 60s', () => {
		expect(parseRetryAfter('3')).toBe(3000);
		expect(parseRetryAfter('600')).toBe(60_000);
	});

	it('falls back to a growing fixed backoff when the header is missing', () => {
		expect(parseRetryAfter(undefined, 1)).toBe(15_000);
		expect(parseRetryAfter(undefined, 2)).toBe(30_000);
		expect(parseRetryAfter(undefined, 9)).toBe(60_000);
	});
});

describe('withClipUrls', () => {
	it('adds one clipUrl field per clip', () => {
		expect(
			withClipUrls({
				id: 'job',
				clips: [
					{ id: 'a', outputAsset: { url: 'https://cdn/a.mp4' } },
					{ id: 'b', videoUrl: 'https://cdn/b.mp4' },
					{ id: 'c' },
				],
			}),
		).toEqual({
			id: 'job',
			clips: [
				{ id: 'a', outputAsset: { url: 'https://cdn/a.mp4' }, clipUrl: 'https://cdn/a.mp4' },
				{ id: 'b', videoUrl: 'https://cdn/b.mp4', clipUrl: 'https://cdn/b.mp4' },
				{ id: 'c' },
			],
		});
	});
});
