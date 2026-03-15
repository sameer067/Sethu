/**
 * Create the first user in MongoDB (phone + password).
 * Run: node scripts/seed-user.js
 * Requires: MONGODB_URI and optionally PHONE, PASSWORD env vars.
 * Example: PHONE=9876543210 PASSWORD=secret123 node scripts/seed-user.js
 */

const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");

const uri = process.env.MONGODB_URI;
const phone = process.env.PHONE || "9876543210";
const password = process.env.PASSWORD || "changeme";

if (!uri) {
  console.error("Set MONGODB_URI in the environment.");
  process.exit(1);
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || "sethu");
  const existing = await db.collection("users").findOne({ phone });
  if (existing) {
    console.log("User with this phone already exists. Exiting.");
    await client.close();
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await db.collection("users").insertOne({
    phone,
    passwordHash,
    name: null,
    createdAt: new Date(),
  });
  console.log("User created. Phone:", phone);
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
