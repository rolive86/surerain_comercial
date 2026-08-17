import type { MetadataRoute } from "next";

/** Preview-only stage: do not index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
