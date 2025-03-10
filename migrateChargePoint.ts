import { sourceDb, targetDb } from "./db";
import { ChargerPoint } from "./interfaces";

export async function migrateChargerPoints() {
  try {
    console.log("Fetching data from source database...");

    const sourceQuery = `
      SELECT * FROM public.charger_points_oltp;
    `;

    const { rows: chargers } = await sourceDb.query<ChargerPoint>(sourceQuery);

    console.log(`Fetched ${chargers.length} records. Starting migration...`);

    // Track seen charge point IDs
    const seenChargePoints = new Set<string>();

    for (const charger of chargers) {
      const chargePointId = charger.charge_point_id?.toString() || '';
      
      // Check if this charge point ID has been seen before
      const isDuplicate = seenChargePoints.has(chargePointId);
      const finalChargePointId = isDuplicate ? `${chargePointId}_duplicate` : chargePointId;
      
      // Add to seen set
      seenChargePoints.add(chargePointId);

      await targetDb.query(
        `INSERT INTO asset_db.saev_charge_point (
          station_id, serial_number, model, manufacturer_name, created_at, created_by, 
          updated_at, updated_by, charge_point_id, peak_power, ac_input_voltage, ac_max_current, 
          voltage_range_min, voltage_range_max, warranty_end_date, current_rating, 
          total_energy_consumed, total_sessions, heart_beat, charger_type, 
          commissioned_date, fm_number, charge_station_id,ocpp_charge_point_id, is_published, 
          tenant_id,
          is_serial_number_temporary, last_recurring_maintenance_date
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 
          $8, $9, $10, $11, $12, $13, 
          $14, $15, $16, $17, $18, 
          $19, $20, $21, $22, $23, 
          $24, $25, $26, $27, $28
        )`,
        [
          charger.station_id, // station_id
          charger.serial_number, // serial_number
          charger.model, // model
          charger.oem, // manufacturer_name (oem from source)
          charger.created_at, // created_at
          charger.created_by_oltp, // created_by
          charger.updated_at, // updated_at
          charger.updated_by_oltp, // updated_by
          charger.charge_point_id_oltp, // charge_point_id
          charger.peak_power_in_kW, // peak_power
          null, // ac_input_voltage (No mapping found in source)
          null, // ac_max_current (No mapping found in source)
          charger.voltage_range_min, // voltage_range_min
          charger.voltage_range_max, // voltage_range_max
          charger.warranty_end_date, // warranty_end_date
          charger.current_rating, // current_rating
          charger.energy_sold, // total_energy_consumed
          charger.total_sessions, // total_sessions
          charger.last_heartbeat_received, // heart_beat
          charger.charger_type, // charger_type
          charger.commissioned_date, // commissioned_date
          charger.firmware_version, // fm_number
          charger.station_id, // charge_station_id
          finalChargePointId, // Using modified charge point ID for duplicates
          charger.is_published, // is_published
          "",
          charger.is_serial_number_temporary, // is_serial_number_temporary
          charger.last_recurrence_service_date, // last_recurring_maintenance_date
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
migrateChargerPoints();
