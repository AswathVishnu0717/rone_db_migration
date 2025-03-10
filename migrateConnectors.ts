import { sourceDb, targetDb } from "./db";
import { Connectors } from "./interfaces";

export async function migrateConnectors() {
  try {
    console.log("Fetching data from source database...");

    const sourceQuery = `
      SELECT * FROM public.connectors_oltp;
    `;

    const { rows: connectors } = await sourceDb.query<Connectors>(sourceQuery);

    console.log(`Fetched ${connectors.length} records. Starting migration...`);

    for (const connector of connectors) {
      await targetDb.query(
        `INSERT INTO asset_db.saev_connectors (
          id,ocpp_charge_point_id, serial_number, connector_id_in_charger,
          connector_type, current_status, peak_power_in_kw, peak_current,
          peak_voltage, created_by, updated_by, created_at, updated_at,
          isactive, charge_station_id, tenant_id, tariff_id,
          charge_connector_id, peak_power_rank, discount_id, reason,
          last_received_message_time, isdeleted, ispublished, uuid,
          level_1, level_2, level_3, charge_point_id, current_type,
          connector_id_oltp
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29,$30,$31
        )`,
        [
          connector.id,
          connector.ocpp_charge_point_id,
          connector.serial_number,
          connector.connector_id_in_charger,
          connector.connector_type,
          connector.current_status,
          connector.peak_power_in_kW?.toString(),
          connector.peak_current,
          connector.peak_voltage,
          connector.created_by,
          connector.updated_by,
          connector.created_at,
          connector.updated_at,
          true, // isactive default
          null, // charge_station_id
          "", // tenant_id
          null, // tariff_id  
          connector.id, // charge_connector_id
          "0", // peak_power_rank default
          null, // discount_id
          null, // reason
          null, // last_received_message_time
          false, // isdeleted default
          true, // ispublished default
          null, // uuid
          null, // level_1
          null, // level_2
          null, // level_3
          null, // charge_point_id
          null, // current_type
          connector.connector_id_oltp
        ]
      );
    }

    console.log("Connectors migration completed successfully.");
  } catch (error) {
    console.error("Connectors migration failed:", error);
    throw error;
  }
}

migrateConnectors()