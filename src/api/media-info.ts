import { JellyfinAuth, makeAuthHeader } from "./users"

export type JellyfinMediaSource = {
  Id: string
  Container?: string
  SupportsTranscoding: boolean
  SupportsDirectStream: boolean
  SupportsDirectPlay: boolean
}

export async function fetchMediaSource(
  server: URL,
  auth: JellyfinAuth,
  itemId: string
): Promise<JellyfinMediaSource> {
  type PlaybackInfoResponseData = {
    MediaSources: JellyfinMediaSource[]
  }

  const endpoint = new URL(`Items/${itemId}/PlaybackInfo`, server)
  endpoint.searchParams.append("userId", auth.User.Id)

  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...makeAuthHeader(auth.AccessToken),
    },
  })

  if (!response.ok) {
    throw new Error("Failed to fetch playback info: " + response.statusText)
  }

  const data: PlaybackInfoResponseData = await response.json()
  if (!data.MediaSources || data.MediaSources.length === 0) {
    throw new Error("No media sources found")
  }

  return data.MediaSources[0]
}
