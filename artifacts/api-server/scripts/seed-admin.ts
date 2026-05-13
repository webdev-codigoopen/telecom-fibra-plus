// Usage:
//   pnpm --filter @workspace/api-server exec tsx scripts/seed-admin.ts <email> <password>
//   ADMIN_EMAIL=foo@bar.com ADMIN_PASSWORD=... pnpm --filter @workspace/api-server exec tsx scripts/seed-admin.ts
//
// Creates a new admin_users row with a bcrypt-hashed password (cost 12).
// If the email already exists, updates the password instead.
import { eq } from "drizzle-orm";
import { db, adminUsersTable } from "@workspace/db";
import { hashPassword } from "../src/lib/auth";

async function main(): Promise<void> {
  const cliEmail = process.argv[2];
  const cliPassword = process.argv[3];
  const email = (cliEmail ?? process.env["ADMIN_EMAIL"] ?? "").trim().toLowerCase();
  const password = cliPassword ?? process.env["ADMIN_PASSWORD"] ?? "";

  if (!email || !email.includes("@")) {
    console.error("ERR: e-mail inválido. Passe como 1º argumento ou ADMIN_EMAIL.");
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error("ERR: senha precisa de no mínimo 8 caracteres. Passe como 2º argumento ou ADMIN_PASSWORD.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const existing = await db
    .select({ id: adminUsersTable.id })
    .from(adminUsersTable)
    .where(eq(adminUsersTable.email, email))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(adminUsersTable)
      .set({ passwordHash, isActive: true })
      .where(eq(adminUsersTable.email, email));
    console.log(`OK: senha atualizada para ${email}`);
  } else {
    await db.insert(adminUsersTable).values({ email, passwordHash, isActive: true });
    console.log(`OK: usuário criado: ${email}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("seed-admin failed:", err);
  process.exit(1);
});
