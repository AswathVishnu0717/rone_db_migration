import { sourceDb, targetDb } from "./db";
import { ChargerPoint, Stations } from "./interfaces";

export async function migrateStations() {
  try {
    console.log("Fetching data from source database...");

    const sourceQuery = `
      SELECT id, name, station_id_oltp, address, level_3_id, latitude, longitude, 
      created_at, updated_at, agreement_type, what3words_location, is_active,
      is_stabilizer_installed, is_diesel_generator_available, sessions,
      energy_sold , station_contact, street, area, city, state, 
      country, pincode, landmark
      FROM public.stations_oltp;
    `;

    const { rows: stations } = await sourceDb.query<Stations>(sourceQuery);

    console.log(`Fetched ${stations.length} records. Starting migration...`);

    for (const station of stations) {
      await targetDb.query(
        `INSERT INTO asset_db.station (
          id, name, latitude, longitude, address, street, area, city, state,
          country, pincode, landmark, agreement_type, what3words_location,
          is_active, is_stabilizer_installed, is_diesel_generator_available,
          total_sessions, energy_delivered, station_contact, tenantid,
          always_open, opening_hours, level_1, level_2, level_3, tariff_id,
          charge_station_id, business_unit_id, discount_id, station_charger_type,
          comissioned_date, is_deleted, totla_revenue_no_tax, uuid, created_at,
          updated_at, created_by, updated_by, geolocation,station_id_oltp
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33, $34, $35, $36, $37, $38, $39, POINT($4, $3),$40
        )`,
        [
          station.id,
          station.name,
          station.latitude,
          station.longitude,
          station.address,
          station.street,
          station.area,
          station.city,
          station.state,
          station.country,
          station.pincode,
          station.landmark,
          station.agreement_type,
          station.what3words_location,
          station.is_active || false,
          station.is_stabilizer_installed || false,
          station.is_diesel_generator_available || false,
          station.sessions || 0,
          station.energy_sold || 0,
          station.station_contact,
          "",
          null,
          null,
          null,
          null,
          station.level_3_id,
          null,
          station.station_id_oltp?.toString(),
          null,
          null,
          null,
          null,
          false,
          0,
          null,
          station.created_at || new Date(),
          station.updated_at || new Date(),
          null,
          null,
          station.station_id_oltp
        ]
      );
    }

    console.log("Migration completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await sourceDb.end();
    await targetDb.end();
  }
}

// Execute the migration
migrateStations();
