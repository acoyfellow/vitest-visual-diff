import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const artifacts = resolve(here, 'artifacts');

function ffmpeg(output, filter) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      'ffmpeg',
      [
        '-y',
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=c=0x1769aa:s=96x64:r=10:d=2',
        '-vf',
        filter,
        '-c:v',
        'libvpx-vp9',
        '-lossless',
        '1',
        '-g',
        '1',
        '-an',
        output,
      ],
      { stdio: ['ignore', 'inherit', 'pipe'] },
    );
    const stderr = [];
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', (error) =>
      reject(new Error(`ffmpeg is required to generate real samples: ${error.message}`)),
    );
    child.on('close', (code) =>
      code === 0
        ? resolvePromise()
        : reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(stderr).toString()}`)),
    );
  });
}

export async function generateSamples() {
  await mkdir(artifacts, { recursive: true });
  const baseline = resolve(artifacts, 'baseline.webm');
  const changed = resolve(artifacts, 'changed-at-frame-10.webm');
  const common = 'drawbox=x=10:y=16:w=24:h=24:color=white:t=fill';
  await ffmpeg(baseline, common);
  await ffmpeg(
    changed,
    `${common},drawbox=x=58:y=20:w=18:h=18:color=0xffcc00:t=fill:enable=gte(n\\,10)`,
  );
  return { baseline, changed, expectedFirstDivergence: 10 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await generateSamples(), null, 2));
}
