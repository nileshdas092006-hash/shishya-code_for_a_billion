// npm run dev:demo — the dev server on the DEMO database (data/demo.db), on Windows, macOS and Linux.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: "file:data/demo.db", DATABASE_AUTH_TOKEN: "" },
});
child.on("exit", (code) => process.exit(code ?? 0));
// Stop the server too when this launcher is stopped.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => child.kill(signal));
