import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const getDatabaseErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") return undefined;
  const direct = error as { code?: unknown; cause?: { code?: unknown } };
  if (typeof direct.code === "string") return direct.code;
  if (typeof direct.cause?.code === "string") return direct.cause.code;
  return undefined;
};

const settingsErrorMessage = (error: unknown) => {
  const code = getDatabaseErrorCode(error);
  if (code === "42P01" || code === "42703") {
    return "La migration de stockage n'a pas encore été appliquée à la base de données. Appliquez la migration puis réessayez.";
  }
  return "Impossible d'enregistrer les paramètres de stockage.";
};

const logSettingsError = (operation: string, error: unknown) => {
  console.error(`[settings] ${operation} failed`, {
    errorType: error instanceof Error ? error.name : typeof error,
    databaseCode: getDatabaseErrorCode(error),
  });
};

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
    logSettingsError("read", err);
    res.status(500).json({ error: settingsErrorMessage(err) });
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
    logSettingsError("save", err);
    res.status(500).json({ error: settingsErrorMessage(err) });
  }
});

export default router;
