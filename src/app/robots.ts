import type { MetadataRoute } from "next";
import { PUBLIC_LEGAL_PATHS } from "@/lib/public-paths";
import { publicAppUrl } from "@/lib/urls";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/signup", ...PUBLIC_LEGAL_PATHS],
      },
      {
        userAgent: "facebookexternalhit",
        allow: "/",
      },
      {
        userAgent: "Facebot",
        allow: "/",
      },
    ],
    host: publicAppUrl(),
  };
}
