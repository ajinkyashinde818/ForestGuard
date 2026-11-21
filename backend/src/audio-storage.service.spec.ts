import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { AudioStorageService } from './audio-storage.service';

function createTinyWav(): Buffer {
  const wav = Buffer.alloc(48);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(40, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8_000, 24);
  wav.writeUInt32LE(16_000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(4, 40);
  return wav;
}

describe('AudioStorageService', () => {
  let directory: string;
  let service: AudioStorageService;
  let originalStorageDir: string | undefined;

  beforeEach(async () => {
    originalStorageDir = process.env.AUDIO_STORAGE_DIR;
    directory = await mkdtemp(join(tmpdir(), 'forestguard-audio-'));
    process.env.AUDIO_STORAGE_DIR = directory;
    service = new AudioStorageService();
  });

  afterEach(async () => {
    if (originalStorageDir === undefined) delete process.env.AUDIO_STORAGE_DIR;
    else process.env.AUDIO_STORAGE_DIR = originalStorageDir;
    await rm(directory, { recursive: true, force: true });
  });

  it('stores audio privately with a generated key and checksum', async () => {
    const wav = createTinyWav();
    const stored = await service.store(wav, 'audio/wav');

    expect(stored.storageKey).toMatch(/^[0-9a-f-]{36}\.wav$/);
    expect(stored.byteSize).toBe(wav.length);
    expect(stored.checksum).toMatch(/^[0-9a-f]{64}$/);
    await expect(service.read(stored.storageKey)).resolves.toEqual(wav);
  });

  it('rejects a MIME type that is not allowed', async () => {
    await expect(service.store(createTinyWav(), 'application/octet-stream'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects bytes that do not match the declared audio type', async () => {
    await expect(service.store(Buffer.alloc(32, 0), 'audio/wav'))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
