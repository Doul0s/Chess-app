const port = Number(process.env.PORT ?? 3000);
const databaseUrl = process.env.DATABASE_URL ?? "postgres://localhost/chess";
const authSecret = process.env.AUTH_SECRET ?? "dev-only-insecure-secret";

if (!process.env.AUTH_SECRET) {
  console.warn("AUTH_SECRET not set — using an insecure default. Set it before deploying.");
}

export const config = {
  port,
  databaseUrl,
  authSecret,
};
