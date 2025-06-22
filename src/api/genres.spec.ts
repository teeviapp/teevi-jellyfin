import { describe, it, expect } from "vitest"
import { fetchGenres } from "./genres"
import { authenticateWithCredentials } from "./users"
import { findServer } from "./system"

describe("fetchGenres", async () => {
  const server = await findServer("demo.jellyfin.org/stable")
  const url = new URL(server.address)
  const auth = await authenticateWithCredentials(url, {
    username: "demo",
    password: "",
  })

  it("should return genres on successful fetch", async () => {
    const genres = await fetchGenres(url, auth)
    expect(genres).toBeDefined()
    console.log("Fetched genres:", genres)
  })
})
