import type { MetadataRoute } from "next";

/** Demo site: nothing may be crawled. Pilot: public pages may be found, the app itself not. */
export default function robots(): MetadataRoute.Robots {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/app", "/api", "/umat", "/masuk", "/setup"] } };
}
