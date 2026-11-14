const axios = require("axios");

const HTTP_TIMEOUT_MS = 5000;
// Local resource budget for metadata JSON, matching /status's 1 MiB body
// budget. This is an application policy, not a limit of the remote APIs.
const HTTP_MAX_BODY_BYTES = 1024 * 1024;
const RATE_LIMIT_FALLBACK_MS = 60 * 1000;
const MAX_RATE_LIMIT_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_ORIGINS = new Set([
  "https://api.github.com",
  "https://translate.googleapis.com",
  "https://api.exchangerate-api.com",
  "https://httpstat.us",
]);
const STACK_EXCHANGE_SCOPE = "https://api.stackexchange.com/2.3/search";

class HttpRequestError extends Error {
  constructor(code, status, retryAfterMs) {
    super("Não foi possível concluir a consulta HTTP.");
    this.name = "HttpRequestError";
    this.code = code;
    // Only allowlisted numbers cross this boundary, never bodies, headers,
    // URLs, request configuration or an error cause.
    if (Number.isInteger(status) && status >= 100 && status <= 599) {
      this.response = { status };
    }
    if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
      this.retryAfterMs = Math.min(retryAfterMs, MAX_RATE_LIMIT_MS);
    }
  }
}

function headerValue(headers, name) {
  const value = headers?.get?.(name) ?? headers?.[name];
  return typeof value === "string" || typeof value === "number"
    ? String(value).slice(0, 128)
    : undefined;
}

function statusError(status, headers, now = Date.now()) {
  if (!Number.isInteger(status) || status < 100 || status > 599) {
    return new HttpRequestError("HTTP_INVALID_BODY");
  }
  const retry = headerValue(headers, "retry-after");
  const retryMs = retry
    ? /^\d+$/.test(retry)
      ? Number(retry) * 1000
      : Date.parse(retry) - now
    : NaN;
  const remaining = headerValue(headers, "x-ratelimit-remaining");
  const limited =
    status === 429 || (status === 403 && (remaining === "0" || retryMs >= 0));
  if (!limited) return new HttpRequestError("HTTP_STATUS_ERROR", status);
  const reset = headerValue(headers, "x-ratelimit-reset");
  const resetMs =
    reset && /^\d+$/.test(reset) ? Number(reset) * 1000 - now : NaN;
  const delay =
    Number.isFinite(retryMs) && retryMs > 0
      ? retryMs
      : Number.isFinite(resetMs) && resetMs > 0
        ? resetMs
        : RATE_LIMIT_FALLBACK_MS;
  return new HttpRequestError("HTTP_RATE_LIMITED", status, delay);
}

function normalizeError(error, now = Date.now()) {
  if (error instanceof HttpRequestError) return error;
  if (["ECONNABORTED", "ETIMEDOUT"].includes(error?.code)) {
    return new HttpRequestError("HTTP_TIMEOUT");
  }
  if (error?.code === "ERR_CANCELED" || error?.name === "AbortError") {
    return new HttpRequestError("HTTP_CANCELLED");
  }
  if (
    error?.code === "ERR_BAD_RESPONSE" &&
    typeof error.message === "string" &&
    error.message.includes("maxContentLength size")
  ) {
    return new HttpRequestError("HTTP_RESPONSE_TOO_LARGE");
  }
  if (error?.response?.status !== undefined) {
    return statusError(error.response.status, error.response.headers, now);
  }
  return new HttpRequestError("HTTP_REQUEST_FAILED");
}

