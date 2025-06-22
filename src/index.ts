import {
  TeeviFeedCollection,
  TeeviFeedExtension,
  TeeviMetadataExtension,
  TeeviShow,
  TeeviShowEntry,
  TeeviShowEpisode,
  TeeviShowSeason,
  TeeviVideoAsset,
  TeeviVideoExtension,
} from "@teeviapp/core"
import { makeImageURL } from "./api/images"
import { findServer } from "./api/system"
import { authenticateWithCredentials, JellyfinAuth } from "./api/users"
import { fetchItem, fetchItems, JellyfinItem } from "./api/items"
import { fetchViews } from "./api/user-views"
import { fetchTVShowSeasons, fetchTVShowEpisodes } from "./api/tv-shows"
import { fetchMediaSource } from "./api/media-info"
import { makeVideoUrl } from "./api/videos"
import { fetchGenres } from "./api/genres"

type Jellyfin = {
  server: URL
  auth: JellyfinAuth
}

async function requireJellyfin(): Promise<Jellyfin> {
  const input = {
    server: Teevi.getInputValueById("server"),
    username: Teevi.getInputValueById("username"),
    password: Teevi.getInputValueById("password") ?? "",
  }

  if (!input.server || !input.username) {
    throw new Error("Server and username are required")
  }

  const cachedInput = localStorage.getItem("jellyfin.auth.input")
  const cachedAuth = localStorage.getItem("jellyfin.auth.response")
  const cachedServerAddress = localStorage.getItem(
    "jellyfin.auth.server.address"
  )

  if (
    cachedInput &&
    cachedAuth &&
    cachedServerAddress &&
    cachedInput === JSON.stringify(input)
  ) {
    return {
      server: new URL(cachedServerAddress),
      auth: JSON.parse(cachedAuth),
    }
  }

  const server = await findServer(input.server)
  const url = new URL(server.address)
  const auth = await authenticateWithCredentials(url, {
    username: input.username,
    password: input.password,
  })

  localStorage.setItem("jellyfin.auth.input", JSON.stringify(input))
  localStorage.setItem("jellyfin.auth.server.address", server.address)
  localStorage.setItem("jellyfin.auth.response", JSON.stringify(auth))

  return { server: url, auth }
}

function mapJellyfinItemToTeeviShowEntry(
  item: JellyfinItem,
  server: URL
): TeeviShowEntry {
  return {
    kind: item.Type === "Movie" ? "movie" : "series",
    id: item.Id,
    title: item.Name,
    posterURL: item.ImageTags?.Primary
      ? makeImageURL({
          server: server,
          itemId: item.Id,
          imageId: item.ImageTags.Primary,
          type: "Primary",
          quality: "medium",
        })
      : undefined,
  }
}

async function fetchShowsByQuery(query: string): Promise<TeeviShowEntry[]> {
  const jellyfin = await requireJellyfin()
  const items = await fetchItems(jellyfin.server, jellyfin.auth, {
    searchTerm: query,
  })

  return items.map((item) => ({
    kind: item.Type === "Movie" ? "movie" : "series",
    id: item.Id,
    title: item.Name,
    posterURL: item.ImageTags?.Primary
      ? makeImageURL({
          server: jellyfin.server,
          itemId: item.Id,
          imageId: item.ImageTags.Primary,
          type: "Primary",
          quality: "medium",
        })
      : undefined,
    year: item.PremiereDate
      ? new Date(item.PremiereDate).getFullYear()
      : item.ProductionYear,
  }))
}

