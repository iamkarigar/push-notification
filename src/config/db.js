import { MongoClient } from "mongodb";

const ANALYTICS_MONGO_URL = process.env.ANALYTICS_MONGO_URL;
if (!ANALYTICS_MONGO_URL) {
  throw new Error("ANALYTICS_MONGO_URL is required");
}

let client = null;

export async function connectDb() {
  if (client) return client;
  client = new MongoClient(ANALYTICS_MONGO_URL);
  await client.connect();
  return client;
}

/** TEAM database, users collection (uses same Mongo server as ANALYTICS_MONGO_URL). */
export function getTeamUsersCollection() {
  if (!client) throw new Error("DB not connected");
  return client.db("TEAM").collection("users");
}
