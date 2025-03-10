import { sourceDb, targetDb } from "./db";
import * as fs from "fs";
import { execSync } from "child_process";

// List of tables to migrate
const tables = [
  "programs",
  "regions", 
  "projects",
  "chargers_inventory",
  "projects_to_assignees_mapping",
  "projects_work_group_mapping",
  "work_packs",
  "work_packs_to_assignees_mapping",
  "sub_tasks",
  "work_pack_history",
  "work_pack_activities",
  "work_pack_activities_attachments", 
  "work_pack_history_attachments",
  "work_group_default_subtasks",
  "work_group_default_templates",
  "station_attachments_v2",
  "archived_attachments",
  "attachments",
  "alert_mappings",
  "connector_status",
  "closure_info",
  "alerts",
  "master_chargers"
];

// Check if pg_dump and psql exist
function checkPgTools() {
  try {
    execSync("pg_dump --version", { stdio: "ignore" });
    execSync("psql --version", { stdio: "ignore" });
  } catch (error) {
    console.error("❌ pg_dump or psql is not installed. Install PostgreSQL tools first.");
    process.exit(1);
  }
}

// Drop table if exists
async function dropTable(table: string) {
  try {
    console.log(`🔸 Dropping table ${table} if exists...`);
    await targetDb.query(`DROP TABLE IF EXISTS rone_db."${table}" CASCADE;`);
    console.log(`✅ Table ${table} dropped if existed`);
  } catch (error) {
    console.error(`❌ Error dropping table ${table}:`, error);
    throw error;
  }
}

// Create table structure without constraints
async function createTable(table: string) {
  try {
    console.log(`🔸 Creating table ${table}...`);
    const { rows: [{ create_table_ddl }] } = await sourceDb.query(`
      SELECT 'CREATE TABLE rone_db."' || $1 || '" (' || 
        string_agg(
          quote_ident(column_name) || ' ' || 
          CASE 
            WHEN data_type = 'USER-DEFINED' THEN 'text'
            ELSE data_type 
          END || 
          ' NULL', 
          ', '
        ) || ');' as create_table_ddl
      FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
      GROUP BY table_name;
    `, [table]);
    await targetDb.query(create_table_ddl);
    console.log(`✅ Table ${table} created`);
  } catch (error) {
    console.error(`❌ Error creating table ${table}:`, error);
    throw error;
  }
}

// Disable constraints before migration
async function disableConstraints(table: string) {
  try {
    console.log(`🔸 Disabling constraints for ${table}...`);
    await targetDb.query(`ALTER TABLE rone_db."${table}" DISABLE TRIGGER ALL;`);
    console.log(`✅ Constraints disabled for ${table}`);
  } catch (error) {
    console.error(`❌ Error disabling constraints for ${table}:`, error);
    throw error; // Re-throw to stop migration on error
  }
}

// Get data from source DB
async function getSourceData(table: string) {
  try {
    console.log(`🔹 Getting data for ${table}...`);
    const { rows } = await sourceDb.query(`SELECT * FROM public.${table}`);
    console.log(`✅ Successfully retrieved ${rows.length} rows from ${table}`);
    return rows;
  } catch (error) {
    console.error(`❌ Error getting data for ${table}:`, error);
    throw error;
  }
}

// Insert data into target DB
async function insertData(table: string, data: any[]) {
  try {
    console.log(`🔹 Inserting data for ${table}...`);
    
    for (const row of data) {
      const columns = Object.keys(row).map(col => quote_ident(col)).join(', ');
      const values = Object.values(row);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      
      await targetDb.query(
        `INSERT INTO rone_db."${table}" (${columns}) VALUES (${placeholders})`,
        values
      );
    }

    console.log(`✅ Successfully inserted data into ${table}`);
  } catch (error) {
    console.error(`❌ Error inserting data for ${table}:`, error);
    throw error;
  }
}

// Re-enable constraints after migration
async function enableConstraints(table: string) {
  try {
    console.log(`🔸 Re-enabling constraints for ${table}...`);
    await targetDb.query(`ALTER TABLE rone_db."${table}" ENABLE TRIGGER ALL;`);
    console.log(`✅ Constraints enabled for ${table}`);
  } catch (error) {
    console.error(`❌ Error re-enabling constraints for ${table}:`, error);
    throw error; // Re-throw to stop migration on error
  }
}

// Helper function to properly quote identifiers
function quote_ident(identifier: string) {
  return `"${identifier}"`;
}

// Migrate tables with constraints ignored
async function migrateTables() {
  try {
    checkPgTools();

    for (const table of tables) {
      console.log(`\n🔷🔷🔷 Processing table: ${table} 🔷🔷🔷\n`);
      await dropTable(table);
      await createTable(table);
      await disableConstraints(table);
      const data = await getSourceData(table);
      await insertData(table, data);
      await enableConstraints(table);
    }

    console.log("\n✅✅✅ Migration completed successfully! ✅✅✅");
  } catch (error) {
    console.error("\n❌❌❌ Migration failed! ❌❌❌");
    process.exit(1);
  } finally {
    await sourceDb.end();
    await targetDb.end();
  }
}

// Run the migration
migrateTables();
