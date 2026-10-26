import { hasSerpApi } from "../listen/serpapi";
import type { Connector } from "./types";

export const googleMapsConnector: Connector = {
  id: "GOOGLE_MAPS",
  name: "Google Maps reviews",
  family: "Google",
  docsUrl: "https://serpapi.com/google-maps-reviews-api",
  keyless: false,
  capabilities: [],
  isConfigured: () => hasSerpApi(),
  async search() {
    return [];
  },
};
