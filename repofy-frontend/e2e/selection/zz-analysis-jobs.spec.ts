import { test, expect } from '@playwright/test';
import coverageFixture from '../../../docs/benchmarks/run10-example-coverage.json';

test('saved selection starts one durable job after a lost response, resumes on reload, polls and cancels', async ({page,context,request})=>{
  const session=await(await request.get('http://127.0.0.1:3191/__test/session')).json();
  await context.addCookies([{name:'access_token',value:session.token,domain:'127.0.0.1',path:'/'}]);
  await request.post('http://127.0.0.1:3191/__test/analysis-intake');
  await page.goto('/readiness/new');
  await page.getByLabel('GitHub identity').selectOption({label:'fixture-one — connected'});
  await expect(page.getByLabel('Installation').getByRole('option',{name:/fixture-org/})).toHaveCount(1);
  await page.getByLabel('Installation',{exact:true}).selectOption({label:'fixture-org — Organization, active'});
  await page.getByRole('button',{name:'Load more repositories'}).click();
  await page.getByRole('checkbox',{name:/fixture-org\/synthetic-private-301/}).check();
  await page.getByRole('checkbox',{name:/I own or am authorized/}).check();
  await page.getByRole('button',{name:'Save selection'}).click();
  await expect(page.getByRole('button',{name:'Remove access to fixture-org/synthetic-private-301'})).toBeVisible();
  let intercepted=false;let committedJob='';let firstKey='';
  await page.route('**/api/v1/analyses',async route=>{
    if(route.request().method()!=='POST'||intercepted){await route.continue();return;}
    intercepted=true;firstKey=route.request().postDataJSON().idempotencyKey;
    const response=await route.fetch();expect(response.status()).toBe(202);committedJob=(await response.json()).data.jobId;
    await route.abort('failed'); // Commit succeeded, browser did not receive its acknowledgement.
  });
  await page.getByRole('button',{name:'Start Analysis'}).click();await expect(page.getByRole('alert')).toBeVisible();
  await page.reload(); // Pending idempotency key is scoped to this owner and saved revision.
  const replay=page.waitForRequest(req=>req.method()==='POST'&&req.url().endsWith('/api/v1/analyses'));
  await page.getByRole('button',{name:'Start Analysis'}).click();expect((await replay).postDataJSON().idempotencyKey).toBe(firstKey);
  await expect(page).toHaveURL(`/readiness/jobs/${committedJob}`);
  await expect(page.getByText('Waiting for a worker')).toBeVisible();await page.reload();
  await expect(page.getByText('Waiting for a worker')).toBeVisible();
  await request.post('http://127.0.0.1:3191/__test/analysis-claim');
  await expect(page.getByText('Checking repository access')).toBeVisible({timeout:10000});
  // Render the real Run 10 synthetic extraction DTO on the real owner progress page.
  await page.route(`**/api/v1/analyses/${committedJob}`, async route => {
    if (route.request().method() !== 'GET') { await route.continue(); return; }
    const response = await route.fetch(); const body = await response.json();
    body.data.coverage = [coverageFixture]; await route.fulfill({ response, json: body });
  });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Analyzer coverage' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Python Baseline structure 1 \/ 1 0/ })).toBeVisible();
  await page.getByText('Capability assessment scope', { exact: true }).click();
  await expect(page.getByText('mobile lifecycle: Not assessable', { exact: true })).toBeVisible();
  await expect(page.getByText('api design: Evidence not observed within assessed scope', { exact: true })).toBeVisible();
  await page.getByText('Capability assessment scope', { exact: true }).click();
  await page.screenshot({path:'test-results/analysis-progress.png',fullPage:true});
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole('list', { name: 'Achieved language coverage' })).toBeVisible();
  await expect(page.getByText('Swift: Inventory only', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/analysis-coverage-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.getByRole('button',{name:'Cancel analysis'}).click();await expect(page.getByText('Analysis canceled')).toBeVisible();
  await page.goto('/readiness/jobs');await expect(page.getByRole('article')).toHaveCount(1);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/analysis-history-mobile.png',fullPage:true});
});
