// Jellyfin default ports
const JF_HTTP_PORT = 8096
const JF_HTTPS_PORT = 8920
// Standard HTTP/HTTPS ports
const DEFAULT_HTTP_PORT = 80
const DEFAULT_HTTPS_PORT = 443

type ServerCandidate = {
  url: URL
  score: number
}

type PublicSystemInfo = {
  LocalAddress: string
  Version: string
  ServerName: string
  Id: string
}

export type JellyfinServer = {
  address: string
}

export async function findServer(input: string): Promise<JellyfinServer> {
  // Generate possible server URL candidates from user input
  const candidates = findServerCandidates(input)
  if (candidates.length === 0) {
    throw new Error(
      `No valid server candidates found for input: "${input}". Please verify the URL format.`
    )
  }

  // Try to connect to each candidate and get server info
  const info = await fetchPublicSystemInfo(candidates)
  if (!info) {
    throw new Error(
      `No server found for input "${input}". Please verify the URL format and try again.`
    )
  }

  // Ensure the server address ends with a slash
  const normalizedAddress = info.LocalAddress.endsWith("/")
    ? info.LocalAddress
    : info.LocalAddress + "/"

  return {
    address: normalizedAddress,
  }
}

async function fetchPublicSystemInfo(
  servers: string[]
): Promise<PublicSystemInfo | undefined> {
  // Try each server candidate until one responds successfully
  for (const server of servers) {
    try {
      const endpoint = new URL("System/Info/Public", server)

      const response = await fetch(endpoint.toString())
      if (response.ok) {
        const info: PublicSystemInfo = await response.json()
        return info
      }
    } catch (error) {
      // Silently continue to next candidate if this one fails
    }
  }
}

function findServerCandidates(input: string): string[] {
  const url = new URL(normalizeUrlForJellyfin(input))

  // If protocol and port are already specified, use as-is
  if (url.protocol && url.port) {
    return [url.toString()]
  }

  const candidates: ServerCandidate[] = []

  // Add standard HTTP/HTTPS port candidates
  candidates.push(createServerCandidate(url, "http:", DEFAULT_HTTP_PORT))
  candidates.push(createServerCandidate(url, "https:", DEFAULT_HTTPS_PORT))

  // Add Jellyfin-specific port candidates based on protocol
  if (url.protocol === "http:") {
    candidates.push(createServerCandidate(url, "http:", JF_HTTP_PORT))
  } else if (url.protocol === "https:") {
    candidates.push(createServerCandidate(url, "https:", JF_HTTP_PORT))
    candidates.push(createServerCandidate(url, "https:", JF_HTTPS_PORT))
  }

  // Sort candidates by score (best first) and return URLs
  return candidates
    .sort((a, b) => a.score - b.score)
    .map((c) => c.url.toString())
}

function createServerCandidate(
  url: URL,
  protocol: "http:" | "https:",
  defaultPort: number
): ServerCandidate {
  function getDefaultPort(protocol: string): number {
    if (protocol === "http:") {
      return DEFAULT_HTTP_PORT
    } else if (protocol === "https:") {
      return DEFAULT_HTTPS_PORT
    } else {
      throw new Error("Invalid protocol")
    }
  }

  // Clone the URL and set the specified protocol and port
  const candidate = new URL(url.toString())
  candidate.protocol = protocol
  if (!candidate.port) {
    candidate.port = String(defaultPort)
  }

  // Calculate priority score (lower is better)
  // Prefer secure connections
  let score = protocol === "https:" ? 5 : -5

  // Prefer default ports for http(s) protocols
  if (
    candidate.port === "" ||
    candidate.port === getDefaultPort(protocol).toString()
  ) {
    score += 3 // Standard ports get bonus
  } else if (url.port === JF_HTTP_PORT.toString()) {
    score += 2 // Jellyfin HTTP port is common
  } else if (url.port === JF_HTTPS_PORT.toString()) {
    score -= 1 // Jellyfin HTTPS port is less common
  }

  return { url: candidate, score }
}

function normalizeUrlForJellyfin(urlString: string): string {
  // Remove leading/trailing whitespace
  urlString = urlString.trim()

  // Block unsupported protocols for security
  if (/^(data:|view-source:)/i.test(urlString)) {
    throw new Error("Unsupported URL protocol")
  }

  // Add http:// protocol if missing or if URL starts with "//"
  if (!/^(https?:)?\/\//i.test(urlString)) {
    urlString = "http://" + urlString
  } else if (/^\/\//.test(urlString)) {
    urlString = "http:" + urlString
  }

  let urlObject: URL
  try {
    urlObject = new URL(urlString)
  } catch {
    throw new Error("Invalid URL")
  }

  // Normalize pathname: remove duplicate slashes and decode URI components
  if (urlObject.pathname) {
    const simplifiedPath = decodeURI(urlObject.pathname.replace(/\/{2,}/g, "/"))
    // Ensure pathname always ends with a slash
    urlObject.pathname = simplifiedPath.endsWith("/")
      ? simplifiedPath
      : simplifiedPath + "/"
  }

  // Remove trailing dot from hostname if present
  if (urlObject.hostname) {
    urlObject.hostname = urlObject.hostname.replace(/\.$/, "")
  }

  // Ensure protocol and hostname are lowercase
  urlObject.protocol = urlObject.protocol.toLowerCase()
  urlObject.hostname = urlObject.hostname.toLowerCase()

  return urlObject.toString()
}
