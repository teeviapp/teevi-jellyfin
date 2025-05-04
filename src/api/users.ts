import { jellyfin } from "./client-info"

export type JellyfinAuth = {
  AccessToken: string
  User: {
    Id: string
  }
}

export async function authenticateWithCredentials(
  server: URL,
  credentials: { username: string; password: string }
): Promise<JellyfinAuth> {
  const endpoint = new URL("Users/AuthenticateByName", server.toString())

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...makeAuthHeader(),
    },
    body: JSON.stringify({
      Username: credentials.username,
      Pw: credentials.password,
    }),
  })

  if (!response.ok) {
    throw new Error("Authentication failed" + response.statusText)
  }

  const data = await response.json()
  return {
    AccessToken: data.AccessToken,
    User: {
      Id: data.User.Id,
    },
  }
}

export function makeAuthHeader(token?: string): HeadersInit {
  const headerComponents = [
    `MediaBrowser Client="${jellyfin.client.name}"`,
    `Device="${jellyfin.device.name}"`,
    `DeviceId="${jellyfin.device.id}"`,
    `Version="${jellyfin.client.version}"`,
  ]

  if (token) {
    headerComponents.push(`Token="${token}"`)
  }

  return {
    Authorization: headerComponents.join(", "),
  }
}
