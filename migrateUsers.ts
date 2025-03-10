import { sourceDb, targetDb } from "./db";
import { Users } from "./interfaces";

export async function migrateUsers() {
  try {
    console.log("Fetching data from source database...");

    const sourceQuery = `
      SELECT id, uuid, full_name, account_verified, phone, email, user_role,
      is_available, base_location, live_location, created_at, updated_at
      FROM public.users;
    `;

    const { rows: users } = await sourceDb.query<Users>(sourceQuery);

    console.log(`Fetched ${users.length} records. Starting migration...`);

    for (const user of users) {
      await targetDb.query(
        `INSERT INTO user_db.users (
          id, tenant_id, user_type, email, phone, name, cover_image, logo,
          user_role, business_unit_details, is_email_verified, customer_address,
          is_update_policy, user_units_consumed, account_verified, base_location,
          live_location, is_available, is_deleted, is_active, created_by,
          updated_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24
        )`,
        [
          user.id,
          user.uuid, // tenant_id
          "user", // user_type
          user.email,
          user.phone,
          user.full_name,
          null, // cover_image
          null, // logo
          user.user_role,
          null, // business_unit_details
          false, // is_email_verified
          null, // customer_address
          false, // is_update_policy
          0, // user_units_consumed
          user.account_verified,
          user.base_location, // base_location
          user.live_location, // live_location
          user.is_available,
          false, // is_deleted
          true, // is_active
          null, // created_by
          null, // updated_by
          user.created_at,
          user.updated_at
        ]
      );
    }

    console.log("Migration completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

// Execute the migration
migrateUsers();