async function withHttpTimeout(
  operation,
  timeoutMs = HTTP_TIMEOUT_MS,
  externalSignal,
) {
  if (externalSignal?.aborted) throw new HttpRequestError("HTTP_CANCELLED");
  const controller = new AbortController();
  let timer;
  let onCancel;
  const cancellation = new Promise((_, reject) => {
    onCancel = () => {
      reject(new HttpRequestError("HTTP_CANCELLED"));
      controller.abort();
    };
    externalSignal?.addEventListener("abort", onCancel, { once: true });
  });
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new HttpRequestError("HTTP_TIMEOUT"));
      controller.abort();
    }, timeoutMs);
  });
  // Race also bounds a transport that fails to settle after cancellation. Both
  // promises have rejection handlers, including late failures after timeout.
  const work = Promise.resolve().then(() => {
    if (controller.signal.aborted) throw new HttpRequestError("HTTP_CANCELLED");
    return operation(controller.signal);
  });
  try {
    return await Promise.race([work, deadline, cancellation]);
  } catch (error) {
    throw normalizeError(error);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onCancel);
  }
}

function cancelReader(reader) {
  try {
    // Cancellation must not extend the total deadline or create a late rejection.
    Promise.resolve(reader.cancel()).catch(() => {});
  } catch {}
}

async function readBoundedJson(response, signal) {
  const reader = response.body?.getReader?.();
  if (!reader) throw new HttpRequestError("HTTP_INVALID_BODY");
  let cancelled = false;
  const cancel = () => {
    if (!cancelled) {
      cancelled = true;
      cancelReader(reader);
    }
  };
  let rejectAbort;
  const aborted = new Promise((_, reject) => {
    rejectAbort = reject;
  });
  // Install a handler even when the advertised length fails before the first read.
  aborted.catch(() => {});
  const onAbort = () => {
    cancel();
    rejectAbort(new HttpRequestError("HTTP_TIMEOUT"));
  };
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    if (signal.aborted) {
      onAbort();
      throw new HttpRequestError("HTTP_TIMEOUT");
    }
    const length = response.headers?.get?.("content-length");
    if (
      length &&
      /^\d+$/.test(length) &&
      BigInt(length) > BigInt(HTTP_MAX_BODY_BYTES)
    ) {
      throw new HttpRequestError("HTTP_RESPONSE_TOO_LARGE");
    }
    // One bounded allocation also avoids retaining a separate object for every
    // tiny chunk an upstream response might produce.
    const bytes = Buffer.allocUnsafe(HTTP_MAX_BODY_BYTES);
    let total = 0;
    while (true) {
      const { done, value } = await Promise.race([reader.read(), aborted]);
      if (done) break;
      if (!(value instanceof Uint8Array))
        throw new HttpRequestError("HTTP_INVALID_BODY");
      if (total + value.byteLength > HTTP_MAX_BODY_BYTES)
        throw new HttpRequestError("HTTP_RESPONSE_TOO_LARGE");
      bytes.set(value, total);
      total += value.byteLength;
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(0, total),
    );
    return JSON.parse(text);
  } catch (error) {
    cancel();
    if (error instanceof SyntaxError || error instanceof TypeError) {
      throw new HttpRequestError("HTTP_INVALID_BODY");
    }
    throw error;
  } finally {
    signal.removeEventListener("abort", onAbort);
    try {
      reader.releaseLock();
    } catch {}
  }
}

