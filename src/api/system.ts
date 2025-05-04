const JF_HTTP_PORT = 8096
const JF_HTTPS_PORT = 8920
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
  const candidates = findServerCandidates(input)
  if (candidates.length === 0) {
    throw new Error("No server candidates found")
  }
  const info = await fetchPublicSystemInfo(candidates)
  if (!info) {
    throw new Error("No server found")
  }
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
  for (const server of servers) {
    try {
      const response = await fetch(`${server}/System/Info/Public`)
      if (response.ok) {
        const info: PublicSystemInfo = await response.json()
        return info
      }
    } catch (error) {}
  }
}

function findServerCandidates(input: string): string[] {
  const url = new URL(normalizeUrl(input))

  if (url.protocol && url.port) {
    return [url.toString()]
  }

  const candidates: ServerCandidate[] = []

  candidates.push(createServerCandidate(url, "http:", DEFAULT_HTTP_PORT))
  candidates.push(createServerCandidate(url, "https:", DEFAULT_HTTPS_PORT))

  if (url.protocol === "http:") {
    candidates.push(createServerCandidate(url, "http:", JF_HTTP_PORT))
  } else if (url.protocol === "https:") {
    candidates.push(createServerCandidate(url, "https:", JF_HTTP_PORT))
    candidates.push(createServerCandidate(url, "https:", JF_HTTPS_PORT))
  }

  // Sort candidates by score
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

  // Clone the URL and enforce the protocol and default port if not set
  const candidate = new URL(url.toString())
  candidate.protocol = protocol
  if (!candidate.port) {
    candidate.port = String(defaultPort)
  }

  // Prefer secure connections
  let score = protocol === "https:" ? 5 : -5

  // Prefer default ports for http(s) protocols
  if (
    candidate.port === "" ||
    candidate.port === getDefaultPort(protocol).toString()
  ) {
    score += 3
  } else if (url.port === JF_HTTP_PORT.toString()) {
    score += 2 // Using the Jellyfin http port is common
  } else if (url.port === JF_HTTPS_PORT.toString()) {
    score -= 1 // Using the Jellyfin https port is not common
  }

  return { url: candidate, score }
}

function normalizeUrl(urlString: string): string {
  // Rimuove eventuali spazi bianchi iniziali/finali
  urlString = urlString.trim()

  // Verifica e blocca protocolli non supportati
  if (/^(data:|view-source:)/i.test(urlString)) {
    throw new Error("Unsupported URL protocol")
  }

  // Se manca il protocollo o l'URL inizia con "//", aggiunge "http://"
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

  // Rimuove hash e query params per normalizzare l'URL
  //urlObject.hash = ""
  //urlObject.search = ""

  // Normalizza il pathname: rimuove slash duplicati, decodifica i componenti URI e rimuove lo slash finale (eccetto quando è l'unico carattere)
  if (urlObject.pathname) {
    const simplifiedPath = decodeURI(urlObject.pathname.replace(/\/{2,}/g, "/"))
    urlObject.pathname =
      simplifiedPath !== "/"
        ? simplifiedPath.replace(/\/$/, "")
        : simplifiedPath
  }

  // Rimuove un eventuale punto finale nel nome host
  if (urlObject.hostname) {
    urlObject.hostname = urlObject.hostname.replace(/\.$/, "")
  }

  // Assicura che protocollo e hostname siano in minuscolo
  urlObject.protocol = urlObject.protocol.toLowerCase()
  urlObject.hostname = urlObject.hostname.toLowerCase()

  return urlObject.toString()
}
