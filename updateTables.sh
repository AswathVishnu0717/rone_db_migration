#!/bin/bash

# Get database connection details from environment variables
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-suite_template}"
DB_USER="${DB_USER:-postgres}"

# Function to log messages with timestamp
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Run migrations in sequence
log_message "Starting migrations..."

# PL/pgSQL block to truncate all tables in the asset_db schema
log_message "Truncating all tables in asset_db schema..."
PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
DO \$\$ 
DECLARE
    r RECORD;
BEGIN
    -- Loop through all tables in the specified schema
    FOR r IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'asset_db'
        AND table_type = 'BASE TABLE'  -- Only regular tables, not views
    LOOP
        -- Generate and execute a TRUNCATE statement with CASCADE for each table
        EXECUTE 'TRUNCATE TABLE asset_db.' || r.table_name || ' CASCADE;';
    END LOOP;
END \$\$;
EOF
if [ $? -ne 0 ]; then
    log_message "Truncation of tables in asset_db schema failed"
    exit 1
fi
log_message "Truncation of tables in asset_db schema completed successfully"


# Migrate Users
log_message "Starting users migration..."
npx ts-node migrateUsers.ts
if [ $? -ne 0 ]; then
    log_message "Users migration failed"
    exit 1
fi
log_message "Users migration completed successfully"

# Migrate Stations
log_message "Starting stations migration..."
npx ts-node migrateStation.ts
if [ $? -ne 0 ]; then
    log_message "Stations migration failed"
    exit 1
fi
log_message "Stations migration completed successfully"

# Migrate Master Data
Migrate Master Data
log_message "Starting connectors migration..."
npx ts-node migrateMasterData.ts
if [ $? -ne 0 ]; then
    log_message "MasterData migration failed"
    exit 1
fi

# Migrate Charge Points
log_message "Starting charge points migration..."
npx ts-node migrateChargePoint.ts
if [ $? -ne 0 ]; then
    log_message "Charge points migration failed"
    exit 1
fi
log_message "Charge points migration completed successfully"

# Migrate Connectors
log_message "Starting connectors migration..."
npx ts-node migrateConnectors.ts
if [ $? -ne 0 ]; then
    log_message "Connectors migration failed"
    exit 1
fi
log_message "Connectors migration completed successfully"


# Migrate Rone DB Specific Tables
log_message "Starting Rone DB specific tables migration..."
npx ts-node migrateRoneDBSpecificTables.ts
if [ $? -ne 0 ]; then
    log_message "Rone DB specific tables migration failed"
    exit 1
fi

log_message "Connectors migration completed successfully"
log_message "Rone DB specific tables migration completed successfully"

log_message "All migrations completed successfully. Starting table updates..."

# Create temporary SQL file
TMP_SQL="/tmp/update_tables.sql"

# Write SQL commands to temporary file
cat > "$TMP_SQL" << 'EOF'
-- Step 1: Drop existing foreign key constraints referencing users, charger_points_oltp, stations_oltp, connectors_oltp
DO $$ DECLARE 
    r RECORD;
BEGIN
    FOR r IN 
        SELECT conname, conrelid::regclass AS tablename
        FROM pg_constraint
        WHERE confrelid::regclass::text IN ('users', 'charger_points_oltp', 'stations_oltp', 'connectors_oltp')
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I;', r.tablename, r.conname);
    END LOOP;
END $$;

-- Step 2: Alter columns referencing user_db.users to VARCHAR(255)
ALTER TABLE rone_db.programs ALTER COLUMN created_by TYPE VARCHAR(255);
ALTER TABLE rone_db.programs ALTER COLUMN updated_by TYPE VARCHAR(255);

ALTER TABLE rone_db.projects ALTER COLUMN created_by TYPE VARCHAR(255);
ALTER TABLE rone_db.projects ALTER COLUMN updated_by TYPE VARCHAR(255);

ALTER TABLE rone_db.projects_to_assignees_mapping ALTER COLUMN user_id TYPE VARCHAR(255);

ALTER TABLE rone_db.projects_work_group_mapping ALTER COLUMN created_by TYPE VARCHAR(255);
ALTER TABLE rone_db.projects_work_group_mapping ALTER COLUMN updated_by TYPE VARCHAR(255);

ALTER TABLE rone_db.regions ALTER COLUMN created_by TYPE VARCHAR(255);
ALTER TABLE rone_db.regions ALTER COLUMN updated_by TYPE VARCHAR(255);

ALTER TABLE rone_db.sub_tasks ALTER COLUMN updated_by TYPE VARCHAR(255);

ALTER TABLE rone_db.work_pack_activities ALTER COLUMN user_id TYPE VARCHAR(255);

