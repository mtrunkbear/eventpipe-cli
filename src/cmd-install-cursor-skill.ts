import { cp, mkdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = "eventpipe-debug";

function packageRootFromThisFile(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..");
}

export async function cmdInstallCursorSkill(argv: string[]): Promise<void> {
  let global = false;
  let force = false;
  let projectDir = process.cwd();

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--global" || a === "-g") {
      global = true;
    } else if (a === "--force" || a === "-f") {
      force = true;
    } else if ((a === "--dir" || a === "-C") && argv[i + 1]) {
      projectDir = resolve(argv[++i]!.trim());
    }
  }

  const root = packageRootFromThisFile();
  const src = join(root, "skills", SKILL_DIR);
  try {
    await stat(join(src, "SKILL.md"));
  } catch {
    throw new Error(
      `Bundled Cursor skill not found at ${src}. Reinstall @eventpipe/cli or build from source.`,
    );
  }

  const dest = global
    ? join(homedir(), ".cursor", "skills", SKILL_DIR)
    : join(projectDir, ".cursor", "skills", SKILL_DIR);

  if (!force) {
    try {
      await stat(dest);
      throw new Error(
        `Target already exists: ${dest}\nUse --force to overwrite, or remove the folder first.`,
      );
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Target already exists")) {
        throw e;
      }
    }
  }

  await mkdir(dirname(dest), { recursive: true });
  await cp(src, dest, { recursive: true, force: true });

  const scope = global ? "global (~/.cursor/skills)" : `project (${join(projectDir, ".cursor/skills")})`;
  console.log(`Installed Cursor skill "${SKILL_DIR}" to ${scope}:\n  ${dest}`);
  console.log("Restart Cursor or reload the window if the skill does not appear immediately.");
}
