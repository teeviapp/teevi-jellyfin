import { JellyfinAuth, makeAuthHeader } from "./users"

export type JellyfinItem = {
  Id: string
  Name: string
  Type: "Movie" | "Series"
  PremiereDate?: string
  ProductionYear?: number
  Genres?: string[]
  Overview?: string
  Taglines?: string[]
  ImageTags?: {
    Primary?: string
    Logo?: string
  }
  BackdropImageTags?: string[]
  RunTimeTicks?: number
  CommunityRating?: number
  CriticRating?: number
}

export async function fetchItems(
  server: URL,
  auth: JellyfinAuth,
  filters: {
    collectionId?: string
    searchTerm?: string
    isFavorite?: boolean
    genreId?: string
  }
): Promise<JellyfinItem[]> {
  type CollectionResponseData = {
    Items: JellyfinItem[]
  }

  const endpoint = new URL(`Users/${auth.User.Id}/Items`, server)
  endpoint.searchParams.append("Recursive", "true")
  endpoint.searchParams.append("SortBy", "Name")
  endpoint.searchParams.append("SortOrder", "Descending")
  endpoint.searchParams.append(
    "enableImageTypes",
    "Primary,Backdrop,Logo,Banner"
  )

  endpoint.searchParams.append("Fields", "Genres,Overview,Taglines")

  if (filters.isFavorite && filters.isFavorite === true) {
    endpoint.searchParams.append("Filters", "IsFavorite")
  }
  if (filters.searchTerm) {
    endpoint.searchParams.append("searchTerm", filters.searchTerm)
  }
  if (filters.collectionId) {
    endpoint.searchParams.append("ParentId", filters.collectionId)
  }
  if (filters.genreId) {
    endpoint.searchParams.append("GenreIds", filters.genreId)
  }

  // endpoint.searchParams.append("Filters", "IsNotFolder")
  // endpoint.searchParams.append("MediaTypes", "Video")
  endpoint.searchParams.append("IncludeItemTypes", "Movie,Series")
  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...makeAuthHeader(auth.AccessToken),
    },
  })

  if (!response.ok) {
    throw new Error("Failed to fetch collection: " + response.statusText)
  }

  const data: CollectionResponseData = await response.json()
  return data.Items.filter(({ Type }) => Type === "Movie" || Type === "Series")
}

export async function fetchSimilarItems(
  server: URL,
  auth: JellyfinAuth,
  itemId: string
): Promise<JellyfinItem[]> {
  const endpoint = new URL(`Items/${itemId}/Similar`, server)
  endpoint.searchParams.append("userId", auth.User.Id)
  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...makeAuthHeader(auth.AccessToken),
    },
  })

  if (!response.ok) {
    throw new Error("Failed to fetch similar items: " + response.statusText)
  }

  const data: { Items: JellyfinItem[] } = await response.json()

  return data.Items.filter(({ Type }) => Type === "Movie" || Type === "Series")
}

export async function fetchItem(
  server: URL,
  auth: JellyfinAuth,
  itemId: string
): Promise<JellyfinItem> {
  const endpoint = new URL(`Users/${auth.User.Id}/Items/${itemId}`, server)
  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...makeAuthHeader(auth.AccessToken),
    },
  })

  if (!response.ok) {
    throw new Error("Failed to fetch show: " + response.statusText)
  }

  return response.json()
}
