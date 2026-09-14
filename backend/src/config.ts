const port = Number(process.env.PORT ?? 3000);
const databaseUrl = process.env.DATABASE_URL ?? "postgres://localhost/chess";

export const config = {
  port,
  databaseUrl,
};
