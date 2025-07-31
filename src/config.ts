import { readFile } from 'fs/promises';
import * as yaml from 'js-yaml';
import { join } from 'path';

export default async () => {
  const configPath = join(process.cwd(), 'config.yaml'),
    config = await readFile(configPath, 'utf8');
  return yaml.load(config);
};
