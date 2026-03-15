/**
 * Drops the entire MongoDB database used by the app.
 * Run: npm run db:reset   (or: node scripts/drop-database.js)
 * Requires: Node 18+, .env.local with MONGODB_URI (and optional MONGODB_DB_NAME).
 *
 * After running, you'll need to create a user again via scripts/seed-user.js.
 */

const major = parseInt(process.version.slice(1).split(".")[0], 10);
if (major < 18) {
  console.error("Node 18+ required. Current:", process.version);
  process.exit(1);
}

require("./load-env.js");

const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "sethu";

if (!uri) {
  console.error("Missing MONGODB_URI. Set it in .env.local");
  process.exit(1);
}

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    await db.dropDatabase();
    console.log(`Dropped database: ${dbName}`);
    console.log("You can now use the app; sign up again to create a new user.");
  } catch (err) {
    console.error("Failed to drop database:", err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
