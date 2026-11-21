import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';

export const AUDIO_MIME_TYPES = new Set([
  'audio/aac',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/x-wav',
]);

const EXTENSION_BY_MIME: Record<string, string> = {
  'audio/aac': '.aac',
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/webm': '.webm',
  'audio/x-wav': '.wav',
};

export interface StoredAudio {
  storageKey: string;
  mimeType: string;
  byteSize: number;
  checksum: string;
}

@Injectable()
export class AudioStorageService {
  private readonly root = resolve(process.env.AUDIO_STORAGE_DIR ?? './uploads');

  async store(buffer: Buffer, mimeType: string): Promise<StoredAudio> {
    this.validateContent(buffer, mimeType);
    const storageKey = `${randomUUID()}${EXTENSION_BY_MIME[mimeType]}`;
    const location = this.pathFor(storageKey);
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await writeFile(location, buffer, { flag: 'wx', mode: 0o600 });

    return {
      storageKey,
      mimeType,
      byteSize: buffer.byteLength,
      checksum: createHash('sha256').update(buffer).digest('hex'),
    };
  }

  read(storageKey: string): Promise<Buffer> {
    return readFile(this.pathFor(storageKey));
  }

  async remove(storageKey: string): Promise<void> {
    await rm(this.pathFor(storageKey), { force: true });
  }

  private pathFor(storageKey: string): string {
    const safeName = basename(storageKey);
    const extension = extname(safeName);
    if (
      safeName !== storageKey ||
      !/^[0-9a-f-]{36}\.(aac|m4a|mp3|ogg|wav|webm)$/.test(safeName) ||
      !Object.values(EXTENSION_BY_MIME).includes(extension)
    ) {
      throw new BadRequestException('Invalid audio storage key');
    }
    return resolve(this.root, safeName);
  }

  private validateContent(buffer: Buffer, mimeType: string): void {
    if (!AUDIO_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException('Unsupported audio MIME type');
    }
    if (buffer.length < 12) {
      throw new BadRequestException('Audio file is too short or malformed');
    }

    const valid = (() => {
      switch (mimeType) {
        case 'audio/wav':
        case 'audio/x-wav':
          return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE';
        case 'audio/ogg':
          return buffer.toString('ascii', 0, 4) === 'OggS';
        case 'audio/webm':
          return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
        case 'audio/mp4':
          return buffer.toString('ascii', 4, 8) === 'ftyp';
        case 'audio/mpeg':
          return buffer.toString('ascii', 0, 3) === 'ID3' ||
            (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
        case 'audio/aac':
          return buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0;
        default:
          return false;
      }
    })();

    if (!valid) {
      throw new BadRequestException('Audio bytes do not match the declared MIME type');
    }
  }
}
