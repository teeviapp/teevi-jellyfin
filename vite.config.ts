import { UserConfig } from "vite"
import teevi from "@teeviapp/vite"

export default {
  plugins: [
    teevi({
      name: "Jellyfin",
      capabilities: ["metadata", "feed", "video"],
      inputs: [
        { id: "server", name: "Server URL", required: true },
        { id: "username", name: "Username", required: true },
        { id: "password", name: "Password", required: false },
      ],
    }),
  ],
} satisfies UserConfig
