const axios = require("axios");

const HTTP_TIMEOUT_MS = 5000;

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
        });
        return { status: response.status, data: response.data };
      }, timeoutMs);
    },
    fetchJson(url, options = {}) {
      return withHttpTimeout(async (signal) => {
        const response = await fetchRequest(url, { ...options, signal });
        const data = await response.json();
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
  HttpRequestError,
};
