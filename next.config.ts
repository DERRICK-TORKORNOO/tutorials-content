import { version } from "./package.json";
import type { NextConfig } from "next";
const config: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: version },
  async headers() {
    return ["/sw.js", "/sw-assets.js"].map((source) => ({
      source,
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      ],
    }));
  },
};
export default config;
