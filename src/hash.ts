import { createHash } from "node:crypto";

export function sha256Utf8(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function byteLenUtf8(s: string): number {
  return new TextEncoder().encode(s).byteLength;
}
