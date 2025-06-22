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

import { findServer } from "./api/system"
import { authenticateWithCredentials, JellyfinAuth } from "./api/users"
import {
  fetchItem,
  fetchItems,
  fetchSimilarItems,
  JellyfinItem,
} from "./api/items"
import { fetchViews } from "./api/user-views"
import {
  fetchTVShowSeasons,
  fetchTVShowEpisodes,
  JellyfinEpisode,
} from "./api/tv-shows"
import { fetchMediaSource } from "./api/media-info"
import { fetchGenres } from "./api/genres"
import { ImageQuality, ImageType, makeImageURL } from "./api/images"
import { makeVideoUrl } from "./api/videos"

// Types
interface Jellyfin {
  server: URL
  auth: JellyfinAuth
}

interface JellyfinCredentials {
  server: string
  username: string
  password: string
}

// Constants
const STORAGE_KEYS = {
  AUTH_INPUT: "jellyfin.auth.input",
  AUTH_RESPONSE: "jellyfin.auth.response",
  SERVER_ADDRESS: "jellyfin.auth.server.address",
}

// Authentication and session management

/**
 * Authenticates with Jellyfin server and returns server and auth information
 * Caches credentials to avoid unnecessary re-authentication
 */
async function requireJellyfin(): Promise<Jellyfin> {
  const input: JellyfinCredentials = {
    server: Teevi.getInputValueById("server") ?? "",
    username: Teevi.getInputValueById("username") ?? "",
    password: Teevi.getInputValueById("password") ?? "",
  }

  // Validate input
  if (!input.server || !input.username) {
    throw new Error("Server and Username are required")
  }

  // Try to use cached credentials
  const cachedCredentials = tryGetCachedCredentials(input)
  if (cachedCredentials) {
    return cachedCredentials
  }

  // Authenticate with fresh credentials
  return authenticateAndCacheCredentials(input)
}

/**
 * Attempts to retrieve cached credentials if they match the input
 */
function tryGetCachedCredentials(input: JellyfinCredentials): Jellyfin | null {
  const cachedInput = localStorage.getItem(STORAGE_KEYS.AUTH_INPUT)
  const cachedAuth = localStorage.getItem(STORAGE_KEYS.AUTH_RESPONSE)
  const cachedServerAddress = localStorage.getItem(STORAGE_KEYS.SERVER_ADDRESS)

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

  return null
}

/**
 * Authenticates with Jellyfin server and caches the credentials
 */
async function authenticateAndCacheCredentials(
  input: JellyfinCredentials
): Promise<Jellyfin> {
  const server = await findServer(input.server)
  const url = new URL(server.address)
  const auth = await authenticateWithCredentials(url, {
    username: input.username,
    password: input.password,
  })

  // Cache credentials
  localStorage.setItem(STORAGE_KEYS.AUTH_INPUT, JSON.stringify(input))
  localStorage.setItem(STORAGE_KEYS.SERVER_ADDRESS, server.address)
  localStorage.setItem(STORAGE_KEYS.AUTH_RESPONSE, JSON.stringify(auth))

  return { server: url, auth }
}

// Mapping functions - Convert Jellyfin entities to Teevi entities

function mapJellyfinItemToTeeviShowEntry(
  item: JellyfinItem,
  server: URL
): TeeviShowEntry {
  return {
    kind: item.Type === "Movie" ? "movie" : "series",
    id: item.Id,
    title: item.Name,
    posterURL: getImageUrlIfAvailable({
      imageTag: item.ImageTags?.Primary,
      server: server,
      itemId: item.Id,
      type: "Primary",
      quality: "medium",
    }),
    year: getYear(item),
  }
}

/**
 * Maps a Jellyfin item to a full Teevi show
 */
function mapJellyfinItemToTeeviShow(
  item: JellyfinItem,
  server: URL
): TeeviShow {
  return {
    kind: item.Type === "Movie" ? "movie" : "series",
    id: item.Id,
    title: item.Name,
    overview: item.Overview ?? "",
    releaseDate: getFormattedReleaseDate(item),
    genres: item.Genres ?? [],
    duration: calculateDuration(item.RunTimeTicks),
    posterURL: getImageUrlIfAvailable({
      imageTag: item.ImageTags?.Primary,
      server: server,
      itemId: item.Id,
      type: "Primary",
      quality: "high",
    }),
    backdropURL: getImageUrlIfAvailable({
      imageTag: item.BackdropImageTags?.[0],
      server: server,
      itemId: item.Id,
      type: "Backdrop",
      quality: "high",
    }),
    logoURL: getImageUrlIfAvailable({
      imageTag: item.ImageTags?.Logo,
      server: server,
      itemId: item.Id,
      type: "Logo",
      quality: "high",
    }),
    rating: item.CommunityRating,
  }
}

