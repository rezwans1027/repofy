# Run 09 detector review sample

Status: sample review complete on 2026-09-20. Reviewer: the user in this conversation. The reviewer confirmed all four expected labels: “Reviewed; agree with all four labels”. This was an unblinded review of a convenience sample; the expected labels were shown before confirmation. The 64 synthetic detector cases remain implementation regression tests, not a measured precision benchmark.

The reviewer assessed each **narrow claim** as supported or unsupported. All code below is invented; imports refer to the literal named APIs and included local functions. Runtime success is never claimed.

| ID | Narrow claim | Detector expectation | Human label | Disagreement |
| --- | --- | --- | --- | --- |
| A | The parsed request value is passed to a local function. | Unsupported | Unsupported | None reported |
| B | A missing-user guard checks resource ownership. | Unsupported | Unsupported | None reported |
| C | A pg query passes values separately from literal SQL. | Supported | Supported | None reported |
| D | This test assertion consumes the local implementation result. | Unsupported | Unsupported | None reported |

A — disconnected validation result:

```ts
import express from 'express';
import { z } from 'zod';
import { save } from './service';
const app = express();
const schema = z.object({ title: z.string() });
app.post('/example', (req, res) => {
  const parsed = schema.parse(req.body);
  return save(req.body);
});
```

B — authentication state versus ownership:

```ts
app.post('/example', (req, res) => {
  if (!req.user) return res.status(401).json({code: 'DENIED'});
  return save(req.user);
});
```

C — parameter separation, without a system-wide SQL safety claim:

```ts
import { Pool } from 'pg';
const db = new Pool();
export async function read(id) {
  return await db.query('SELECT id FROM things WHERE id=$1', [id]);
}
```

D — an unrelated assertion:

```ts
import { test, expect } from 'vitest';
import { add } from './service';
test('rejects unauthorized', () => {
  add(1);
  expect(true).toBe(true);
});
```

Recorded 2026-09-20T15:12:24Z. Agreement: **4 matching labels / 4 determinate human labels (100%)**; **0 disagreements**, **0 uncertain labels**, **1 reviewer**. No disagreement reasons were supplied because all labels were accepted. This completes Run 09's labeled-sample review requirement.

This small, unblinded sample does not establish production precision, recall or agreement across reviewers. Broader blinded, independently labeled repositories and adversarial examples remain required before calibration or release. Detector confidence/strength values and immutable bundle definitions remain unchanged and uncalibrated.
