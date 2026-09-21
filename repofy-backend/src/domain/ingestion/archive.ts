import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Header, Parser, type ReadEntry } from "tar";
import { checkSignal, IngestionError, safeError } from "./errors";
import type { IngestionLimits } from "./policy";

interface Entry { path: string; size: number; directory: boolean }
/** Physical tar framing: count even empty metadata headers and reject trailing
 * smuggled members. Header decoding/checksums stay in the maintained tar parser.
 * PAX size/sparse overrides are unsupported, so physical sizes are authoritative. */
class TarFrames {
  #header = Buffer.alloc(512); #used = 0; #body = 0; #zeros = 0;
  entries = 0;
  constructor(private readonly limits: IngestionLimits) {}
  write(bytes: Buffer) {
    let offset = 0;
    while (offset < bytes.length) {
      if (this.#zeros >= 2) { if (bytes.subarray(offset).some(byte => byte !== 0)) throw new IngestionError("ARCHIVE_INVALID"); return; }
      if (this.#body) { const count = Math.min(this.#body, bytes.length - offset); this.#body -= count; offset += count; continue; }
      const count = Math.min(512 - this.#used, bytes.length - offset);
      bytes.copy(this.#header, this.#used, offset, offset + count); this.#used += count; offset += count;
      if (this.#used < 512) continue;
      this.#used = 0; const header = new Header(this.#header);
      if (header.nullBlock) { this.#zeros++; continue; }
      if (this.#zeros || !header.cksumValid) throw new IngestionError("ARCHIVE_INVALID");
      if (++this.entries > this.limits.archiveEntries || !Number.isSafeInteger(header.size) || header.size! < 0 || header.size! > this.limits.decompressedBytes) throw new IngestionError("ARCHIVE_LIMIT");
      if (!["File", "Directory", "ExtendedHeader", "GlobalExtendedHeader"].includes(header.type)) throw new IngestionError("UNSAFE_ENTRY");
      if (header.type.endsWith("ExtendedHeader") && header.size! > 65536) throw new IngestionError("ARCHIVE_LIMIT");
      this.#body = Math.ceil(header.size! / 512) * 512;
    }
  }
  end() { if (this.#used || this.#body || this.#zeros < 2) throw new IngestionError("ARCHIVE_INVALID"); }
}
/** Parses only. Never applies archive modes, ownership, paths, links or files to disk. */
export async function visitArchive(archive: string, limits: IngestionLimits, signal: AbortSignal,
  accept: (entry: Entry) => boolean, visit: (entry: Entry, bytes: Buffer) => void) {
  let root: string | undefined; const paths = new Map<string, boolean>(); const ancestors = new Set<string>();
  let files = 0; let decompressedBytes = 0; let failure: IngestionError | undefined;
  let eof = false; let prefix = Buffer.alloc(0); let started = false; const frames = new TarFrames(limits);
  const parser = new Parser({ strict: true, maxMetaEntrySize: 65536, gzip: false, brotli: false, zstd: false });
  const fail = (error: unknown) => { failure ??= safeError(error, "ARCHIVE_INVALID"); };
  parser.on("error", () => fail(new IngestionError("ARCHIVE_INVALID")));
  parser.on("ignoredEntry", () => fail(new IngestionError("UNSAFE_ENTRY")));
  parser.on("meta", (value: string) => {
    // Reject interpretation-changing extensions and unknown parser coverage.
    if (value.split("\n").filter(Boolean).some(line => !/^\d+ (?:path|mtime|atime|ctime|comment)=/.test(line))) fail(new IngestionError("UNSAFE_ENTRY"));
  });
  parser.on("eof", () => { eof = true; });
  parser.on("entry", (entry: ReadEntry) => {
    try {
      checkSignal(signal);
      if (!Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > limits.decompressedBytes) throw new IngestionError("ARCHIVE_LIMIT");
      if (!["File", "Directory"].includes(entry.type) || entry.linkpath || (entry.type === "Directory" && entry.size !== 0)) throw new IngestionError("UNSAFE_ENTRY");
      const raw = entry.type === "Directory" ? entry.path.replace(/\/$/, "") : entry.path;
      const parts = raw.split("/");
      if (Buffer.byteLength(raw) > limits.pathBytes || parts.length > limits.pathDepth || /[\\:\x00-\x1f\x7f\ufffd\u202a-\u202e\u2066-\u2069]/.test(raw)
        || parts.some(p => !p || p === "." || p === ".." || /[. ]$/.test(p))) throw new IngestionError("UNSAFE_PATH");
      root ??= parts[0];
      if (root !== parts[0] || (parts.length === 1 && entry.type !== "Directory")) throw new IngestionError("UNSAFE_PATH");
      const path = parts.slice(1).join("/").normalize("NFC"); const directory = entry.type === "Directory";
      if (paths.has(path) || path.split("/").some((_, i, all) => paths.get(all.slice(0, i).join("/")) === false)
        || (!directory && ancestors.has(path))) throw new IngestionError("UNSAFE_PATH");
      paths.set(path, directory);
      path.split("/").forEach((_, i, all) => { ancestors.add(all.slice(0, i).join("/")); });
      if (!directory) files++;
      const descriptor = { path, size: entry.size, directory };
      const keep = !directory && accept(descriptor);
      // Callers only request bounded text/policy files. Defense against accidental buffering of a large member.
      if (keep && entry.size > Math.max(limits.fileBytes, 65536)) throw new IngestionError("ARCHIVE_LIMIT");
      const chunks: Buffer[] = []; let size = 0;
      entry.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > entry.size) fail(new IngestionError("ARCHIVE_INVALID"));
        if (keep && !failure) chunks.push(chunk);
      });
      entry.on("end", () => {
        if (size !== entry.size) fail(new IngestionError("ARCHIVE_INVALID"));
        if (keep && !failure) {
          const bytes = Buffer.concat(chunks);
          try { checkSignal(signal); visit(descriptor, bytes); } catch (error) { fail(error); }
          finally { bytes.fill(0); chunks.length = 0; }
        }
      });
      entry.resume();
    } catch (error) { fail(error); entry.resume(); }
  });
  try {
    const file = await open(archive, constants.O_RDONLY | constants.O_NOFOLLOW);
    await pipeline(file.createReadStream({ highWaterMark: 65536 }),
      createGunzip({ chunkSize: 65536 }), new Writable({ write(chunk: Buffer, _encoding, done) {
        try {
          checkSignal(signal); decompressedBytes += chunk.length;
          if (decompressedBytes > limits.decompressedBytes) throw new IngestionError("ARCHIVE_LIMIT");
          // Check framing before the parser can auto-decompress a second layer.
          frames.write(chunk);
          if (!started) {
            prefix = Buffer.concat([prefix, chunk]);
            if (prefix.length < 512) { done(); return; }
            started = true; parser.write(prefix); prefix = Buffer.alloc(0);
          } else parser.write(chunk);
          if (failure) throw failure;
          done();
        } catch (error) { done(safeError(error, "ARCHIVE_INVALID")); }
      } }), { signal });
    parser.end();
    frames.end();
    if (failure) throw failure;
    if (!eof || !root) throw new IngestionError("ARCHIVE_INVALID");
    return { archiveEntries: frames.entries, totalFiles: files, decompressedBytes };
  } catch (error) { checkSignal(signal); throw safeError(error, "ARCHIVE_INVALID"); }
}