ALTER TABLE rone_db.work_pack_history ALTER COLUMN updated_by TYPE VARCHAR(255);
ALTER TABLE rone_db.work_pack_history ALTER COLUMN user_id TYPE VARCHAR(255);

ALTER TABLE rone_db.work_packs ALTER COLUMN assigned_by TYPE VARCHAR(255);
ALTER TABLE rone_db.work_packs ALTER COLUMN updated_by TYPE VARCHAR(255);

ALTER TABLE rone_db.work_packs_to_assignees_mapping ALTER COLUMN user_id TYPE VARCHAR(255);

ALTER TABLE rone_db.alerts ALTER COLUMN "reportedBy" TYPE VARCHAR(255);
ALTER TABLE rone_db.archived_attachments ALTER COLUMN deleted_by TYPE VARCHAR(255);
ALTER TABLE rone_db.chargers_inventory ALTER COLUMN created_by TYPE VARCHAR(255);
ALTER TABLE rone_db.chargers_inventory ALTER COLUMN updated_by TYPE VARCHAR(255);
ALTER TABLE rone_db.closure_info ALTER COLUMN closure_by TYPE VARCHAR(255);

-- Step 3: Add updated foreign key constraints
ALTER TABLE rone_db.alert_mappings ADD CONSTRAINT alert_mappings_pkey PRIMARY KEY (id);

ALTER TABLE rone_db.alerts ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);
ALTER TABLE rone_db.alerts ADD CONSTRAINT alerts_charger_serial_number_fk FOREIGN KEY (charger_serial_number) REFERENCES asset_db.saev_charge_point(serial_number) ON UPDATE CASCADE;
ALTER TABLE rone_db.alerts ADD CONSTRAINT alerts_connector_id_fk FOREIGN KEY (connector_id) REFERENCES asset_db.saev_connectors(id);
ALTER TABLE rone_db.alerts ADD CONSTRAINT alerts_mapping_id_fk FOREIGN KEY (mapping_id) REFERENCES rone_db.alert_mappings(id);
ALTER TABLE rone_db.alerts ADD CONSTRAINT alerts_reportedBy_fk FOREIGN KEY ("reportedBy") REFERENCES user_db.users(id);

ALTER TABLE rone_db.archived_attachments ADD CONSTRAINT archived_attachments_pkey PRIMARY KEY (id);
ALTER TABLE rone_db.archived_attachments ADD CONSTRAINT archived_attachments_deleted_by_fk FOREIGN KEY (deleted_by) REFERENCES user_db.users(id);
ALTER TABLE rone_db.archived_attachments ADD CONSTRAINT archived_attachments_station_id_fk FOREIGN KEY (station_id) REFERENCES asset_db.station(id);
ALTER TABLE rone_db.archived_attachments ADD CONSTRAINT archived_attachments_work_pack_id_fk FOREIGN KEY (work_pack_id) REFERENCES rone_db.work_packs(id);

ALTER TABLE rone_db.attachments ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);
ALTER TABLE rone_db.attachments ADD CONSTRAINT attachments_work_pack_id_fk FOREIGN KEY (work_pack_id) REFERENCES rone_db.work_packs(id);

ALTER TABLE rone_db.chargers_inventory ADD CONSTRAINT chargers_inventory_pkey PRIMARY KEY (id);
ALTER TABLE rone_db.chargers_inventory ADD CONSTRAINT chargers_inventory_created_by_fk FOREIGN KEY (created_by) REFERENCES user_db.users(id);
ALTER TABLE rone_db.chargers_inventory ADD CONSTRAINT chargers_inventory_updated_by_fk FOREIGN KEY (updated_by) REFERENCES user_db.users(id);
ALTER TABLE rone_db.chargers_inventory ADD CONSTRAINT chargers_inventory_model_id_fk FOREIGN KEY (model_id) REFERENCES rone_db.master_chargers(id);

ALTER TABLE rone_db.closure_info ADD CONSTRAINT closure_info_pkey PRIMARY KEY (id);
ALTER TABLE rone_db.closure_info ADD CONSTRAINT closure_info_charger_serial_number_fk FOREIGN KEY (charger_serial_number) REFERENCES asset_db.saev_charge_point(serial_number) ON UPDATE CASCADE;
ALTER TABLE rone_db.closure_info ADD CONSTRAINT closure_info_closure_by_fk FOREIGN KEY (closure_by) REFERENCES user_db.users(id);
ALTER TABLE rone_db.closure_info ADD CONSTRAINT closure_info_project_id_fk FOREIGN KEY (project_id) REFERENCES rone_db.projects(id);
ALTER TABLE rone_db.closure_info ADD CONSTRAINT closure_info_station_id_fk FOREIGN KEY (station_id) REFERENCES asset_db.station(id);

