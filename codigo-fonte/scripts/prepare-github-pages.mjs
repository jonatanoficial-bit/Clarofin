import { cp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputDirectory = path.resolve('dist/client');
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/^\/+|\/+$/g, '');

await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, '.nojekyll'), '');

if (basePath) {
  const generatedAssets = path.join(outputDirectory, basePath, '_next');
  const publishedAssets = path.join(outputDirectory, '_next');

  try {
    if ((await stat(generatedAssets)).isDirectory()) {
      await rm(publishedAssets, { recursive: true, force: true });
      await cp(generatedAssets, publishedAssets, { recursive: true });
      await rm(path.join(outputDirectory, basePath), { recursive: true, force: true });
    }
  } catch {
    throw new Error(`Os arquivos gerados para /${basePath}/_next não foram encontrados.`);
  }
}

console.log(`GitHub Pages preparado${basePath ? ` para /${basePath}` : ' na raiz do domínio'}.`);
