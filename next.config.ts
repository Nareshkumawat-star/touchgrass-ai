import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mongoose ships optional native-ish dependencies and dynamic requires; keeping
  // it external avoids bundling warnings and keeps the connection pool intact.
  serverExternalPackages: ["mongoose"],

  async headers() {
    return [
      {
        // The service worker must never be served stale, and it needs to be
        // allowed to control the whole origin.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Content-Type", value: "application/manifest+json; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
    ];
  },
};

export default nextConfig;
