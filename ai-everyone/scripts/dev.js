const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const nextDir = path.join(projectRoot, ".next");
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const isDockerLinux = process.platform === "linux" && fs.existsSync("/.dockerenv");
const isLinuxGnu = process.platform === "linux" && process.arch === "x64";

function readPackageVersion(packageName) {
  const packageJsonPath = path.join(projectRoot, "node_modules", ...packageName.split("/"), "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, "utf8")).version ?? null;
  } catch {
    return null;
  }
}

function ensurePackageInstalled(packageName, version) {
  const packagePath = path.join(projectRoot, "node_modules", ...packageName.split("/"));

  if (fs.existsSync(packagePath)) {
    return;
  }

  const installTarget = version ? `${packageName}@${version}` : packageName;
  const result = spawnSync("npm", ["install", "--no-save", installTarget], {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (isDockerLinux && fs.existsSync(nextDir)) {
  // The Windows-mounted .next cache gets corrupted across host/container builds.
  fs.rmSync(nextDir, { recursive: true, force: true });
}

if (isDockerLinux && isLinuxGnu) {
  ensurePackageInstalled("@next/swc-linux-x64-gnu", readPackageVersion("next"));
  ensurePackageInstalled("@tailwindcss/oxide-linux-x64-gnu", readPackageVersion("@tailwindcss/oxide"));
}

const args = [nextBin, "dev", "-H", "0.0.0.0"];

if (isDockerLinux) {
  args.push("--webpack");
}

const child = spawn(process.execPath, args, {
  cwd: projectRoot,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
