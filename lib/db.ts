import mongoose from "mongoose";

type MongoGlobal = typeof globalThis & {
  _mongoPromise?: Promise<typeof mongoose>;
};

const globalMongo = globalThis as MongoGlobal;

export const connectDB = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing");
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!globalMongo._mongoPromise) {
    globalMongo._mongoPromise = mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    }).catch((error) => {
      globalMongo._mongoPromise = undefined;
      throw error;
    });
  }
  return globalMongo._mongoPromise;
};
