import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';

function run(command, args, { collectStdout = true } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', collectStdout ? 'pipe' : 'inherit', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    child.stdout?.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', (error) => reject(new Error(`Could not start ${command}: ${error.message}`)));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} exited ${code}: ${Buffer.concat(stderr).toString().trim()}`));
        return;
      }
      resolve(Buffer.concat(stdout));
    });
  });
}

/** Decode the first video stream into ordered RGBA frames with ffmpeg. */
export async function extractFrames(videoPath, { ffmpeg = 'ffmpeg', ffprobe = 'ffprobe' } = {}) {
  await access(videoPath, constants.R_OK);

  let probe;
  try {
    const output = await run(ffprobe, [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'json',
      videoPath,
    ]);
    probe = JSON.parse(output.toString());
  } catch (error) {
    throw new Error(
      `Video probing requires ffprobe (normally installed with ffmpeg). ${error.message}`,
    );
  }

  const { width, height } = probe.streams?.[0] ?? {};
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error(`No decodable video stream found in ${videoPath}`);
  }

  let raw;
  try {
    raw = await run(ffmpeg, [
      '-v',
      'error',
      '-i',
      videoPath,
      '-map',
      '0:v:0',
      '-fps_mode',
      'passthrough',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgba',
      'pipe:1',
    ]);
  } catch (error) {
    throw new Error(`Video decoding requires ffmpeg. ${error.message}`);
  }

  const bytesPerFrame = width * height * 4;
  if (raw.length % bytesPerFrame !== 0) {
    throw new Error(
      `Decoder returned ${raw.length} bytes, not a whole number of ${width}x${height} RGBA frames`,
    );
  }

  const frames = [];
  for (let offset = 0; offset < raw.length; offset += bytesPerFrame) {
    frames.push({
      width,
      height,
      data: new Uint8Array(raw.subarray(offset, offset + bytesPerFrame)),
    });
  }
  return frames;
}
