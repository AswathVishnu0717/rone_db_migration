import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

export const sourceDb = new Pool({
  connectionString: process.env.SOURCE_DB_URL,
});

export const targetDb = new Pool({
  connectionString: process.env.TARGET_DB_URL,
});
