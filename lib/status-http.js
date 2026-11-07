const dns = require("node:dns/promises");
const http = require("node:http");
const https = require("node:https");
const { isIP } = require("node:net");

const LIMITS = Object.freeze({
  timeoutMs: 5000,
  maxResponseBytes: 1024 * 1024,
  maxHeaderSize: 16 * 1024,
  maxUrlLength: 2048,
});

class StatusCheckError extends Error {
  constructor(code) {
    super("Não foi possível verificar o site com segurança.");
    this.name = "StatusCheckError";
    this.code = code;
  }
}

function addressNumber(address, family) {
  if (family === 4) {
    return address
      .split(".")
      .reduce((value, octet) => (value << 8n) + BigInt(octet), 0n);
  }

  // net.isIP validates the syntax first. Mapped/dotted IPv6 is never allowed.
  const [left, right] = address.split("::");
  const start = left ? left.split(":") : [];
  const end = right ? right.split(":") : [];
  const groups =
    right === undefined
      ? start
      : [...start, ...Array(8 - start.length - end.length).fill("0"), ...end];
  return groups.reduce(
    (value, group) => (value << 16n) + BigInt(`0x${group}`),
    0n,
  );
}

function inRange(value, base, prefix, bits) {
  const shift = BigInt(bits - prefix);
  return value >> shift === base >> shift;
}

// Conservative policy based on the IANA special-purpose registries. No DNS allowlist.
const BLOCKED_IPV4 = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
  // Azure host virtual IP is outside the private/link-local ranges.
  ["168.63.129.16", 32],
].map(([address, prefix]) => [addressNumber(address, 4), prefix]);

const BLOCKED_IPV6 = [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
].map(([address, prefix]) => [addressNumber(address, 6), prefix]);

function isPublicAddress(address) {
  if (typeof address !== "string" || address.includes("%")) return false;
  const family = isIP(address);
  if (!family) return false;
  if (family === 6 && address.includes(".")) return false;
  const value = addressNumber(address, family);
  if (family === 4) {
    return !BLOCKED_IPV4.some(([base, prefix]) =>
      inRange(value, base, prefix, 32),
    );
  }
  // Only ordinary global unicast. Reject mapped, translation, transition, ULA,
  // link-local, multicast, documentation and currently reserved IPv6 space.
  return (
    inRange(value, addressNumber("2000::", 6), 3, 128) &&
    !BLOCKED_IPV6.some(([base, prefix]) => inRange(value, base, prefix, 128))
  );
}

function normalizeUrl(input) {
  if (
    typeof input !== "string" ||
    !input.trim() ||
    input.length > LIMITS.maxUrlLength
  ) {
    throw new StatusCheckError("INVALID_URL");
  }
  const text = input.trim();
  if (/[\s\\\u0000-\u001f\u007f]/u.test(text) || text.startsWith("//")) {
    throw new StatusCheckError("INVALID_URL");
  }
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(text);
  const isHostPort = /^[^/?#:\s]+:\d+(?:[/?#]|$)/u.test(text);
  const candidate = hasScheme && !isHostPort ? text : `https://${text}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new StatusCheckError("INVALID_URL");
  }
  if (
    !/^https?:\/\/[^/?#]/i.test(candidate) ||
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    /^[^/]*\/\/[^/?#]*@/u.test(candidate)
  ) {
    throw new StatusCheckError("INVALID_URL");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.+$/, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new StatusCheckError("BLOCKED_ADDRESS");
  }
  return url;
}

function createStatusChecker({
  lookup = dns.lookup,
  httpRequest = http.request,
  httpsRequest = https.request,
  timeoutMs = LIMITS.timeoutMs,
  maxResponseBytes = LIMITS.maxResponseBytes,
} = {}) {
  return async function check(input) {
    const url = normalizeUrl(input);
    const hostname = url.hostname.replace(/^\[|\]$/g, "");

    return new Promise((resolve, reject) => {
      let request;
      let response;
      let settled = false;
      const finish = (error, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) {
          // Never retain a raw DNS/TLS/HTTP error, response body or Location.
          reject(new StatusCheckError(error));
          response?.destroy();
          request?.destroy();
        } else {
          resolve(result);
        }
      };
      // One deadline covers DNS, connection, TLS, headers and the entire body.
      const timer = setTimeout(() => finish("TIMEOUT"), timeoutMs);

      const start = async () => {
        let addresses;
        const literalFamily = isIP(hostname);
        if (literalFamily) {
          addresses = [{ address: hostname, family: literalFamily }];
        } else {
          try {
            addresses = await lookup(hostname, { all: true, verbatim: true });
          } catch {
            finish("DNS_ERROR");
            return;
          }
        }
        // A late resolver cannot start a request after the deadline.
        if (settled) return;
        if (!Array.isArray(addresses) || !addresses.length) {
          finish("DNS_ERROR");
          return;
        }
        if (
          addresses.some(
            (record) =>
              !record ||
              !isPublicAddress(record.address) ||
              isIP(record.address) !== record.family,
          )
        ) {
          finish("BLOCKED_ADDRESS");
          return;
        }

        const { address, family } = addresses[0];
        const transport =
          url.protocol === "https:" ? httpsRequest : httpRequest;
        // Connect to a numeric validated IP, never the hostname: no second DNS
        // lookup/rebinding. Preserve HTTP virtual host and TLS certificate/SNI.
        request = transport(
          {
            protocol: url.protocol,
            hostname: address,
            family,
            port: url.port || (url.protocol === "https:" ? 443 : 80),
            method: "GET",
            path: url.pathname + url.search,
            headers: { Host: url.host, "Accept-Encoding": "identity" },
            servername: literalFamily ? "" : hostname,
            rejectUnauthorized: true,
            // One-use agent: no shared sockets or environment/global-agent proxy.
            agent: false,
            maxHeaderSize: LIMITS.maxHeaderSize,
          },
          (incoming) => {
            response = incoming;
            response.on("error", () => finish("CONNECTION_ERROR"));
            response.on("aborted", () => finish("CONNECTION_ERROR"));
            response.on("close", () => {
              if (!response.complete) finish("CONNECTION_ERROR");
            });
            if (settled) {
              response.destroy();
              return;
            }
            let bytes = 0;
            if (Number(response.headers["content-length"]) > maxResponseBytes) {
              finish("RESPONSE_TOO_LARGE");
              return;
            }
            // Stream and discard raw bytes; no decompression, parsing or buffering.
            response.on("data", (chunk) => {
              bytes += chunk.length;
              if (bytes > maxResponseBytes) finish("RESPONSE_TOO_LARGE");
            });
            response.on("end", () => {
              if (!response.complete) {
                finish("CONNECTION_ERROR");
                return;
              }
              // Native HTTP never follows redirects; even Location is ignored.
              finish(null, { status: response.statusCode, origin: url.origin });
            });
          },
        );
        request.on("error", () => finish("CONNECTION_ERROR"));
        // A protocol upgrade is not a site status response we can consume.
        request.on("upgrade", (_incoming, socket) => {
          socket.destroy();
          finish("CONNECTION_ERROR");
        });
        request.end();
      };
      start().catch(() => finish("CONNECTION_ERROR"));
    });
  };
}

const checkStatus = createStatusChecker();
module.exports = {
  checkStatus,
  createStatusChecker,
  isPublicAddress,
  normalizeUrl,
  StatusCheckError,
  LIMITS,
};
