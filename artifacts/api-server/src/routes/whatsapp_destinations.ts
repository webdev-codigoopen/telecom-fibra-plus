import { Router, type IRouter } from "express";
import { db, whatsappNotifyDestinationsTable } from "@workspace/db";
import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin as requireAdminKey } from "../lib/auth";
import {
  isWhatsappNotifyConfigured,
  migrateLegacyWhatsappDestination,
  sendWhatsappTestToDestination,
  loadWhatsappNotifyState,
} from "../lib/sendWhatsapp";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const numberSchema = z
  .string()
  .trim()
  .max(40)
  .refine(
    (v) => /^\d{10,15}$/.test(v.replace(/\D/g, "")),
    "Use 10 a 15 dígitos com DDI/DDD (ex.: 5577998444757).",
  )
  .transform((v) => v.replace(/\D/g, ""));

const labelSchema = z
  .union([z.literal(""), z.string().trim().max(60)])
  .optional()
  .transform((v) => (v == null || v === "" ? null : v));

const createSchema = z.object({
  number: numberSchema,
  label: labelSchema,
  enabled: z.boolean().optional(),
});

// For updates we keep `label` truly optional: if the caller didn't send it,
// we leave the existing label alone. If they sent it (including ""), we
// normalize via labelSchema so empty becomes null (clearing the label).
const updateSchema = z.object({
  number: numberSchema.optional(),
  label: z
    .union([z.literal(""), z.string().trim().max(60)])
    .optional(),
  enabled: z.boolean().optional(),
});

router.get(
  "/whatsapp-notify-destinations",
  requireAdminKey,
  async (_req, res) => {
    try {
      await migrateLegacyWhatsappDestination();
      const rows = await db
        .select()
        .from(whatsappNotifyDestinationsTable)
        .orderBy(asc(whatsappNotifyDestinationsTable.createdAt));
      const state = await loadWhatsappNotifyState();
      res.json({
        items: rows,
        whatsappConfigured: await isWhatsappNotifyConfigured(),
        credentialsConfigured: state.credentials !== null,
      });
    } catch (err) {
      logger.error({ err }, "Failed to list whatsapp destinations");
      res.status(500).json({ error: "Falha ao listar destinos." });
    }
  },
);

router.post(
  "/whatsapp-notify-destinations",
  requireAdminKey,
  async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        details: parsed.error.flatten(),
      });
      return;
    }
    try {
      const existing = await db
        .select({ id: whatsappNotifyDestinationsTable.id })
        .from(whatsappNotifyDestinationsTable)
        .where(eq(whatsappNotifyDestinationsTable.number, parsed.data.number));
      if (existing.length > 0) {
        res
          .status(409)
          .json({ error: "Esse número já está cadastrado." });
        return;
      }
      const [row] = await db
        .insert(whatsappNotifyDestinationsTable)
        .values({
          number: parsed.data.number,
          label: parsed.data.label,
          enabled: parsed.data.enabled ?? true,
        })
        .returning();
      res.status(201).json(row);
    } catch (err) {
      logger.error({ err }, "Failed to create whatsapp destination");
      res.status(500).json({ error: "Falha ao cadastrar destino." });
    }
  },
);

router.patch(
  "/whatsapp-notify-destinations/:id",
  requireAdminKey,
  async (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "ID inválido." });
      return;
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      res.status(400).json({
        error: parsed.success
          ? "Nada para atualizar."
          : (parsed.error.issues[0]?.message ?? "Dados inválidos."),
      });
      return;
    }
    try {
      if (parsed.data.number !== undefined) {
        const dup = await db
          .select({ id: whatsappNotifyDestinationsTable.id })
          .from(whatsappNotifyDestinationsTable)
          .where(
            and(
              eq(whatsappNotifyDestinationsTable.number, parsed.data.number),
              ne(whatsappNotifyDestinationsTable.id, id),
            ),
          );
        if (dup.length > 0) {
          res
            .status(409)
            .json({ error: "Outro destino já usa esse número." });
          return;
        }
      }
      const patch: {
        number?: string;
        label?: string | null;
        enabled?: boolean;
        updatedAt: Date;
      } = { updatedAt: new Date() };
      if (parsed.data.number !== undefined) patch.number = parsed.data.number;
      if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled;
      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "label")) {
        const raw = parsed.data.label;
        patch.label = raw == null || raw === "" ? null : raw;
      }
      const [row] = await db
        .update(whatsappNotifyDestinationsTable)
        .set(patch)
        .where(eq(whatsappNotifyDestinationsTable.id, id))
        .returning();
      if (!row) {
        res.status(404).json({ error: "Destino não encontrado." });
        return;
      }
      res.json(row);
    } catch (err) {
      logger.error({ err }, "Failed to update whatsapp destination");
      res.status(500).json({ error: "Falha ao atualizar destino." });
    }
  },
);

router.delete(
  "/whatsapp-notify-destinations/:id",
  requireAdminKey,
  async (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "ID inválido." });
      return;
    }
    try {
      await db
        .delete(whatsappNotifyDestinationsTable)
        .where(eq(whatsappNotifyDestinationsTable.id, id));
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "Failed to delete whatsapp destination");
      res.status(500).json({ error: "Falha ao remover destino." });
    }
  },
);

router.post(
  "/whatsapp-notify-destinations/:id/test",
  requireAdminKey,
  async (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "ID inválido." });
      return;
    }
    try {
      const result = await sendWhatsappTestToDestination(
        id,
        "✅ Teste — Provider Mais Fibra. Este número está pronto para receber novos cadastros.",
      );
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "Failed to send whatsapp destination test");
      const msg = err instanceof Error ? err.message : "Erro desconhecido.";
      res.status(500).json({ error: msg });
    }
  },
);

export default router;
