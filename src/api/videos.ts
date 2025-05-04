export function makeVideoUrl(
  server: URL,
  itemId: string,
  options: {
    supportsDirectStream: boolean
    container?: string
  }
): string {
  const url = new URL(`Videos/${itemId}/stream`, server)

  if (options.container) {
    url.pathname += `.${options.container}`
  }

  if (options.supportsDirectStream) {
    url.searchParams.set("Static", "true")
  }

  return url.toString()
}
