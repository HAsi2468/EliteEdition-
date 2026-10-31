/**
 * useSubmitLock – rapid-submission locker (React 18, TypeScript).
 *
 * Fixes the client half of BUG-053 (Fabric Challan burst: 5 POSTs in 72 ms -> 5 challans),
 * BUG-054 (White Fabric QA burst: 5 rows) and BUG-047 (QA double-click: 2 POSTs).
 * Live evidence: the SPA's api wrapper creates a NEW Idempotency-Key for every call
 * (crypto.randomUUID() per request), so 5 clicks = 5 distinct keys and the server could not dedupe.
 *
 * Contract
 *  1. In-flight ref lock: a synchronous ref check, so clicks inside the same frame (before React
 *     re-renders `disabled`) are dropped. State alone is NOT enough – it updates asynchronously.
 *  2. One Idempotency-Key per LOGICAL submission: created on the first attempt, REUSED on every retry
 *     (network error / timeout / 5xx), cleared only after success or when the payload changes.
 *  3. `disabled` / `pending` state for the button + aria-busy.
 *  4. Optional abort on unmount; no setState after unmount.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface SubmitContext {
  idempotencyKey: string;
  signal: AbortSignal;
  attempt: number; // 1 for first try of this logical submission, 2+ for user retries
}

export interface SubmitLockOptions {
  /** Minimum time the button stays disabled, to absorb a trailing double-click (ms). Default 400. */
  minLockMs?: number;
  /** Abort the request if the component unmounts. Default false (let the save finish). */
  abortOnUnmount?: boolean;
  /** Clear the key on 4xx responses (the user must change input anyway). Default true. */
  resetKeyOnClientError?: boolean;
}

export interface SubmitLock<P, R> {
  submit: (payload: P) => Promise<R | undefined>;
  pending: boolean;
  disabled: boolean;
  error: unknown;
  /** Current key (for logging / support). */
  currentKey: string | null;
  /** Forget the key, e.g. after the form is reset. */
  reset: () => void;
  /** Spread onto the submit button. */
  buttonProps: { disabled: boolean; 'aria-busy': boolean; 'aria-disabled': boolean };
}

export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (c && typeof c.getRandomValues === 'function') {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  throw new Error('No secure random source for Idempotency-Key');
}

/** Stable fingerprint so a CHANGED payload gets a NEW key, while an identical retry keeps the old one. */
export function fingerprint(value: unknown): string {
  const seen = new WeakSet<object>();
  const norm = (v: unknown): unknown => {
    if (v && typeof v === 'object') {
      if (seen.has(v as object)) return '[circular]';
      seen.add(v as object);
      if (Array.isArray(v)) return v.map(norm);
      if (v instanceof Date) return v.toISOString();
      return Object.keys(v as Record<string, unknown>).sort().reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = norm((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
    }
    return v;
  };
  return JSON.stringify(norm(value));
}

export class HttpError extends Error {
  constructor(public readonly status: number, message: string, public readonly body?: unknown) { super(message); }
}

export function useSubmitLock<P, R>(
  fn: (payload: P, ctx: SubmitContext) => Promise<R>,
  opts: SubmitLockOptions = {},
): SubmitLock<P, R> {
  const { minLockMs = 400, abortOnUnmount = false, resetKeyOnClientError = true } = opts;
  const inFlight = useRef(false);
  const keyRef = useRef<{ key: string; fp: string; attempt: number } | null>(null);
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (abortOnUnmount) controller.current?.abort();
    };
  }, [abortOnUnmount]);

  const submit = useCallback(async (payload: P): Promise<R | undefined> => {
    if (inFlight.current) return undefined; // synchronous guard: drops burst clicks in the same tick
    inFlight.current = true;
    const started = Date.now();
    setPending(true);
    setError(null);

    const fp = fingerprint(payload);
    if (!keyRef.current || keyRef.current.fp !== fp) keyRef.current = { key: newIdempotencyKey(), fp, attempt: 0 };
    keyRef.current.attempt += 1;
    const ctx: SubmitContext = {
      idempotencyKey: keyRef.current.key,
      attempt: keyRef.current.attempt,
      signal: (controller.current = new AbortController()).signal,
    };

    try {
      const result = await fnRef.current(payload, ctx);
      keyRef.current = null; // success: next submission is a new logical operation
      return result;
    } catch (e) {
      if (resetKeyOnClientError && e instanceof HttpError && e.status >= 400 && e.status < 500 && e.status !== 409 && e.status !== 408 && e.status !== 429) {
        keyRef.current = null; // validation error: user must change input, a new key is correct
      }
      // network error / timeout / 5xx / 409-in-progress: KEEP the key so the retry replays, never duplicates
      if (mounted.current) setError(e);
      return undefined;
    } finally {
      const wait = Math.max(0, minLockMs - (Date.now() - started));
      const release = () => {
        inFlight.current = false;
        if (mounted.current) setPending(false);
      };
      if (wait > 0) setTimeout(release, wait); else release();
    }
  }, [minLockMs, resetKeyOnClientError]);

  const reset = useCallback(() => { keyRef.current = null; setError(null); }, []);

  return {
    submit,
    pending,
    disabled: pending,
    error,
    currentKey: keyRef.current?.key ?? null,
    reset,
    buttonProps: { disabled: pending, 'aria-busy': pending, 'aria-disabled': pending },
  };
}

/**
 * fetch helper that sends the key and turns non-2xx into HttpError.
 * Server replays the stored response for a completed key; 409 means "still processing" – retry later with the SAME key.
 */
export async function postJson<T>(url: string, body: unknown, ctx: SubmitContext, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    signal: ctx.signal,
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': ctx.idempotencyKey, ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    const msg = (data as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
    throw new HttpError(res.status, msg, data);
  }
  return data as T;
}

/* Usage (Fabric Challan "Save Challan", BUG-053):
 *
 *   const { submit, buttonProps, error } = useSubmitLock((form: ChallanForm, ctx) =>
 *     postJson<Challan>('/v1/fabric-challan', form, ctx));            // endpoint not captured live – adjust
 *   <button type="button" {...buttonProps} onClick={() => submit(form)}>Save Challan</button>
 *
 * IMPORTANT: if the existing api wrapper f() is kept, pass ctx.idempotencyKey via
 * options.headers['Idempotency-Key'] – f() already honours a caller-supplied key and reuses it on its own retries.
 */