function createHttpClient({
  axiosGet = (...args) => axios.get(...args),
  fetch: fetchRequest = (...args) => globalThis.fetch(...args),
  timeoutMs = HTTP_TIMEOUT_MS,
  now = () => Date.now(),
} = {}) {
  // A fixed set of provider scopes bounds memory independently of user input.
  // Pauses reject new work immediately; there are no queues, sleeps or retries.
  const pausedUntil = new Map();
  const scopeFor = (url) => {
    try {
      const parsed = new URL(url);
      if (
        parsed.origin === "https://api.stackexchange.com" &&
        parsed.pathname === "/2.3/search"
      )
        return STACK_EXCHANGE_SCOPE;
      return RATE_LIMIT_ORIGINS.has(parsed.origin) ? parsed.origin : undefined;
    } catch {
      return undefined;
    }
  };
  const pause = (scope, duration) => {
    if (!scope || !Number.isFinite(duration) || duration <= 0) return;
    pausedUntil.set(
      scope,
      Math.max(
        pausedUntil.get(scope) ?? 0,
        now() + Math.min(duration, MAX_RATE_LIMIT_MS),
      ),
    );
  };
  const checkPause = (scope) => {
    const until = pausedUntil.get(scope);
    if (until === undefined) return;
    if (until > now()) {
      throw new HttpRequestError("HTTP_RATE_LIMITED", undefined, until - now());
    }
    pausedUntil.delete(scope);
  };
  const validateStatus = (status, accepts, headers) => {
    if (
      !Number.isInteger(status) ||
      status < 100 ||
      status > 599 ||
      !accepts(status)
    ) {
      throw statusError(status, headers, now());
    }
  };
  const parseJson = (data) => {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
      return JSON.parse(text);
    } catch {
      throw new HttpRequestError("HTTP_INVALID_BODY");
    }
  };
  const request = async (url, options, operation) => {
    const scope = scopeFor(url);
    checkPause(scope);
    try {
      return await withHttpTimeout(
        async (signal) => {
          try {
            return await operation(signal);
          } catch (error) {
            throw normalizeError(error, now());
          }
        },
        timeoutMs,
        options.signal,
      );
    } catch (error) {
      if (error.code === "HTTP_RATE_LIMITED") pause(scope, error.retryAfterMs);
      throw error;
    }
  };
  return {
    pauseStackExchange(seconds) {
      if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 86400) {
        throw new HttpRequestError("HTTP_INVALID_BODY");
      }
      pause(STACK_EXCHANGE_SCOPE, seconds * 1000);
    },
    getJson(url, options = {}) {
      const accepts =
        options.validateStatus ?? ((status) => status >= 200 && status < 300);
      const checkStatus = (status, headers) => {
        // Stack Exchange's HTTP 400 wrapper must remain available to /question.
        // A transport-level quota signal needs no error body to be recognized.
        if (
          scopeFor(url) === STACK_EXCHANGE_SCOPE &&
          [403, 429].includes(status)
        ) {
          const error = statusError(status, headers, now());
          if (error.code === "HTTP_RATE_LIMITED") throw error;
        }
        validateStatus(status, accepts, headers);
      };
      return request(url, options, async (signal) => {
        const response = await axiosGet(url, {
          ...options,
          timeout: timeoutMs,
          signal,
          // Read bounded bytes and decode strictly; Axios's default JSON mode
          // silently accepts malformed JSON and replacement UTF-8 characters.
          responseType: "arraybuffer",
          maxContentLength: HTTP_MAX_BODY_BYTES,
          maxBodyLength: HTTP_MAX_BODY_BYTES,
          maxRedirects: 0,
          transformResponse: [
            function (data, headers, status) {
              checkStatus(status, headers);
              return parseJson(data);
            },
          ],
        });
        checkStatus(response.status, response.headers);
        return { status: response.status, data: response.data };
      });
    },
    fetchJson(url, options = {}) {
      return request(url, options, async (signal) => {
        const response = await fetchRequest(url, {
          ...options,
          signal,
          redirect: "manual",
        });
        try {
          validateStatus(
            response.status,
            (status) => status >= 200 && status < 300,
            response.headers,
          );
        } catch (error) {
          // Cancel without reading an error body, even if cancellation rejects.
          try {
            Promise.resolve(response.body?.cancel?.()).catch(() => {});
          } catch {}
          throw error;
        }
        const data = await readBoundedJson(response, signal);
        return { status: response.status, data };
      });
    },
  };
}

const { getJson, fetchJson, pauseStackExchange } = createHttpClient();
module.exports = {
  getJson,
  fetchJson,
  pauseStackExchange,
  createHttpClient,
  withHttpTimeout,
  HTTP_TIMEOUT_MS,
  HTTP_MAX_BODY_BYTES,
  RATE_LIMIT_FALLBACK_MS,
  MAX_RATE_LIMIT_MS,
  HttpRequestError,
};
