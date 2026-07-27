import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStore } from './store.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createStore — reading and writing', () => {
    it('starts from a copy of the initial state', () => {
        const initial = { a: 1 };
        const store = createStore(initial);
        expect(store.getState()).toEqual({ a: 1 });
        store.setState({ a: 2 });
        expect(initial.a).toBe(1); // caller's object untouched
    });

    it('merges a patch instead of replacing state', () => {
        const store = createStore({ a: 1, b: 2 });
        store.setState({ b: 3 });
        expect(store.getState()).toEqual({ a: 1, b: 3 });
    });

    it('accepts a reducer and merges its result', () => {
        const store = createStore({ count: 1 });
        store.setState(s => ({ count: s.count + 1 }));
        expect(store.getState().count).toBe(2);
    });

    it('ignores a patch that returns nothing', () => {
        const store = createStore({ a: 1 });
        store.setState(() => undefined);
        expect(store.getState()).toEqual({ a: 1 });
    });

    it('returns the state from setState', () => {
        const store = createStore({ a: 1 });
        expect(store.setState({ a: 2 })).toBe(store.getState());
    });

    it('keeps the state object identity stable across writes', () => {
        const store = createStore({ a: 1 });
        const first = store.getState();
        store.setState({ a: 2 });
        expect(store.getState()).toBe(first);
    });
});

describe('createStore — subscribers', () => {
    it('notifies every subscriber on write, with the state', () => {
        const store = createStore({ a: 1 });
        const one = vi.fn();
        const two = vi.fn();
        store.subscribe(one);
        store.subscribe(two);
        store.setState({ a: 2 });
        expect(one).toHaveBeenCalledTimes(1);
        expect(two).toHaveBeenCalledTimes(1);
        expect(one).toHaveBeenCalledWith(store.getState());
    });

    it('notifies once per write, not once per changed key', () => {
        const store = createStore({ a: 1, b: 1 });
        const listener = vi.fn();
        store.subscribe(listener);
        store.setState({ a: 2, b: 2 });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stops notifying after unsubscribe', () => {
        const store = createStore({ a: 1 });
        const listener = vi.fn();
        const off = store.subscribe(listener);
        store.setState({ a: 2 });
        off();
        store.setState({ a: 3 });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not notify when nothing is written', () => {
        const store = createStore({ a: 1 });
        const listener = vi.fn();
        store.subscribe(listener);
        expect(listener).not.toHaveBeenCalled();
    });
});

describe('createStore — debounced persistence', () => {
    it('does not persist until the debounce elapses', () => {
        const persist = vi.fn();
        const store = createStore({ a: 1 }, { persist });
        store.setState({ a: 2 });
        expect(persist).not.toHaveBeenCalled();
        vi.advanceTimersByTime(999);
        expect(persist).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(persist).toHaveBeenCalledTimes(1);
    });

    it('persists once per burst, not once per write', () => {
        const persist = vi.fn();
        const store = createStore({ a: 0 }, { persist });
        for (let i = 1; i <= 10; i++) {
            store.setState({ a: i });
            vi.advanceTimersByTime(50);
        }
        vi.advanceTimersByTime(1000);
        expect(persist).toHaveBeenCalledTimes(1);
        expect(persist).toHaveBeenCalledWith(store.getState());
    });

    it('persists again for a burst that starts after the first settles', () => {
        const persist = vi.fn();
        const store = createStore({ a: 0 }, { persist });
        store.setState({ a: 1 });
        vi.advanceTimersByTime(1000);
        store.setState({ a: 2 });
        vi.advanceTimersByTime(1000);
        expect(persist).toHaveBeenCalledTimes(2);
    });

    it('honours a custom debounce window', () => {
        const persist = vi.fn();
        const store = createStore({ a: 1 }, { persist, debounceMs: 50 });
        store.setState({ a: 2 });
        vi.advanceTimersByTime(50);
        expect(persist).toHaveBeenCalledTimes(1);
    });

    it('works without a persist function', () => {
        const store = createStore({ a: 1 });
        expect(() => {
            store.setState({ a: 2 });
            vi.advanceTimersByTime(2000);
        }).not.toThrow();
    });

    it('reports a rejected persist instead of throwing', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const persist = vi.fn().mockRejectedValue(new Error('quota exceeded'));
        const store = createStore({ a: 1 }, { persist });
        store.setState({ a: 2 });
        await vi.advanceTimersByTimeAsync(1000);
        expect(persist).toHaveBeenCalled();
        expect(error).toHaveBeenCalledWith('Auto-save failed:', expect.any(Error));
        error.mockRestore();
    });

    it('reports a persist that throws synchronously', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const store = createStore(
            { a: 1 },
            {
                persist: () => {
                    throw new Error('boom');
                },
            }
        );
        store.setState({ a: 2 });
        await vi.advanceTimersByTimeAsync(1000);
        expect(error).toHaveBeenCalledWith('Auto-save failed:', expect.any(Error));
        error.mockRestore();
    });
});

describe('createStore — flush and cancel', () => {
    it('flush persists immediately and cancels the pending debounce', async () => {
        const persist = vi.fn();
        const store = createStore({ a: 1 }, { persist });
        store.setState({ a: 2 });
        await store.flush();
        expect(persist).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(2000);
        expect(persist).toHaveBeenCalledTimes(1); // not run twice
    });

    it('flush works with nothing pending', async () => {
        const persist = vi.fn();
        const store = createStore({ a: 1 }, { persist });
        await store.flush();
        expect(persist).toHaveBeenCalledTimes(1);
    });

    it('cancelPendingSave drops the pending write', () => {
        const persist = vi.fn();
        const store = createStore({ a: 1 }, { persist });
        store.setState({ a: 2 });
        store.cancelPendingSave();
        vi.advanceTimersByTime(2000);
        expect(persist).not.toHaveBeenCalled();
    });

    it('cancelPendingSave is safe with nothing pending', () => {
        const store = createStore({ a: 1 }, { persist: vi.fn() });
        expect(() => store.cancelPendingSave()).not.toThrow();
    });
});
