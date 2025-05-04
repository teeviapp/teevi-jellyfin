import { JellyfinAuth, makeAuthHeader } from "./users"

export type JellyfinView = {
  Id: string
  Name: string
  CollectionType: "tvshows" | "movies"
}

export async function fetchViews(
  server: URL,
  auth: JellyfinAuth
): Promise<JellyfinView[]> {
  type CollectionsResponseData = {
    Items: JellyfinView[]
  }

  const endpoint = new URL(`UserViews`, server)
  endpoint.searchParams.append("userId", auth.User.Id)

  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...makeAuthHeader(auth.AccessToken),
    },
  })

  if (!response.ok) {
    throw new Error("Failed to fetch library: " + response.statusText)
  }

  const data: CollectionsResponseData = await response.json()
  return data.Items.filter(({ CollectionType }) =>
    ["tvshows", "movies"].includes(CollectionType)
  ).map(({ Id, Name, CollectionType }) => ({
    Id,
    Name,
    CollectionType,
  }))
}
