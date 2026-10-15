import mongoose from "mongoose";

// Reuse one connection across hot reloads and route invocations.
const globalForMongo = globalThis as unknown as { _vgMongo?: Promise<typeof mongoose> };

export class DatabaseUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Database unavailable");
    this.name = "DatabaseUnavailableError";
    this.cause = cause;
  }
}

export async function connectDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new DatabaseUnavailableError("MONGODB_URI is not set");
  if (!globalForMongo._vgMongo) {
    mongoose.set("strictQuery", true);
    globalForMongo._vgMongo = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 })
      .catch((err) => {
        globalForMongo._vgMongo = undefined;
        throw new DatabaseUnavailableError(err);
      });
  }
  return globalForMongo._vgMongo;
}

export async function disconnectDB() {
  if (globalForMongo._vgMongo) {
    await mongoose.disconnect();
    globalForMongo._vgMongo = undefined;
  }
}
