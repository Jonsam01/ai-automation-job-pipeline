
/**
 * Shared job shape and safe HTTP fetch utility.
 *
 * Every job source uses makeJob() to produce a consistent job structure.
 * Every API fetcher uses safeGet() for:
 * - URL query parameter handling
 * - Request timeouts
 * - HTTP error handling
 * - Network failure handling
 */

export function makeJob(fields = {}) {
  const job = {
    title: "",
    company: "",
    location: "",
    employmentType: "",
    link: "",
    description: "",
    source: "",
    ...fields,
  };

  // Keep memory usage manageable while retaining enough text
  // for location filtering and AI automation skill scoring.
  job.description = String(job.description ?? "").slice(0, 12000);

  return job;
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; job-pipeline-bot/1.0; personal use)",
  Accept: "application/json",
};

// Maximum time allowed for one individual API request.
const REQUEST_TIMEOUT_MS = 15000;

export async function safeGet(url, params = {}) {
  let requestUrl;

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    requestUrl = new URL(url);

    // Only allow normal HTTP and HTTPS requests.
    if (!["http:", "https:"].includes(requestUrl.protocol)) {
      throw new Error("Only HTTP and HTTPS URLs are supported.");
    }

    // Append query parameters safely.
    for (const [key, value] of Object.entries(params || {})) {
      if (value === undefined || value === null) continue;

      requestUrl.searchParams.set(key, String(value));
    }

    const response = await fetch(requestUrl.toString(), {
      method: "GET",
      headers: HEADERS,
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(
        `[fetchers] ${requestUrl.origin}${requestUrl.pathname} returned HTTP ${response.status}`,
      );

      return null;
    }

    return response;
  } catch (error) {
    const message =
      error.name === "AbortError"
        ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms`
        : error.message || String(error);

    const endpoint = requestUrl
      ? `${requestUrl.origin}${requestUrl.pathname}`
      : String(url);

    console.warn(
      `[fetchers] Request to ${endpoint} failed: ${message}`,
    );

    return null;
  } finally {
    clearTimeout(timeout);
  }
}
