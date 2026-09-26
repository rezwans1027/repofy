import { describe, expect, it } from 'vitest';
import { ROLE_IMPLEMENTATION_KINDS } from '@repofy/contracts';
import { implementedRolePortfolio } from '../../helpers/role-coverage-v3';
import { indexed } from '../../helpers/detector-index';
import { detect } from '../../../src/domain/detectors/rules';

const examples = [
  ['labelled_control','Form.jsx','htmlFor="name"','htmlFor="missing"'],
  ['native_accessible_action','Mobile.jsx','accessibilityRole="button"','accessibilityRole="text"'],
  ['state_transition','reducer.ts','default:return state','default:return {}'],
  ['validated_boundary','boundary.ts','return save(parsed)','return save(input)'],
  ['mobile_subscription','lifecycle.ts','subscription.remove()','onState("active")'],
  ['mobile_navigation','navigation.ts','params:parsed','params:input'],
  ['mobile_cache','offline.ts',"getItem('record')","getItem('different')"],
  ['secret_configuration','environment.ts',"throw new Error('Missing credential')","useCredential(value)"],
  ['secure_storage','secure.ts','await setItemAsync','setItemAsync'],
  ['resource_guard','guard.ts',"throw new Error('Forbidden')","save(resource)"],
  ['model_context','model.ts','records.slice(0,5)','records'],
  ['model_action_guard','model-guard.ts','!allowed.includes(result.object.action)','!allowed.includes(prompt)'],
  ['evaluation_harness','evaluation.ts','actual===sample.expected','actual===actual'],
  ['safe_diagnostic','diagnostics.ts',"code:'FETCH_FAILED'","code:failure"],
  ['health_probe','health.ts','await fetchRecord()','fetchRecord()'],
  ['asserted_failure','guard-failure.test.ts',"test('rejects", "test.skip('rejects"],
  ['asserted_ui','Form.test.jsx',"{name:'Name'}",'{}'],
  ['asserted_value','schema.test.ts','records.id.isUnique','true'],
] as const;
function observations(path:string,source:string,other:Record<string,string>={}) {
  const project=indexed({...implementedRolePortfolio(),...other,[path]:source});
  return detect(project.files.get(path)!,true).map(f=>f.kind);
}
describe('expanded role detectors have independent positive and counterexample sources',()=>{
  it('covers every additional registered pattern',()=>{
    expect(examples.map(e=>e[0]).sort()).toEqual([...ROLE_IMPLEMENTATION_KINDS].sort());
  });
  for(const [kind,path,from,to] of examples) {
    const source=implementedRolePortfolio()[path];
    it(`${kind}: recognizes its resolved positive`,()=>expect(observations(path,source)).toContain(kind));
    it(`${kind}: rejects a broken control or assertion`,()=>{
      expect(source).toContain(from);
      expect(observations(path,source.replace(from,to))).not.toContain(kind);
    });
    it(`${kind}: cannot run under the frozen legacy analyzer`,()=>{
      const project=indexed(implementedRolePortfolio());
      expect(detect(project.files.get(path)!).map(f=>f.kind)).not.toContain(kind);
    });
  }
});
it.each(['hidden','aria-hidden="true"','aria-label="Other"','disabled','type="hidden"'])('does not qualify an obscured labelled input: %s',attribute=>{
  const source=implementedRolePortfolio()['Form.jsx'].replace('<input ',`<input ${attribute} `);
  expect(observations('Form.jsx',source)).not.toContain('labelled_control');
});
it.each(['accessible={false}','disabled','accessibilityElementsHidden={true}','importantForAccessibility="no-hide-descendants"'])('does not qualify a disabled native accessibility action: %s',attribute=>{
  const source=implementedRolePortfolio()['Mobile.jsx'].replace('<Pressable ',`<Pressable ${attribute} `);
  expect(observations('Mobile.jsx',source)).not.toContain('native_accessible_action');
});
it.each(['hidden','aria-hidden="true"','inert','{...props}'])('does not qualify controls hidden by their ancestor: %s',attribute=>{
  const source=implementedRolePortfolio()['Form.jsx'].replace('<label',`<div ${attribute}><label`).replace('</button>','</button></div>');
  expect(observations('Form.jsx',source)).not.toContain('labelled_control');
});
it('does not use a synchronous throw assertion on an async callback as failure corroboration',()=>{
  const source=implementedRolePortfolio()['guard-failure.test.ts'].replace('expect(()=>guard','expect(async()=>guard');
  expect(observations('guard-failure.test.ts',source)).not.toContain('asserted_failure');
});
it('does not call an ordinary data-processing loop an AI evaluation',()=>{
  const source=implementedRolePortfolio()['evaluation.ts'];
  expect(observations('evaluation.ts',source,{'model.ts':'export async function model(input){return input;}'})).not.toContain('evaluation_harness');
});
it('does not infer secret handling from unrelated environment configuration',()=>{
  const source=implementedRolePortfolio()['environment.ts'].replace('SERVICE_TOKEN','PORT');
  expect(observations('environment.ts',source)).not.toContain('secret_configuration');
});
it.each(['if(false){','return;','throw new Error();'])('does not count an unreachable secure-storage call: %s',prefix=>{
  const source=`import {setItemAsync} from 'expo-secure-store';export async function store(value){${prefix}await setItemAsync('session',value);${prefix==='if(false){'?'}':''}}`;
  expect(observations('secure.ts',source)).not.toContain('secure_storage');
});
it('resolves renamed imported APIs and refuses local shadows',()=>{
  const source=implementedRolePortfolio()['secure.ts'].replace('import {setItemAsync}','import {setItemAsync as put}').replace('await setItemAsync','await put');
  expect(observations('secure.ts',source)).toContain('secure_storage');
  expect(observations('secure.ts',source.replace('store(value)','store(value,put)'))).not.toContain('secure_storage');
});
it('requires an awaited rejection assertion and keeps mocked assertions explicitly weak',()=>{
  const body=`import {test,expect} from 'vitest';import {store} from './secure';test('rejects invalid input',async()=>{await expect(store(null)).rejects.toThrow('Invalid input');});`;
  expect(observations('failure.test.ts',body)).toContain('asserted_failure');
  expect(observations('failure.test.ts',body.replace('await expect','expect'))).not.toContain('asserted_failure');
  const project=indexed({...implementedRolePortfolio(),'failure.test.ts':body.replace('{test,expect}','{test,expect,vi}')+"vi.mock('./secure');"});
  expect(detect(project.files.get('failure.test.ts')!,true).find(f=>f.kind==='asserted_failure')!.mocked).toBe(true);
});
