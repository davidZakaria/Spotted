import IORedis from "ioredis";
import { appConfig } from "./config";

let connection: IORedis | null = null;

export function getRedis() {
  if (!connection) {
    connection = new IORedis(appConfig.redisUrl, { maxRetriesPerRequest: null });
  }
  return connection;
}
