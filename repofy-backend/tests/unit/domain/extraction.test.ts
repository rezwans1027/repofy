import { afterEach, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { extractionFixture } from '../../helpers/extraction-fixtures';
import fixtures from '../../fixtures/evidence/repositories.json';
import { dataDocument, sourceFile } from '../../../src/domain/extraction/parsers';
import { EXTRACTORS, createStructuralExtraction, extractSnapshot } from '../../../src/domain/extraction/pipeline';
import { EXTRACTION_LIMITS, extractionProfile, ParseFailure } from '../../../src/domain/extraction/policy';
import { emptyMetadata, MetadataBatchSchema, providerDetail } from '../../../src/domain/extraction/metadata';
import { containsSqlData, mandatoryExclusion } from '../../../src/domain/ingestion/exclusions';
import { securityPolicy, structuralSecurityPolicy, policyHash } from '../../../src/domain/ingestion/policy';
import { SnapshotBundleSchema } from '../../../src/domain/analysis/persistence';
import { associate, classify } from '../../../src/domain/extraction/inventory';

let f: Awaited<ReturnType<typeof extractionFixture>> | undefined;
afterEach(async () => { await f?.cleanup(); f = undefined; });
it('extracts exact structural semantics through the real filtered snapshot boundary', async () => {
  f = await extractionFixture(fixtures.monorepo); const { bundle, metrics } = await f.extract();
  expect(bundle.inventorySummary).toMatchObject({ totalFiles: 19, eligibleFiles: 14, excludedFiles: 5, analyzedFiles: 12,
    testFiles: 1, ciFiles: 1, documentationFiles: 1, structural: { projectManifests: 3, nestedProjects: 2, lockfiles: 1,
      exclusions: { sensitive_path: 3, dependency: 1, generated: 1 } } });
  const byPath = (path: string) => bundle.evidence.find(e => e.locator.kind === 'file' && e.locator.path === path)!;
  expect(byPath('package.json')).toMatchObject({ sourceType: 'dependency', capabilityIds: [], structural: { claimBoundary: 'dependency_presence',
    counts: { production: 3, development: 1, optional: 1, peer: 1, aliased: 1, workspace: 1, workspacePatterns: 1 }, technologies: ['express','react','vitest'] } });
  expect(byPath('package-lock.json').structural?.counts).toMatchObject({ packages: 4, production: 1, transitive: 1, workspace: 2 });
  expect(byPath('packages/api/tests/add.test.ts').structural).toMatchObject({ counts: { suites: 1, tests: 2, assertions: 1, skipped: 1 }, claimBoundary: 'test_candidates_only' });
  const implementation = bundle.files.find(file => file.locator.kind === 'file' && file.locator.path === 'packages/api/src/add.ts')!;
  expect(byPath('packages/api/tests/add.test.ts').structural?.associatedFileIds).toEqual([implementation.locatorId]);
  expect(byPath('.github/workflows/check.yml').structural).toMatchObject({ claimBoundary: 'configuration_presence', counts: { jobs: 1, steps: 2, testCommands: 1, conditionalJobs: 1, skipped: 1 } });
  expect(byPath('migrations/001_create.sql').structural?.counts).toEqual({ tables: 1, indexes: 1, alterations: 1 });
  expect(byPath('Dockerfile').structural?.counts).toEqual({ instructions: 6, stages: 2 });
  expect(byPath('next.config.ts').structural?.limitations.join(' ')).toContain('dynamic or ambiguous');
  expect((globalThis as any).__repofyExecuted).toBeUndefined();
  expect(implementation.structure?.projectLocatorId).toBe(bundle.files.find(file => file.locator.kind === 'file' && file.locator.path === 'packages/api/package.json')?.locatorId);
  expect(JSON.stringify(bundle.evidence.map(({ locator, fingerprint, ...rest }) => rest))).not.toMatch(/PRIVATE_PROSE_SENTINEL|TEST_ONLY_PRIVATE_DATA|makeConfiguration|node_modules/);
  expect(metrics).toMatchObject({ files: 14, analyzed: 12, parseFailures: 1, evidence: 12, truncated: false });
});
it('normalizes repeated stages and fresh context locator IDs deterministically', async () => {
  f = await extractionFixture(fixtures.monorepo); const first = await f.extract(); const second = await f.extract();
  expect(second.bundle).toEqual(first.bundle);
  const context = await f.service.prepareSafeSnapshot(f.store.request);
  try { expect((await extractSnapshot(context, f.input)).bundle).toEqual(first.bundle); } finally { await context.dispose(); }
  expect(new Set(first.bundle.evidence.map(e => e.evidenceId)).size).toBe(first.bundle.evidence.length);
});
it.each(['documentationOnly','dependencyOnly'] as const)('keeps %s claims within their source family', async key => {
  f = await extractionFixture(fixtures[key]); const { bundle } = await f.extract();
  expect(bundle.evidence.map(e => e.sourceType)).toEqual([key === 'documentationOnly' ? 'docs' : 'dependency']);
  expect(bundle.evidence[0].capabilityIds).toEqual([]);
  expect(bundle.coverage.structural?.sources.find(s => s.source === 'tests')).toMatchObject({ eligibleFiles: 0, analyzedFiles: 0 });
  if (key === 'dependencyOnly') expect(bundle.evidence[0].structural?.technologies).toEqual(['nestjs']);
});
it('retains failed and unsupported files in denominators, with no invented zero skill', async () => {
  f = await extractionFixture(fixtures.malformed); const { bundle } = await f.extract();
  expect(bundle.inventorySummary).toMatchObject({ totalFiles: 4, eligibleFiles: 4, analyzedFiles: 0 });
  expect(bundle.coverage.structural?.sources.find(s => s.source === 'manifests')).toMatchObject({ parseFailures: 1 });
  expect(bundle.coverage.structural?.sources.find(s => s.source === 'configuration')).toMatchObject({ unsupportedFiles: 1 });
  expect(bundle.evidence).toEqual([]);
  expect(bundle.coverage.languages.every(l => l.state === 'assessed' && l.eligibleFiles === 1 && l.analyzedFiles === 0 && l.limitations.length)).toBe(true);
});
it('records processing limits and security exclusions separately from parse failures', async () => {
  f = await extractionFixture({ 'large.json': ' '.repeat(EXTRACTION_LIMITS.fileBytes + 1), 'migrations/data.sql': 'INSERT INTO x VALUES (1)', 'plain.txt': Buffer.from([0,1]), 'empty.sql': '-- excluded by path' });
  const { bundle } = await f.extract();
  expect(bundle.inventorySummary).toMatchObject({ totalFiles: 4, eligibleFiles: 1, excludedFiles: 3, analyzedFiles: 0 });
  expect(bundle.coverage.structural?.sources.find(s => s.source === 'configuration')).toMatchObject({ limitedFiles: 1, parseFailures: 0 });
});
it('adds a policy identity for lockfiles and schema SQL without weakening old pins', () => {
  expect(mandatoryExclusion('package-lock.json')).toBe('generated'); expect(mandatoryExclusion('schema.sql')).toBe('sensitive_path');
  expect(mandatoryExclusion('package-lock.json','1.1.0')).toBeUndefined(); expect(mandatoryExclusion('schema.sql','1.1.0')).toBeUndefined();
  expect(mandatoryExclusion('database/migrations/001.sql','1.1.0')).toBeUndefined();
  for (const path of ['dump.sql','migrations/seed.sql','backups/schema.sql','node_modules/package-lock.json','secrets/schema.sql']) expect(mandatoryExclusion(path,'1.1.0')).toBeTruthy();
  expect(policyHash(securityPolicy())).not.toBe(policyHash(structuralSecurityPolicy()));
});
it('does not expose data-bearing SQL or planted secret test material', async () => {
  f = await extractionFixture({ 'migrations/002.sql': "INSERT INTO people VALUES ('TEST_ONLY_DATA')", 'src/value.ts': `export const secret = 'ghp_${'A'.repeat(36)}'`, 'ok.ts':'export const x=1;' });
  const { bundle } = await f.extract(); expect(bundle.inventorySummary).toMatchObject({ totalFiles: 3, eligibleFiles: 1 });
  expect(bundle.inventorySummary.structural?.exclusions.secret_or_sensitive_data).toBe(2);
  expect(JSON.stringify(bundle)).not.toMatch(/TEST_ONLY_DATA|ghp_/);
});
it('screens comment-separated and long-column-list SQL data statements',()=>{
  for(const text of ["INSERT /* nested /* content */ tail */ INTO x VALUES ('TEST_ONLY_DATA')",`COPY x (${Array.from({length:500},(_,i)=>'x'+i).join(',')}) FROM stdin`,
    "UPDATE x SET private_value='TEST_ONLY_DATA'",'DELETE -- newline\n FROM x','MERGE INTO x USING y ON x.id=y.id','/* unterminated']) expect(containsSqlData(text)).toBe(true);
  expect(containsSqlData('CREATE TABLE x(id int); /* comment */ CREATE INDEX idx ON x(id);')).toBe(false);
});
it('handles an entirely excluded repository with unknown language coverage', async () => {
  f = await extractionFixture({ '.env':'TEST_ONLY=none' }); const { bundle } = await f.extract();
  expect(bundle.files).toEqual([]); expect(bundle.inventorySummary.totalFiles).toBe(1);
  expect(bundle.coverage.languages[0]).toMatchObject({ state:'unknown', reasons:['no_eligible_files'] });
});
it('supports explicitly disabled extractors only with a new recorded version', async () => {
  f = await extractionFixture(fixtures.documentationOnly); const profile = extractionProfile(['documentation']);
  await expect(f.extract({ profile })).rejects.toMatchObject({code:'ANALYSIS_VALIDATION_FAILED'});
  const { bundle } = await f.extract({ profile, versions:{...f.input.versions, extractorBundle:profile.extractorBundle} });
  expect(bundle.inventorySummary.analyzedFiles).toBe(0); expect(bundle.coverage.structural?.disabledExtractors).toEqual(['documentation']);
  expect(() => extractionProfile(['source','source'])).toThrow();
});
it('propagates grant revocation, cancellation and version/metadata binding violations', async () => {
  f = await extractionFixture(fixtures.dependencyOnly);
  await expect(f.extract({ signal:AbortSignal.abort() })).rejects.toThrow();
  await expect(f.extract({ versions:{...f.input.versions,coverageManifest:'9.0.0'} })).rejects.toMatchObject({code:'ANALYSIS_VALIDATION_FAILED'});
  const metadata=emptyMetadata(f.input.pin.repositoryId,'b'.repeat(40),f.input.options);
  await expect(f.extract({ metadata })).rejects.toMatchObject({code:'ANALYSIS_VALIDATION_FAILED'});
  f.store.revoked=true; await expect(f.extract()).rejects.toMatchObject({code:'ACCESS_REVOKED'});
});
it('captures permission limitations and keeps mutable metadata out of unrelated artifact reuse', async () => {
  f = await extractionFixture(fixtures.dependencyOnly); const options={commits:false,pullRequests:false,ci:true};
  const metadata=emptyMetadata(f.input.pin.repositoryId,f.input.pin.commitSha,options);
  metadata.groups[2].coverage.state='permission_denied'; const first=await f.extract({options,metadata});
  expect(first.bundle.coverage.structural?.metadata[2]).toMatchObject({state:'permission_denied',records:0});
  const record={objectId:'checks_10',detail:providerDetail('check',{retrievedAt:'2026-09-20T00:00:00Z',subjectSha:'b'.repeat(40),relationship:'repository_context',result:'success',authorMatch:'unavailable',authorType:'unknown'})};
  metadata.groups[2]={coverage:{source:'checks',state:'available',records:1,exactCommitRecords:0,retrievedAt:'2026-09-20T00:00:00Z'},records:[record]};
  const second=await f.extract({options,metadata});
  expect(second.bundle.snapshot.snapshotId).not.toBe(first.bundle.snapshot.snapshotId);
  expect(second.bundle.evidence.find(e=>e.sourceType==='ci')?.structural?.claimBoundary).toBe('historical_context');
  expect((await f.extract({options,metadata:{...metadata,groups:[...metadata.groups].reverse()}})).bundle).toEqual(second.bundle);
  record.detail.provider!.relationship='exact_commit'; expect(MetadataBatchSchema.safeParse(metadata).success).toBe(false);
});
it('normalizes all eight evidence source types, including associated PR metadata',async()=>{
  f=await extractionFixture(fixtures.monorepo);const options={commits:true,pullRequests:true,ci:true};
  const metadata=emptyMetadata(f.input.pin.repositoryId,f.input.pin.commitSha,options);
  const kinds={commits:'commit',pullRequests:'pull_request',checks:'check',statuses:'status',actions:'action'} as const;
  for(const group of metadata.groups){
    group.coverage={...group.coverage,state:'available',records:1,exactCommitRecords:1,retrievedAt:'2026-09-20T00:00:00Z'};
    group.records=[{objectId:`${group.coverage.source}_10`,detail:providerDetail(kinds[group.coverage.source],{retrievedAt:'2026-09-20T00:00:00Z',
      subjectSha:f.input.pin.commitSha,relationship:'exact_commit',result:group.coverage.source==='commits'?'unknown':group.coverage.source==='pullRequests'?'merged':'success',authorMatch:'connected_identity',authorType:'User'})}];
  }
  const {bundle}=await f.extract({options,metadata});
  expect([...new Set(bundle.evidence.map(e=>e.sourceType))].sort()).toEqual(['ci','code','commit','config','dependency','docs','pull_request','test']);
  expect(bundle.evidence.find(e=>e.sourceType==='pull_request')?.detector.id).toBe('structural.provider.pull_requests.pull_request');
  expect(bundle.evidence.filter(e=>e.locator.kind==='provider_metadata')).toHaveLength(5);
});
it('validates counter and evidence membership before storage', async () => {
  f=await extractionFixture(fixtures.monorepo); const {bundle}=await f.extract();
  const wrong=structuredClone(bundle); wrong.inventorySummary.structural!.exclusions.binary++;
  expect(SnapshotBundleSchema.safeParse(wrong).success).toBe(false);
  const association=structuredClone(bundle); association.evidence.find(e=>e.sourceType==='test')!.structural!.associatedFileIds=['00000000-0000-4000-8000-000000000001' as any];
  expect(SnapshotBundleSchema.safeParse(association).success).toBe(false);
});
it('exports safe timing/counters from the Run 07 handler without logging contents', async () => {
  f=await extractionFixture(fixtures.dependencyOnly); const record=vi.fn(); const handler=createStructuralExtraction(f.input.crypto,undefined,[],record);
  const bundle=await handler.extract(f.context,{request:{includeMetadata:f.input.options},policy:{versions:f.input.versions}} as any,f.input.signal,f.input.pin);
  expect(bundle.evidence).toHaveLength(1); expect(record).toHaveBeenCalledWith(expect.objectContaining({files:1,analyzed:1,evidence:1,durationMs:expect.any(Number)}));
  expect(JSON.stringify(record.mock.calls)).not.toMatch(/repository|path|source|redis|nestjs/);
});
it.each([
  ['json','{"a":1,"a":2}'], ['yaml','value: !custom content'], ['yaml','x: &x 1\ny: *x'], ['yaml','a: [1'], ['toml','a=1\na=2'],
] as const)('rejects malformed or ambiguous %s without source in errors', (format,text) => {
  expect(()=>dataDocument(text,format)).toThrow(ParseFailure);
});
it('bounds parser depth, AST depth and oversized documents', () => {
  expect(()=>dataDocument('{"a":'.repeat(100)+'0'+'}'.repeat(100),'json')).toThrow('limited');
  expect(()=>sourceFile('('.repeat(100)+'x'+')'.repeat(100),'x.ts')).toThrow('limited');
  expect(()=>dataDocument('x'.repeat(EXTRACTION_LIMITS.fileBytes+1),'yaml')).toThrow('limited');
});
it.each([
  ['pyproject.toml','[project]\ndependencies=["fastapi>=1"]\n[project.optional-dependencies]\ntest=["pytest"]\n', {production:1,optional:1}, ['fastapi','pytest']],
  ['requirements-dev.txt','pytest>=8\n# a comment\n', {development:1}, ['pytest']],
  ['pnpm-lock.yaml',"lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      react:\n        specifier: ^19\n        version: 19\npackages:\n  react@19: {}\n  scheduler@1: {}\n",{production:1,transitive:1,packages:2},['react']],
] as const)('supports bounded %s declarations', (path,text,counts,technologies) => {
  const result=EXTRACTORS.manifests.extract({path,text,...classify(path)});
  expect(result.findings[0].detail).toMatchObject({counts,technologies});
});
it.each([['package-lock.json','{"lockfileVersion":1}'],['requirements.txt','-r other.txt'],['pyproject.toml','[tool.poetry]\nname="x"'],['pom.xml','<project/>'],['yarn.lock','package@1:\n version "1"']])('labels unsupported %s explicitly', (path,text) => {
  expect(()=>EXTRACTORS.manifests.extract({path,text,...classify(path)})).toThrow('unsupported');
});
it('associations are exact relative imports, never ambiguous aliases or traversal', () => {
  const paths=new Set(['src/x.ts','src/x.js','src/y.ts']);
  expect(associate('../src/x','tests/a.test.ts',paths)).toBeUndefined();
  expect(associate('../src/y','tests/a.test.ts',paths)).toBe('src/y.ts');
  expect(associate('@app/y','tests/a.test.ts',paths)).toBeUndefined();
  expect(associate('../../etc/passwd','tests/a.test.ts',paths)).toBeUndefined();
});
it('extractor modules have no repository execution or filesystem/network APIs', async () => {
  for(const name of ['configuration','source','manifests','parsers','inventory']){
    const source=await readFile(resolve(__dirname,`../../../src/domain/extraction/${name}.ts`),'utf8');
    expect(source).not.toMatch(/node:(?:fs|child_process|vm|http|net)|\b(?:eval|fetch|createProgram|createCompilerHost|transpileModule)\s*\(/);
  }
});
it('keeps missing, malformed and unsupported project manifests as boundary candidates',async()=>{
  f=await extractionFixture({'package.json':'{broken}','app/pyproject.toml':'[tool.custom]\nvalue=1','app/test_example.py':'def test_it(): pass','unrelated/main.go':'package main'});
  const {bundle}=await f.extract();expect(bundle.inventorySummary.structural).toMatchObject({projectManifests:2,nestedProjects:1});
  const test=bundle.files.find(file=>file.language==='python')!;
  expect(bundle.evidence.find(e=>e.sourceType==='test')?.structural).toMatchObject({confidenceBasis:'filename_only',claimBoundary:'test_candidates_only'});
  expect(bundle.coverage.languages.find(l=>l.language==='python')).toMatchObject({depth:'inventory'});
  expect(test.structure?.projectLocatorId).toBe(bundle.files.find(file=>file.language==='toml')?.locatorId);
});
it('does not count documentation examples or SQL strings/comments as executed structure',()=>{
  const sql="-- CREATE TABLE fake(x int);\n/* CREATE INDEX fake ON t(x); */\nCREATE FUNCTION fn() RETURNS text AS $$ BEGIN RETURN 'CREATE TABLE nope(x int)'; END; $$ LANGUAGE plpgsql; CREATE TABLE actual(id int);";
  expect(EXTRACTORS.schemas.extract({path:'schema.sql',text:sql,...classify('schema.sql')}).findings[0].detail.counts).toEqual({tables:1,indexes:0,alterations:0});
  const docs=EXTRACTORS.documentation.extract({path:'README.md',text:'# Setup\n```ts\ndescribe("fake",()=>expect(true).toBe(true))\n```\n## Architecture\n',...classify('README.md')});
  expect(docs.findings[0]).toMatchObject({sourceType:'docs',detail:{counts:{headings:2,architectureHeadings:1,codeBlocks:1},claimBoundary:'documentation_only'}});
});
it('counts no schema signal independently of unsupported syntax and malformed inputs',()=>{
  expect(EXTRACTORS.schemas.extract({path:'schema.sql',text:'-- no DDL',...classify('schema.sql')})).toMatchObject({state:'analyzed',findings:[]});
  expect(()=>EXTRACTORS.schemas.extract({path:'schema.sql',text:"'unterminated",...classify('schema.sql')})).toThrow('parse_failure');
  expect(()=>EXTRACTORS.configuration.extract({path:'Dockerfile',text:'CUSTOM_INSTRUCTION x',...classify('Dockerfile')})).toThrow('unsupported');
  expect(()=>EXTRACTORS.ci.extract({path:'.github/workflows/x.yml',text:'name: empty',...classify('.github/workflows/x.yml')})).toThrow('parse_failure');
});
it('does not count framework setup helpers as tests or assertions',()=>{
  const path='tests/example.test.ts';const text="test.use({});test.beforeEach(()=>{});test.describe.configure({mode:'parallel'});expect.extend({});test.skip(true,'conditional');test.describe('group',()=>{});it.each([1,2])('case',()=>expect(1).toBe(1));";
  expect(EXTRACTORS.tests.extract({path,text,...classify(path)}).findings[0].detail.counts).toMatchObject({tests:1,suites:1,assertions:1,skipped:0});
});
it('truncates findings at a deterministic budget while preserving the inventory denominator',async()=>{
  f=await extractionFixture(Object.fromEntries(Array.from({length:2001},(_,i)=>[`src/file-${i}.ts`,'export const x=1;'])));
  const {bundle,metrics}=await f.extract();expect(bundle.inventorySummary).toMatchObject({eligibleFiles:2001,analyzedFiles:2001});
  expect(bundle.evidence).toHaveLength(2000);expect(bundle.coverage.structural?.evidenceTruncated).toBe(true);expect(metrics.truncated).toBe(true);
});
