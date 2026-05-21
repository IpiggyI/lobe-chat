import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

import pMap from 'p-map';

import s3 from '../cdnWorkflow/s3';

interface UploadConfig {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  keyPrefix: string;
  publicDomain: string;
  region: string;
  secretAccessKey: string;
}

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

// HTML 走 Next.js 模板（template.ts 已抓为 TS 常量），Service Worker 必须从主站 origin 注册——这些不上 CDN。
const SKIP_RELATIVE_PATTERNS: RegExp[] = [/\.html$/, /^sw\.js$/, /^workbox-[^/]+\.js$/];

export async function uploadAssets(distDir: string, config: UploadConfig) {
  const allFiles = collectFiles(distDir);
  const files = allFiles.filter((filePath) => {
    const relativePath = filePath.slice(distDir.length + 1);
    return !SKIP_RELATIVE_PATTERNS.some((pattern) => pattern.test(relativePath));
  });
  console.log(
    `Found ${files.length} files to upload (skipped ${allFiles.length - files.length} non-CDN files)`,
  );

  const client = s3.createS3Client({
    accessKeyId: config.accessKeyId,
    bucketName: config.bucket,
    endpoint: config.endpoint,
    pathPrefix: '',
    region: config.region,
    secretAccessKey: config.secretAccessKey,
  });

  const results = await pMap(
    files,
    async (filePath) => {
      const relativePath = filePath.slice(distDir.length + 1);
      const key = `${config.keyPrefix}/${relativePath}`;
      const buffer = readFileSync(filePath);
      const fileName = basename(filePath);
      const ext = extname(filePath);

      console.log(`Uploading ${key}...`);

      const result = await s3.createUploadTask({
        acl: 'public-read',
        bucketName: config.bucket,
        client,
        item: { buffer, extname: ext, fileName },
        path: key,
        urlPrefix: config.publicDomain,
      });

      console.log(`Uploaded ${key} -> ${result.url}`);
      return result;
    },
    { concurrency: 10 },
  );

  console.log(`Successfully uploaded ${results.length} files`);
  return results;
}
