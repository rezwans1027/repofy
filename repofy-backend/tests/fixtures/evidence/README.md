# Run 08 structural benchmark seeds

All repositories and provider responses are synthetic, authored for these tests. They are development fixtures, not held-out calibration data. No private repository was copied. Any planted `ghp_` string is deliberately invalid **TEST MATERIAL**, never a credential.

`repositories.json` exercises monorepo boundaries, scoped and aliased dependencies, lockfile records, test candidates, disabled jobs, schema structure, untrusted documentation and security exclusions. Unit tests assert individual semantic facts and claim boundaries rather than large output snapshots. Run 16 should version a separate held-out corpus.

Run 09's `implementation.ts` adds the 16 positive/false-positive/limitation/mutation detector cases. Run 10's `language-coverage.ts` adds Python/Java single- and multi-module projects, mixed SQL/CI/unsupported source, malformed/build-script/native/generated/empty/excluded/oversized inputs. Expected file denominators are asserted directly. Run 10 also runs the existing ecosystem inventory and all Run 09 patterns under its new profile. [The coverage matrix](../../../../docs/benchmarks/run10-coverage-matrix.json) records synthetic outcomes; it is not precision calibration.
