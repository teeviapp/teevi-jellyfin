import { JellyfinAuth, makeAuthHeader } from "./users"

export type JellyfinSeason = {
  Id: string
  Name: string
  IndexNumber: number
}

export type JellyfinEpisode = {
  Id: string
  Name?: string
  IndexNumber: number
  RunTimeTicks?: number
  Overview?: string
  ImageTags?: {
    Primary?: string
  }
}

export async function fetchTVShowSeasons(
  server: URL,
  auth: JellyfinAuth,
  seriesId: String
): Promise<JellyfinSeason[]> {
  type SeasonsResponseData = {
    Items: JellyfinSeason[]
  }

  const endpoint = new URL(`Shows/${seriesId}/Seasons`, server)
  endpoint.searchParams.append("userId", auth.User.Id)

  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...makeAuthHeader(auth.AccessToken),
    },
  })

  if (!response.ok) {
    throw new Error("Failed to fetch seasons: " + response.statusText)
  }

  const data: SeasonsResponseData = await response.json()
  return data.Items.sort((a, b) => a.IndexNumber - b.IndexNumber)
}

export async function fetchTVShowEpisodes(
  server: URL,
  auth: JellyfinAuth,
  seriesId: string,
  seasonId: string
): Promise<JellyfinEpisode[]> {
  type EpisodesResponseData = {
    Items: JellyfinSeason[]
  }

  const endpoint = new URL(`Shows/${seriesId}/Episodes`, server)
  endpoint.searchParams.append("seasonId", seasonId)
  endpoint.searchParams.append("userId", auth.User.Id)
  endpoint.searchParams.append("Fields", "Overview")
  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...makeAuthHeader(auth.AccessToken),
    },
  })

  if (!response.ok) {
    throw new Error("Failed to fetch episodes: " + response.statusText)
  }

  const data: EpisodesResponseData = await response.json()
  return data.Items.sort((a, b) => a.IndexNumber - b.IndexNumber)
}