async function fetchShow(showId: string): Promise<TeeviShow> {
  const jellyfin = await requireJellyfin()
  const show = await fetchItem(jellyfin.server, jellyfin.auth, showId)

  let seasons: TeeviShowSeason[] | undefined
  if (show.Type === "Series") {
    const fetchedSeasons = await fetchTVShowSeasons(
      jellyfin.server,
      jellyfin.auth,
      show.Id
    )
    seasons = fetchedSeasons
      .filter((season) => season.IndexNumber !== undefined)
      .map((season) => ({
        name: season.Name,
        number: season.IndexNumber!,
      }))
  }

  return {
    kind: show.Type === "Movie" ? "movie" : "series",
    id: show.Id,
    title: show.Name,
    overview: show.Overview ?? "",
    releaseDate: show.PremiereDate
      ? new Date(show.PremiereDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    genres: show.Genres ?? [],
    duration: show.RunTimeTicks
      ? Math.round(show.RunTimeTicks / 10_000_000)
      : 0,
    posterURL: show.ImageTags?.Primary
      ? makeImageURL({
          server: jellyfin.server,
          itemId: show.Id,
          imageId: show.ImageTags.Primary,
          type: "Primary",
          quality: "high",
        })
      : undefined,
    backdropURL: show.BackdropImageTags?.[0]
      ? makeImageURL({
          server: jellyfin.server,
          itemId: show.Id,
          imageId: show.BackdropImageTags[0],
          type: "Backdrop",
          quality: "high",
        })
      : undefined,
    logoURL: show.ImageTags?.Logo
      ? makeImageURL({
          server: jellyfin.server,
          itemId: show.Id,
          imageId: show.ImageTags.Logo,
          type: "Logo",
          quality: "high",
        })
      : undefined,
    seasons: seasons,
    rating: show.CommunityRating,
  }
}

async function fetchEpisodes(
  showId: string,
  season: number
): Promise<TeeviShowEpisode[]> {
  const jellyfin = await requireJellyfin()
  const seasons = await fetchTVShowSeasons(
    jellyfin.server,
    jellyfin.auth,
    showId
  )
  const seasonId = seasons.find((s) => s.IndexNumber === season)?.Id
  if (!seasonId) {
    throw new Error(`Season ${season} not found`)
  }
  const episodes = await fetchTVShowEpisodes(
    jellyfin.server,
    jellyfin.auth,
    showId,
    seasonId
  )
  return episodes.map((episode) => ({
    id: episode.Id,
    number: episode.IndexNumber,
    title: episode.Name,
    thumbnailURL: episode.ImageTags?.Primary
      ? makeImageURL({
          server: jellyfin.server,
          itemId: episode.Id,
          imageId: episode.ImageTags.Primary,
          type: "Primary",
          quality: "medium",
        })
      : undefined,
    overview: episode.Overview ?? "",
    duration: episode.RunTimeTicks
      ? Math.round(episode.RunTimeTicks / 10_000_000)
      : 0,
  }))
}

async function fetchFeedCollections(): Promise<TeeviFeedCollection[]> {
  const jellyfin = await requireJellyfin()
  const collections = await fetchViews(jellyfin.server, jellyfin.auth)
  const genres = await fetchGenres(jellyfin.server, jellyfin.auth)

  let feedCollections: TeeviFeedCollection[] = []

  for (const collection of collections) {
    const items = await fetchItems(jellyfin.server, jellyfin.auth, {
      collectionId: collection.Id,
    })
    const shows: TeeviShowEntry[] = items.map((item) =>
      mapJellyfinItemToTeeviShowEntry(item, jellyfin.server)
    )
    feedCollections.push({
      id: collection.Id,
      name: collection.Name,
      shows,
    })
  }

  // Add genres as separate collections
  for (const genre of genres) {
    const items = await fetchItems(jellyfin.server, jellyfin.auth, {
      genreId: genre.Id,
    })
    const shows: TeeviShowEntry[] = items.map((item) =>
      mapJellyfinItemToTeeviShowEntry(item, jellyfin.server)
    )
    feedCollections.push({
      id: `genre-${genre.Id}`,
      name: genre.Name,
      shows,
    })
  }

  return feedCollections
}

async function fetchTrendingShows(): Promise<TeeviShow[]> {
  const jellyfin = await requireJellyfin()
  const trendingItems = await fetchItems(jellyfin.server, jellyfin.auth, {
    isFavorite: true, // Assuming trending shows are marked as favorites
  })

  return trendingItems.map((item) => ({
    kind: item.Type === "Movie" ? "movie" : "series",
    id: item.Id,
    title: item.Name,
    posterURL: item.ImageTags?.Primary
      ? makeImageURL({
          server: jellyfin.server,
          itemId: item.Id,
          imageId: item.ImageTags.Primary,
          type: "Primary",
          quality: "high",
        })
      : undefined,
    backdropURL: item.BackdropImageTags?.[0]
      ? makeImageURL({
          server: jellyfin.server,
          itemId: item.Id,
          imageId: item.BackdropImageTags[0],
          type: "Backdrop",
          quality: "high",
        })
      : undefined,
    logoURL: item.ImageTags?.Logo
      ? makeImageURL({
          server: jellyfin.server,
          itemId: item.Id,
          imageId: item.ImageTags.Logo,
          type: "Logo",
          quality: "high",
        })
      : undefined,
    overview: item.Taglines?.[0] ?? item.Overview ?? "",
    releaseDate: item.PremiereDate
      ? new Date(item.PremiereDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    genres: item.Genres ?? [],
    duration: item.RunTimeTicks
      ? Math.round(item.RunTimeTicks / 10_000_000)
      : 0,
  }))
}

async function fetchVideoAssets(mediaId: string): Promise<TeeviVideoAsset[]> {
  const jellyfin = await requireJellyfin()
  const media = await fetchMediaSource(jellyfin.server, jellyfin.auth, mediaId)

  const asset: TeeviVideoAsset = {
    url: makeVideoUrl(jellyfin.server, media.Id, {
      supportsDirectStream: media.SupportsDirectStream,
      container: media.Container,
    }),
  }

  return [asset]
}

export default {
  fetchShowsByQuery,
  fetchShow,
  fetchEpisodes,
  fetchFeedCollections,
  fetchTrendingShows,
  fetchVideoAssets,
} satisfies TeeviMetadataExtension & TeeviFeedExtension & TeeviVideoExtension
