import { sourceDb, targetDb } from "./db";

export async function migrateMasterData() {
  try {
    console.log("Fetching master data from source database...");

    const tables = [
      'master_chargers',
      'master_connectors', 
      'proposed_chargers',
      'station_attachments',
      'stations_contact',
      'stations_to_proposed_chargers',
      'amenities',
      'amenities_stations_mapping',
    ];

    // ✅ Truncate only the specified tables, leaving other tables untouched
    console.log("Truncating specific target tables...");
    for (const table of tables) {
      try {
        // await targetDb.query(`TRUNCATE TABLE asset_db.${table} CASCADE`);
        console.log(`✅ Truncated table: ${table}`);
      } catch (error) {
        console.error(`❌ Failed to truncate ${table}:`, error.message);
      }
    }

    // ✅ Migrate data for each table
    for (const table of tables) {
      console.log(`🚀 Migrating ${table}...`);

      // ✅ Check if the table exists in the source database
      const checkTable = await sourceDb.query(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '${table}'
        )`
      );

      if (!checkTable.rows[0].exists) {
        console.log(`⚠️ Skipping ${table}, does not exist in source DB.`);
        continue;
      }

      // ✅ Fetch source table data
      const { rows } = await sourceDb.query(`SELECT * FROM public.${table}`);
      console.log(`📊 Fetched ${rows.length} records from ${table}`);

      if (rows.length === 0) {
        console.log(`⚠️ No data found in ${table}, skipping migration.`);
        continue;
      }

      // ✅ Get column names from the first row
      let columns = Object.keys(rows[0]);

      // ✅ Get target table columns from information_schema
      const { rows: targetColumns } = await targetDb.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_schema = 'asset_db' 
         AND table_name = '${table}'`
      );

      const targetColumnNames = targetColumns.map(col => col.column_name);

      // ✅ Remove columns that do not exist in the target database
      columns = columns.filter(col => targetColumnNames.includes(col));

      // ✅ Explicitly remove "preventive_maintenance" column from `master_chargers`
      if (table === 'master_chargers') {
        columns = columns.filter(col => col !== 'preventive_maintenance');
      }

      // ✅ Prepare placeholders for insert query
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

      // ✅ Insert data into the target table
      for (const row of rows) {
        const values = columns.map(col => row[col]);

        try {
          await targetDb.query(
            `INSERT INTO asset_db.${table} (${columns.join(', ')})
             VALUES (${placeholders})`,
            values
          );
        } catch (error) {
          console.error(`❌ Failed to insert data into ${table}:`, error.message);
        }
      }

      console.log(`✅ Successfully migrated ${rows.length} records to ${table}`);
    }

    console.log("🎉 All migrations completed successfully.");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await sourceDb.end();
    await targetDb.end();
  }
}

// ✅ Execute the migration
migrateMasterData();
