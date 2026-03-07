import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createAuthTestDb, insertPendingSignup, getAttempts } from "../helpers/pglite-db";

let db: PGlite;

beforeAll(async () => {
  db = await createAuthTestDb();
}, 30_000);

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec("DELETE FROM pending_signups");
});

// ── helper ──

interface IncrementRow {
  email: string;
  display_name: string;
  otp_code: string;
  otp_expires_at: string;
  attempts: number;
  created_at: string;
}

async function incrementAttempt(
  email: string,
  maxAttempts: number,
): Promise<IncrementRow[]> {
  const r = await db.query<IncrementRow>(
    "SELECT * FROM increment_otp_attempt($1, $2)",
    [email, maxAttempts],
  );
  return r.rows;
}

// ── increment_otp_attempt ──

describe("increment_otp_attempt (real SQL)", () => {
  it("increments attempts from 0 to 1 and returns the row", async () => {
    await insertPendingSignup(db, "a@b.com", "Alice", "hashed", 0);

    const rows = await incrementAttempt("a@b.com", 5);

    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("a@b.com");
    expect(rows[0].display_name).toBe("Alice");
    expect(rows[0].attempts).toBe(1);
  });

  it("returns empty when attempts already at max", async () => {
    await insertPendingSignup(db, "locked@b.com", "Locked", "hashed", 5);

    const rows = await incrementAttempt("locked@b.com", 5);

    expect(rows).toHaveLength(0);
  });

  it("returns empty for expired row", async () => {
    await insertPendingSignup(db, "expired@b.com", "Exp", "hashed", 0, -10);

    const rows = await incrementAttempt("expired@b.com", 5);

    expect(rows).toHaveLength(0);
  });

  it("returns empty for non-existent email", async () => {
    const rows = await incrementAttempt("ghost@b.com", 5);

    expect(rows).toHaveLength(0);
  });

  it("correctly serializes concurrent calls", async () => {
    await insertPendingSignup(db, "race@b.com", "Racer", "hashed", 3);

    // Fire two increments concurrently (max=5 means max index 4, so 3→4 and 4→5)
    const [r1, r2] = await Promise.all([
      incrementAttempt("race@b.com", 5),
      incrementAttempt("race@b.com", 5),
    ]);

    // Both should succeed since 3 < 5 and 4 < 5
    expect(r1.length + r2.length).toBe(2);

    const finalAttempts = await getAttempts(db, "race@b.com");
    expect(finalAttempts).toBe(5);
  });

  it("stops at max — third concurrent call returns empty", async () => {
    await insertPendingSignup(db, "max@b.com", "Max", "hashed", 4);

    // attempts=4, max=5 → only one can succeed
    const [r1, r2] = await Promise.all([
      incrementAttempt("max@b.com", 5),
      incrementAttempt("max@b.com", 5),
    ]);

    // Exactly one should succeed, one should be empty
    const successCount = [r1, r2].filter((r) => r.length > 0).length;
    expect(successCount).toBe(1);

    const finalAttempts = await getAttempts(db, "max@b.com");
    expect(finalAttempts).toBe(5);
  });
});
