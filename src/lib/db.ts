import { MongoClient, type Db } from "mongodb"

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

export function getClientPromise(): Promise<MongoClient> {
  if (global._mongoClientPromise) {
    return global._mongoClientPromise
  }
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error("MONGODB_URI is not set")
  }
  const client = new MongoClient(uri)
  global._mongoClientPromise = client.connect()
  return global._mongoClientPromise
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise()
  return client.db(process.env.MONGODB_DB ?? "doit")
}
