import mongoose from 'mongoose';

export async function connectDatabase(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, autoIndex: process.env.NODE_ENV !== 'production' });
}
export async function disconnectDatabase() { await mongoose.disconnect(); }
export function isDatabaseReady() { return mongoose.connection.readyState === 1; }
