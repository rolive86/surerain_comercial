import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: root,
  serverExternalPackages: ["pdfkit", "tesseract.js", "sharp", "jsqr"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "alewhpkjiktmvbugkcnn.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "unspqfzzmaqhbfhqtqax.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
