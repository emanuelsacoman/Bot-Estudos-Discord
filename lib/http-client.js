const axios = require("axios");

const HTTP_TIMEOUT_MS = 5000;
// Local resource budget for metadata JSON, matching /status's 1 MiB body
// budget. This is an application policy, not a limit of the remote APIs.
const HTTP_MAX_BODY_BYTES = 1024 * 1024;

class HttpRequestError extends Error {
  constructor(code, status) {
    super("Não foi possível concluir a consulta HTTP.");
    this.name = "HttpRequestError";
    this.code = code;
    // Only the status is needed by /moeda's existing 404 branch. Never carry
    // response bodies, headers, URLs, request configuration or an error cause.
    if (Number.isInteger(status) && status >= 100 && status <= 599) {
      this.response = { status };
    }
  }
}

async function withHttpTimeout(operation, timeoutMs = HTTP_TIMEOUT_MS) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new HttpRequestError("HTTP_TIMEOUT"));
      controller.abort();
    }, timeoutMs);
  });
  // Race also bounds a transport that fails to settle after cancellation. Both
  // promises have rejection handlers, including late failures after timeout.
  const work = Promise.resolve().then(() => operation(controller.signal));
  try {
    return await Promise.race([work, deadline]);
  } catch (error) {
    if (error instanceof HttpRequestError) throw error;
    throw new HttpRequestError(
      controller.signal.aborted ? "HTTP_TIMEOUT" : "HTTP_REQUEST_FAILED",
      error?.response?.status,
    );
  } finally {
    clearTimeout(timer);
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
} = {}) {
  return {
    getJson(url, options = {}) {
      return withHttpTimeout(async (signal) => {
        const response = await axiosGet(url, {
          ...options,
          timeout: timeoutMs,
          signal,
          // Axios's Node adapter counts decompressed bytes before JSON parsing.
          // Force buffered JSON so options cannot bypass the body budget via stream.
          responseType: "json",
          maxContentLength: HTTP_MAX_BODY_BYTES,
          maxBodyLength: HTTP_MAX_BODY_BYTES,
        });
        return { status: response.status, data: response.data };
      }, timeoutMs);
    },
    fetchJson(url, options = {}) {
      return withHttpTimeout(async (signal) => {
        const response = await fetchRequest(url, { ...options, signal });
        const data = await readBoundedJson(response, signal);
        return { status: response.status, data };
      }, timeoutMs);
    },
  };
}

const { getJson, fetchJson } = createHttpClient();
module.exports = {
  getJson,
  fetchJson,
  createHttpClient,
  withHttpTimeout,
  HTTP_TIMEOUT_MS,
  HTTP_MAX_BODY_BYTES,
  HttpRequestError,
};
