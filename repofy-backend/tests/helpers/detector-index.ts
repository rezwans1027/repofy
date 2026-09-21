import { randomUUID } from 'node:crypto';
import { ProjectIndex } from '../../src/domain/detectors/project';
import { classify } from '../../src/domain/extraction/inventory';

export function indexed(files: Record<string,string>, configs: Record<string,string> = {}) {
  const project = new ProjectIndex(); for(const [path,text] of Object.entries(configs))project.addConfig(path,text);
  for(const [path,text] of Object.entries(files))project.add({path,text,fileId:randomUUID(),classification:classify(path).classification});
  project.finish(); return project;
}
