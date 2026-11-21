import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { memoryStorage } from 'multer';
import { AudioStorageService, AUDIO_MIME_TYPES } from './audio-storage.service';
import { CurrentDevice, CurrentUser, DeviceGuard, JwtGuard, MONITORING_READ_ROLES, RoleGuard, Roles } from './auth';
import { GeminiService } from './gemini.service';
import { PrismaService } from './prisma.service';

class AudioUploadMetadataDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(300)
  durationSeconds?: number;

  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}

const maxAudioBytes = Number(process.env.MAX_AUDIO_BYTES) || 10 * 1024 * 1024;

@ApiTags('audio')
@Controller('events')
export class AudioController {
  constructor(
    private readonly db: PrismaService,
    private readonly storage: AudioStorageService,
    private readonly gemini: GeminiService,
  ) {}

  @Post(':eventId/audio')
  @UseGuards(DeviceGuard)
  @ApiConsumes('multipart/form-data')
  @ApiHeader({ name: 'x-device-id', required: true })
  @ApiHeader({ name: 'x-device-token', required: true })
  @UseInterceptors(FileInterceptor('audio', {
    storage: memoryStorage(),
    limits: { fileSize: maxAudioBytes, files: 1 },
    fileFilter: (_request, file, callback) => {
      if (!AUDIO_MIME_TYPES.has(file.mimetype)) {
        callback(new BadRequestException('Unsupported audio MIME type'), false);
        return;
      }
      callback(null, true);
    },
  }))
  async upload(
    @Param('eventId') eventId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() metadata: AudioUploadMetadataDto,
    @CurrentDevice() device: { id: string },
  ) {
    if (!file) throw new BadRequestException('An audio file is required');

    const event = await this.db.event.findUnique({
      where: { id: eventId },
      select: { id: true, deviceId: true, audio: { select: { id: true } } },
    });
    if (!event || event.deviceId !== device.id) throw new NotFoundException('Event not found');
    if (event.audio) throw new ConflictException('Audio evidence already exists for this event');

    const stored = await this.storage.store(file.buffer, file.mimetype);
    let evidence;
    try {
      evidence = await this.db.audioEvidence.create({
        data: {
          eventId,
          durationSeconds: metadata.durationSeconds,
          recordedAt: metadata.recordedAt ? new Date(metadata.recordedAt) : undefined,
          ...stored,
        },
      });
    } catch (error) {
      await this.storage.remove(stored.storageKey);
      throw error;
    }

    if (this.gemini.enabled) {
      void this.gemini.enqueue(eventId, file.buffer, file.mimetype).catch(() => undefined);
    }

    return {
      id: evidence.id,
      eventId: evidence.eventId,
      mimeType: evidence.mimeType,
      byteSize: evidence.byteSize,
      checksum: evidence.checksum,
      durationSeconds: evidence.durationSeconds,
      recordedAt: evidence.recordedAt,
      storageStatus: evidence.storageStatus,
      aiProcessing: this.gemini.enabled ? 'PROCESSING' : 'DISABLED',
    };
  }

  @Get(':eventId/audio')
  @UseGuards(JwtGuard, RoleGuard)
  @Roles(...MONITORING_READ_ROLES)
  @ApiBearerAuth()
  async playback(
    @Param('eventId') eventId: string,
    @CurrentUser() _user: { sub: string; role: string },
  ) {
    const evidence = await this.db.audioEvidence.findUnique({ where: { eventId } });
    if (!evidence) throw new NotFoundException('Audio evidence not found');
    const buffer = await this.storage.read(evidence.storageKey);
    return new StreamableFile(buffer, {
      type: evidence.mimeType,
      disposition: 'inline',
      length: evidence.byteSize,
    });
  }
}
