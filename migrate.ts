import { Pool } from 'pg';
import { migrateChargerPoints } from './migrateChargePoint';
import { migrateStations } from './migrateStation';
import { sourceDb, targetDb } from "./db";

export async function truncateAllTables() {
    try {
        // Get all table names from the public schema
        const tablesQuery = `
            SELECT tablename
            FROM pg_tables 
            WHERE schemaname = 'asset_db'
            AND tablename IN ('saev_charge_point', 'station')
        `;
        
        const { rows } = await targetDb.query(tablesQuery);
        
        // For each table, truncate with RESTART IDENTITY
        for (const row of rows) {
            const tableName = row.tablename;
            await targetDb.query(`TRUNCATE TABLE asset_db."${tableName}" RESTART IDENTITY CASCADE`);
        }

        console.log('All tables truncated successfully');
    } catch (error) {
        console.error('Error truncating tables:', error);
        throw error;
    }
}

export async function runMigrations() {
    try {
        await migrateChargerPoints();
        await migrateStations();
        
        console.log('Migrations completed successfully');
        
        // Close database connections after migrations complete
        await sourceDb.end();
        await targetDb.end();
    } catch (error) {
        console.error('Error running migrations:', error);
        // Close connections even if there's an error
        await sourceDb.end();
        await targetDb.end();
        throw error;
    }
}

export async function startMigration() {
    try {
        await truncateAllTables();
        await runMigrations();
    }
    catch(error) {
        console.error('Error starting migrations:', error);
        throw error;
    }
}

startMigration()
.catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
});