ALTER TABLE rone_db.connector_status ADD CONSTRAINT connector_status_pkey PRIMARY KEY (id);
ALTER TABLE rone_db.connector_status ADD CONSTRAINT connector_status_connector_id_fk FOREIGN KEY (connector_id) REFERENCES asset_db.saev_connectors(id);
ALTER TABLE rone_db.connector_status ADD CONSTRAINT connector_status_serial_number_fk FOREIGN KEY (serial_number) REFERENCES asset_db.saev_charge_point(serial_number) ON UPDATE CASCADE;

ALTER TABLE rone_db.programs ADD CONSTRAINT programs_pkey PRIMARY KEY (id);
ALTER TABLE rone_db.programs ADD CONSTRAINT programs_created_by_fk FOREIGN KEY (created_by) REFERENCES user_db.users(id);
ALTER TABLE rone_db.programs ADD CONSTRAINT programs_updated_by_fk FOREIGN KEY (updated_by) REFERENCES user_db.users(id);

ALTER TABLE rone_db.projects ADD CONSTRAINT projects_pkey PRIMARY KEY (id);
ALTER TABLE rone_db.projects ADD CONSTRAINT projects_charge_point_serial_number_fk FOREIGN KEY (charge_point_serial_number) REFERENCES asset_db.saev_charge_point(serial_number) ON UPDATE CASCADE;
ALTER TABLE rone_db.projects ADD CONSTRAINT projects_created_by_fk FOREIGN KEY (created_by) REFERENCES user_db.users(id);
ALTER TABLE rone_db.projects ADD CONSTRAINT projects_updated_by_fk FOREIGN KEY (updated_by) REFERENCES user_db.users(id);
ALTER TABLE rone_db.projects ADD CONSTRAINT projects_program_id_fk FOREIGN KEY (program_id) REFERENCES rone_db.programs(id);

ALTER TABLE rone_db.projects_to_assignees_mapping ADD CONSTRAINT projects_to_assignees_mapping_project_id_fk FOREIGN KEY (project_id) REFERENCES rone_db.projects(id);
ALTER TABLE rone_db.projects_to_assignees_mapping ADD CONSTRAINT projects_to_assignees_mapping_user_id_fk FOREIGN KEY (user_id) REFERENCES user_db.users(id);

ALTER TABLE rone_db.projects_work_group_mapping ADD CONSTRAINT projects_work_group_mapping_pkey PRIMARY KEY (project_id, work_group_id);
ALTER TABLE rone_db.projects_work_group_mapping ADD CONSTRAINT projects_work_group_mapping_created_by_fk FOREIGN KEY (created_by) REFERENCES user_db.users(id);
ALTER TABLE rone_db.projects_work_group_mapping ADD CONSTRAINT projects_work_group_mapping_updated_by_fk FOREIGN KEY (updated_by) REFERENCES user_db.users(id);
ALTER TABLE rone_db.projects_work_group_mapping ADD CONSTRAINT projects_work_group_mapping_project_id_fk FOREIGN KEY (project_id) REFERENCES rone_db.projects(id);

ALTER TABLE rone_db.regions ADD CONSTRAINT regions_pkey PRIMARY KEY (id);
ALTER TABLE rone_db.regions ADD CONSTRAINT regions_created_by_fk FOREIGN KEY (created_by) REFERENCES user_db.users(id);
ALTER TABLE rone_db.regions ADD CONSTRAINT regions_updated_by_fk FOREIGN KEY (updated_by) REFERENCES user_db.users(id);
ALTER TABLE rone_db.regions ADD CONSTRAINT regions_parent_id_fk FOREIGN KEY (parent_id) REFERENCES rone_db.regions(id);
ALTER TABLE rone_db.regions ADD CONSTRAINT regions_code_unique UNIQUE (code);

ALTER TABLE rone_db.station_attachments_v2 ADD CONSTRAINT station_attachments_v2_pkey PRIMARY KEY (id);
ALTER TABLE rone_db.station_attachments_v2 ADD CONSTRAINT station_attachments_v2_station_id_fk FOREIGN KEY (station_id) REFERENCES asset_db.station(id);

ALTER TABLE rone_db.sub_tasks ADD CONSTRAINT sub_tasks_pkey PRIMARY KEY (id);
ALTER TABLE rone_db.sub_tasks ADD CONSTRAINT sub_tasks_updated_by_fk FOREIGN KEY (updated_by) REFERENCES user_db.users(id);
ALTER TABLE rone_db.sub_tasks ADD CONSTRAINT sub_tasks_work_pack_id_fk FOREIGN KEY (work_pack_id) REFERENCES rone_db.work_packs(id);

ALTER TABLE rone_db.work_group_default_templates ADD CONSTRAINT work_group_default_templates_pkey PRIMARY KEY (id);

