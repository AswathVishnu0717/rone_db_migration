#!/bin/bash

# Database Credentials
SOURCE_DB="your_source_db"
TARGET_DB="your_target_db"
DB_USER="your_user"
DB_HOST="your_host"

# Backup directory
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

# List of tables
tables=(
  "programs"
  "regions"
  "projects"
  "chargers_inventory"
  "projects_to_assignees_mapping"
  "projects_work_group_mapping"
  "work_packs"
  "work_packs_to_assignees_mapping"
  "sub_tasks"
  "work_pack_history"
  "work_pack_activities"
  "work_pack_activities_attachments"
  "work_pack_history_attachments"
  "work_group_default_subtasks"
  "work_group_default_templates"
  "station_attachments_v2"
  "archived_attachments"
  "attachments"
  "alert_mappings"
  "connector_status"
  "closure_info"
  "alerts"
)

echo "🚀 Starting Migration Process..."

# Step 1: Dump tables
echo "🔹 Dumping tables from source database..."
for table in "${tables[@]}"; do
  echo "🔸 Dumping $table..."
  pg_dump -U "$DB_USER" -h "$DB_HOST" -d "$SOURCE_DB" -t "public.$table" --column-inserts --data-only -f "$BACKUP_DIR/$table.sql"
done

# Step 2: Drop existing tables
echo "🔹 Dropping tables in target database..."
for table in "${tables[@]}"; do
  echo "🔸 Dropping $table..."
  psql -U "$DB_USER" -h "$DB_HOST" -d "$TARGET_DB" -c "DROP TABLE IF EXISTS rone_db.$table CASCADE;"
done

# Step 3: Restore tables
echo "🔹 Restoring tables to target database..."
psql -U "$DB_USER" -h "$DB_HOST" -d "$TARGET_DB" -c "SET session_replication_role = 'replica';"  # Disable FK checks

for table in "${tables[@]}"; do
  echo "🔸 Restoring $table..."
  psql -U "$DB_USER" -h "$DB_HOST" -d "$TARGET_DB" -f "$BACKUP_DIR/$table.sql"
done

psql -U "$DB_USER" -h "$DB_HOST" -d "$TARGET_DB" -c "SET session_replication_role = 'origin';"  # Re-enable FK checks

# Step 4: Reset sequences
echo "🔹 Resetting sequences..."
for table in "${tables[@]}"; do
  psql -U "$DB_USER" -h "$DB_HOST" -d "$TARGET_DB" -c "SELECT setval(pg_get_serial_sequence('rone_db.$table', 'id'), COALESCE((SELECT MAX(id) FROM rone_db.$table), 1), false);"
done

# Step 5: Reapply primary keys
echo "🔹 Reapplying primary keys..."
for table in "${tables[@]}"; do
  psql -U "$DB_USER" -h "$DB_HOST" -d "$TARGET_DB" -c "ALTER TABLE rone_db.$table ADD PRIMARY KEY (id);" || echo "⚠️ Skipping primary key for $table."
done

echo "✅✅✅ Migration process completed successfully!"
