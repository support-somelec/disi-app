import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

// GET /admin/settings — retrieve all settings as key-value map
router.get("/admin/settings", async (req, res) => {
  try {
    const rows = await db.select().from(settingsTable);
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    // Always include SHARE_PATH even if not in DB yet
    if (!result["SHARE_PATH"]) result["SHARE_PATH"] = "/data/somelec-files";
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PUT /admin/settings/:key — update or insert a setting
router.put("/admin/settings/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body as { value: string };
    if (typeof value !== "string") return res.status(400).json({ error: "value requis" });

    await db.insert(settingsTable)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });

    res.json({ key, value });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