ALTER TABLE rone_db.work_pack_activities ADD CONSTRAINT work_pack_activities_pkey PRIMARY KEY (id);
ALTER TABLE rone_db.work_pack_activities ADD CONSTRAINT work_pack_activities_user_id_fk FOREIGN KEY (user_id) REFERENCES user_db.users(id);
ALTER TABLE rone_db.work_pack_activities ADD CONSTRAINT work_pack_activities_work_pack_id_fk FOREIGN KEY (work_pack_id) REFERENCES rone_db.work_packs(id);

ALTER TABLE rone_db.work_pack_activities_attachments ADD CONSTRAINT work_pack_activities_attachments_pkey PRIMARY KEY (work_pack_activity_id, attachement_id);
ALTER TABLE rone_db.work_pack_activities_attachments ADD CONSTRAINT work_pack_activities_attachments_attachement_id_fk FOREIGN KEY (attachement_id) REFERENCES rone_db.attachments(id);
ALTER TABLE rone_db.work_pack_activities_attachments ADD CONSTRAINT work_pack_activities_attachments_work_pack_activity_id_fk FOREIGN KEY (work_pack_activity_id) REFERENCES rone_db.work_pack_activities(id);

ALTER TABLE rone_db.work_pack_history ADD CONSTRAINT work_pack_history_pkey PRIMARY KEY (id);
ALTER TABLE rone_db.work_pack_history ADD CONSTRAINT work_pack_history_updated_by_fk FOREIGN KEY (updated_by) REFERENCES user_db.users(id);
ALTER TABLE rone_db.work_pack_history ADD CONSTRAINT work_pack_history_user_id_fk FOREIGN KEY (user_id) REFERENCES user_db.users(id);
ALTER TABLE rone_db.work_pack_history ADD CONSTRAINT work_pack_history_work_pack_id_fk FOREIGN KEY (work_pack_id) REFERENCES rone_db.work_packs(id);

ALTER TABLE rone_db.work_pack_history_attachments ADD CONSTRAINT work_pack_history_attachments_pkey PRIMARY KEY (work_pack_history_id, attachement_id);
ALTER TABLE rone_db.work_pack_history_attachments ADD CONSTRAINT work_pack_history_attachments_attachement_id_fk FOREIGN KEY (attachement_id) REFERENCES rone_db.attachments(id);
ALTER TABLE rone_db.work_pack_history_attachments ADD CONSTRAINT work_pack_history_attachments_work_pack_history_id_fk FOREIGN KEY (work_pack_history_id) REFERENCES rone_db.work_pack_history(id);

ALTER TABLE rone_db.work_packs ADD CONSTRAINT work_packs_pkey PRIMARY KEY (id);
ALTER TABLE rone_db.work_packs ADD CONSTRAINT work_packs_assigned_by_fk FOREIGN KEY (assigned_by) REFERENCES user_db.users(id);
ALTER TABLE rone_db.work_packs ADD CONSTRAINT work_packs_updated_by_fk FOREIGN KEY (updated_by) REFERENCES user_db.users(id);
ALTER TABLE rone_db.work_packs ADD CONSTRAINT work_packs_project_id_fk FOREIGN KEY (project_id) REFERENCES rone_db.projects(id);
ALTER TABLE rone_db.work_packs ADD CONSTRAINT work_packs_project_id_work_group_id_fk FOREIGN KEY (project_id, work_group_id) REFERENCES rone_db.projects_work_group_mapping(project_id, work_group_id);
ALTER TABLE rone_db.work_packs ADD CONSTRAINT work_packs_parent_id_fk FOREIGN KEY (parent_id) REFERENCES rone_db.work_packs(id);
ALTER TABLE rone_db.work_packs ADD CONSTRAINT work_packs_charger_serial_number_fk FOREIGN KEY (charger_serial_number) REFERENCES asset_db.saev_charge_point(serial_number) ON UPDATE CASCADE;

ALTER TABLE rone_db.work_packs_to_assignees_mapping ADD CONSTRAINT work_packs_to_assignees_mapping_user_id_fk FOREIGN KEY (user_id) REFERENCES user_db.users(id);
ALTER TABLE rone_db.work_packs_to_assignees_mapping ADD CONSTRAINT work_packs_to_assignees_mapping_work_pack_id_fk FOREIGN KEY (work_pack_id) REFERENCES rone_db.work_packs(id) ON DELETE CASCADE;
EOF

# Execute the SQL file
log_message "Starting table updates..."
PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$TMP_SQL"
if [ $? -ne 0 ]; then
    log_message "Table updates failed"
    rm "$TMP_SQL"
    exit 1
fi
log_message "Table updates completed successfully"

# Remove temporary SQL file
rm "$TMP_SQL"
log_message "Script execution completed"
