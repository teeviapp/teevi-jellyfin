export type ImageQuality = "low" | "medium" | "high" | "original"
export type ImageType = "Primary" | "Backdrop" | "Logo"

export function makeImageURL(request: {
  server: URL
  itemId: string
  imageId: string
  type: ImageType
  quality: ImageQuality
}): string {
  const { server, itemId, imageId, quality, type } = request
  const endpoint = new URL(`Items/${itemId}/Images/${type}`, server)
  endpoint.searchParams.append("tag", imageId)

  switch (quality) {
    case "low":
      endpoint.searchParams.append("maxWidth", "200")
      endpoint.searchParams.append("quality", "70")
      break
    case "medium":
      endpoint.searchParams.append("maxWidth", "500")
      endpoint.searchParams.append("quality", "80")
      break
    case "high":
      endpoint.searchParams.append("maxWidth", "1000")
      endpoint.searchParams.append("quality", "90")
      break
    case "original":
      // No resizing or quality modifications for original images.
      break
  }

  return endpoint.toString()
}