/**
 * Maps a Jellyfin episode to a Teevi episode
 */
function mapJellyfinEpisodeToTeeviEpisode(
  episode: JellyfinEpisode,
  server: URL
): TeeviShowEpisode {
  return {
    id: episode.Id,
    number: episode.IndexNumber,
    title: episode.Name,
    thumbnailURL: getImageUrlIfAvailable({
      imageTag: episode.ImageTags?.Primary,
      server: server,
      itemId: episode.Id,
      type: "Primary",
      quality: "medium",
    }),
    overview: episode.Overview ?? "",
    duration: calculateDuration(episode.RunTimeTicks),
  }
}

// Helper functions

function getYear(item: JellyfinItem): number | undefined {
  if (item.PremiereDate) {
    return new Date(item.PremiereDate).getFullYear()
  }
  return item.ProductionYear
}

function getFormattedReleaseDate(item: JellyfinItem): string {
  if (item.PremiereDate) {
    return new Date(item.PremiereDate).toISOString().split("T")[0]
  }
  return new Date().toISOString().split("T")[0]
}

function calculateDuration(runTimeTicks?: number): number {
  if (!runTimeTicks) return 0
  return Math.round(runTimeTicks / 10_000_000)
}

function getImageUrlIfAvailable(options: {
  imageTag: string | undefined
  server: URL
  itemId: string
  type: ImageType
  quality: ImageQuality
}): string | undefined {
  const { imageTag, server, itemId, type, quality } = options
  if (!imageTag) return undefined

  return makeImageURL({
    server,
    itemId,
    imageId: imageTag,
    type: type,
    quality: quality,
  })
}

async function fetchShowsByQuery(query: string): Promise<TeeviShowEntry[]> {
  const jellyfin = await requireJellyfin()
  const items = await fetchItems(jellyfin.server, jellyfin.auth, {
    searchTerm: query,
  })

  return items.map((item) =>
    mapJellyfinItemToTeeviShowEntry(item, jellyfin.server)
  )
}

async function fetchShow(showId: string): Promise<TeeviShow> {
  const jellyfin = await requireJellyfin()
  const show = await fetchItem(jellyfin.server, jellyfin.auth, showId)
  const teeviShow = mapJellyfinItemToTeeviShow(show, jellyfin.server)

  // Add seasons if it's a TV show
  if (show.Type === "Series") {
    teeviShow.seasons = await fetchShowSeasons(jellyfin, show.Id)
  }

  try {
    const similar = await fetchSimilarItems(
      jellyfin.server,
      jellyfin.auth,
      show.Id
    )
    teeviShow.relatedShows = similar.map((item) =>
      mapJellyfinItemToTeeviShowEntry(item, jellyfin.server)
    )
  } catch (error) {
    console.error("Failed to fetch similar shows:", error)
    teeviShow.relatedShows = []
  }

  return teeviShow
}

async function fetchShowSeasons(
  jellyfin: Jellyfin,
  showId: string
): Promise<TeeviShowSeason[] | undefined> {
  const fetchedSeasons = await fetchTVShowSeasons(
    jellyfin.server,
    jellyfin.auth,
    showId
  )

  return fetchedSeasons
    .filter((season) => season.IndexNumber !== undefined)
    .map((season) => ({
      name: season.Name,
      number: season.IndexNumber!,
    }))
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

  return episodes.map((episode) =>
    mapJellyfinEpisodeToTeeviEpisode(episode, jellyfin.server)
  )
}

async function fetchFeedCollections(): Promise<TeeviFeedCollection[]> {
  const jellyfin = await requireJellyfin()
  const collections = await fetchViews(jellyfin.server, jellyfin.auth)
  const genres = await fetchGenres(jellyfin.server, jellyfin.auth)

  let feedCollections: TeeviFeedCollection[] = []

  // If no genres are available, use collections as the main feed
  if (genres.length == 0) {
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
  }

  // Add genres as collections
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
  const favoriteItems = await fetchItems(jellyfin.server, jellyfin.auth, {
    isFavorite: true, // Assuming trending shows are marked as favorites
  })

  return favoriteItems.map((item) => {
    let show = mapJellyfinItemToTeeviShow(item, jellyfin.server)
    show.overview = item.Taglines?.[0] ?? show.overview
    return show
  })
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
