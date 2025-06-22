import { JellyfinAuth, makeAuthHeader } from "./users"

export type JellyfinGenre = {
  Id: string
  Name: string
}

export async function fetchGenres(
  server: URL,
  auth: JellyfinAuth
): Promise<JellyfinGenre[]> {
  const endpoint = new URL("Genres", server)
  endpoint.searchParams.append("userId", auth.User.Id)
  endpoint.searchParams.append("SortBy", "SortName")
  endpoint.searchParams.append("SortOrder", "Ascending")
  endpoint.searchParams.append("Recursive", "true")
  endpoint.searchParams.append("EnableTotalRecordCount", "false")
  endpoint.searchParams.append("IncludeItemTypes", "Movie,Series")

  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...makeAuthHeader(auth.AccessToken),
    },
  })

  if (!response.ok) {
    throw new Error("Failed to fetch genres: " + response.statusText)
  }

  const data = (await response.json()) as { Items: JellyfinGenre[] }
  return data.Items.map((genre) => ({
    Id: genre.Id,
    Name: genre.Name,
  }))
}
