import { spawn } from "node:child_process";

const PACKAGE = "@eventpipe/cli";

function runNpm(args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const isWin = process.platform === "win32";
    const cmd = isWin ? "npm.cmd" : "npm";
    const child = spawn(cmd, args, {
      stdio: "inherit",
      shell: isWin,
    });
    child.on("error", () => resolve(1));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

export async function cmdUpdate(): Promise<void> {
  const code = await runNpm(["install", "-g", `${PACKAGE}@latest`]);
  if (code !== 0) {
    throw new Error(`npm exited with code ${code}`);
  }
}
