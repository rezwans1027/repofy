import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { REPOSITORY_ATTESTATION_TEXT, AnalysisJobResponseSchema, SavedRepositorySelectionSchema, type AnalysisJobResponse } from '@repofy/contracts';
import { AnalysisProgress, StartAnalysisButton } from './analysis-progress';
import { api } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';
import { useRouter } from 'next/navigation';
vi.mock('@/lib/api-client', async original=>({...await original<typeof import('@/lib/api-client')>(),api:{get:vi.fn(),post:vi.fn()}}));
vi.mock('@/components/providers/auth-provider',()=>({useAuth:vi.fn()}));
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actor=id(1);const jobId=id(2);const now='2026-09-19T12:00:00Z';
const saved=SavedRepositorySelectionSchema.parse({revision:id(3),repositories:[{repositoryId:id(4),accountId:id(5),installationId:id(6),fullName:'fixture/repository',visibility:'private',defaultBranch:'main',archived:false,ownerType:'User',grantId:id(7),accessRevision:id(8),status:'active',attestedAt:now}],policy:{maxRepositories:5,attestationVersion:'1.0.0',attestationText:REPOSITORY_ATTESTATION_TEXT,allowArchived:false,requireDefaultBranch:true,analysisAvailable:true}});
const queued=AnalysisJobResponseSchema.parse({contractVersion:'1.0.0',jobId,status:'queued',stage:'queued',createdAt:now,updatedAt:now,attempt:null,progress:{kind:'indeterminate',stage:'queued'}});
let client:QueryClient;
function view(node:React.ReactNode){return <QueryClientProvider client={client}>{node}</QueryClientProvider>;}
beforeEach(()=>{
  sessionStorage.clear();client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  vi.mocked(useAuth).mockReturnValue({user:{id:actor,email:'fixture@example.test'},isLoading:false,refresh:vi.fn()});
  vi.mocked(api.get).mockReset().mockImplementation(async path=>path.endsWith('availability')?{available:true}:path==='/v1/analyses'?[queued]:queued);
  vi.mocked(api.post).mockReset().mockResolvedValue(queued);
});
it('gates Start on server availability and saved selection validity',async()=>{
  vi.mocked(api.get).mockResolvedValue({available:false});render(view(<StartAnalysisButton actor={actor} saved={saved} disabled={false}/>));
  expect(await screen.findByRole('button',{name:'Start Analysis'})).toBeDisabled();expect(api.post).not.toHaveBeenCalled();
});
it('retains one key through a timeout, rapid repeated clicks and remount',async()=>{
  const user=userEvent.setup();vi.mocked(api.post).mockRejectedValueOnce(new Error('timeout'));
  const first=render(view(<StartAnalysisButton actor={actor} saved={saved} disabled={false}/>));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Start Analysis'})).toBeEnabled());
  await user.click(screen.getByRole('button',{name:'Start Analysis'}));await screen.findByRole('alert');const body=vi.mocked(api.post).mock.calls[0][1]?.body;
  first.unmount();render(view(<StartAnalysisButton actor={actor} saved={saved} disabled={false}/>));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Start Analysis'})).toBeEnabled());
  await user.dblClick(screen.getByRole('button',{name:'Start Analysis'}));
  expect(vi.mocked(api.post).mock.calls[1][1]?.body).toEqual(body);
  expect(useRouter().push).toHaveBeenCalledWith(`/readiness/jobs/${jobId}`);
});
it('resumes a job from its URL, shows real stage and cancels through the owner route',async()=>{
  const running={...queued,status:'running',stage:'extracting',analysisRunId:null,attempt:{attemptId:id(9),number:2,startedAt:now},progress:{kind:'indeterminate',stage:'extracting'}};
  vi.mocked(api.get).mockResolvedValue(running);render(view(<AnalysisProgress jobId={jobId}/>));
  expect(await screen.findByText('Extracting evidence')).toBeInTheDocument();expect(screen.getByText('Attempt 2 of 3')).toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  vi.mocked(api.get).mockResolvedValue({...queued,status:'canceled',finishedAt:now});
  await userEvent.click(screen.getByRole('button',{name:'Cancel analysis'}));
  expect(await screen.findByText('Analysis canceled')).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith(`/v1/analyses/${jobId}/cancel`,expect.anything());
});
it('shows actionable revocation and bounded retry states without fabricating a result',async()=>{
  vi.mocked(api.get).mockResolvedValue({...queued,status:'failed',finishedAt:now,failureCode:'REPOSITORY_ACCESS_REVOKED',retryable:false});
  render(view(<AnalysisProgress jobId={jobId}/>));expect(await screen.findByText(/Reconnect GitHub/)).toBeInTheDocument();expect(screen.queryByText('View saved report')).not.toBeInTheDocument();
});
it('renders owner history and an interrupted queue retry action',async()=>{
  vi.mocked(api.get).mockResolvedValue([{...queued,attempt:{attemptId:id(9),number:1,startedAt:now}}]);render(view(<AnalysisProgress/>));
  expect(await screen.findByText('Waiting to retry after an interruption.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button',{name:'Retry now'}));expect(api.post).toHaveBeenCalledWith(`/v1/analyses/${jobId}/retry`,expect.anything());
});
it('clears private results on user switch and ignores late start responses',async()=>{
  let finish!:(value:AnalysisJobResponse)=>void;vi.mocked(api.post).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const first=render(view(<StartAnalysisButton actor={actor} saved={saved} disabled={false}/>));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Start Analysis'})).toBeEnabled());await userEvent.click(screen.getByRole('button',{name:'Start Analysis'}));first.unmount();
  vi.mocked(useAuth).mockReturnValue({user:null,isLoading:false,refresh:vi.fn()});render(view(<AnalysisProgress jobId={jobId}/>));
  await act(async()=>finish(queued));expect(screen.getByText('Sign in to view your analyses.')).toBeInTheDocument();
});
it('keeps a saved completion available without polling providers',async()=>{
  vi.mocked(api.get).mockResolvedValue({...queued,status:'completed',attempt:{attemptId:id(9),number:1,startedAt:now},finishedAt:now,report:{reportId:id(10),analysisRunId:id(11)}});
  render(view(<AnalysisProgress jobId={jobId}/>));expect(await screen.findByRole('link',{name:'View saved report'})).toHaveAttribute('href',`/readiness/reports/${id(10)}`);
});
