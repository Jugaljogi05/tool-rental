import { build, createServer, preview } from "vite";

const args = process.argv.slice(2);
const command = args[0] || "dev";

const readFlag = (name, fallback = true) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) return true;
  return value;
};

const hasFlag = (name) => args.includes(name);

const root = process.cwd();
const base = readFlag("--base", "/");
const mode = readFlag("--mode", command === "build" ? "production" : "development");
const port = Number(readFlag("--port", command === "preview" ? 4173 : 5173));
const host = readFlag("--host", false);
const strictPort = hasFlag("--strictPort");
const open = readFlag("--open", false);
const outDir = readFlag("--outDir", "dist");

const sharedConfig = {
  root,
  configFile: false,
  base,
  mode,
  logLevel: "info",
  esbuild: {
    jsx: "automatic",
  },
};

if (command === "build") {
  await build({
    ...sharedConfig,
    build: {
      outDir,
    },
  });
} else if (command === "preview") {
  const server = await preview({
    ...sharedConfig,
    build: {
      outDir,
    },
    preview: {
      port,
      host,
      strictPort,
      open,
    },
  });

  server.printUrls();
  server.bindCLIShortcuts({ print: true });
} else {
  const server = await createServer({
    ...sharedConfig,
    server: {
      port,
      host,
      strictPort,
      open,
    },
  });

  await server.listen();
  server.printUrls();
  server.bindCLIShortcuts({ print: true });
}
