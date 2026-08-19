---
name: Storage schema deployment
description: The file-storage settings UI depends on a deployed settings table and must not expose Drizzle query text on migration failures.
---

The file-storage configuration cannot be saved until the target database has the `settings` table and its timestamp column from the file-storage schema migration.

**Why:** an unmigrated deployment fails on the settings upsert even though the application code is current; raw database exceptions can reveal a full failed query to users.

**How to apply:** ensure the target database receives the schema migration through its supported deployment flow before enabling storage settings, and return a concise migration-needed error rather than serializing database exceptions.
