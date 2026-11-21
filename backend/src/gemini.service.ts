import { GoogleGenAI } from '@google/genai';
import { AIProcessingStatus, EventType, Prisma, Severity } from '@prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { LiveGateway } from './gateway';
import { isLoggingRelatedType } from './event-classification';

const EVENT_TYPES = Object.values(EventType);
const SEVERITIES = Object.values(Severity);

interface GeminiClassification {
  soundType: EventType;
  confidence?: number;
  description: string;
  severity: Severity;
  alternativeSounds: EventType[];
  reasoningSummary?: string;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly client?: GoogleGenAI;
  private readonly model?: string;
  private readonly provider: string;

  constructor(
    private readonly config: ConfigService,
    private readonly db: PrismaService,
    private readonly live: LiveGateway,
  ) {
    this.provider = this.config.get<string>('AI_PROVIDER', 'disabled');
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    this.model = this.config.get<string>('GEMINI_MODEL');
    if (this.provider === 'gemini' && apiKey && this.model) {
      this.client = new GoogleGenAI({
        apiKey,
        httpOptions: { timeout: 60_000 },
      });
    }
  }

  get enabled(): boolean {
    return this.provider === 'mock' ||
      (this.provider === 'gemini' && Boolean(this.client && this.model));
  }

  async enqueue(eventId: string, audio: Buffer, mimeType: string): Promise<void> {
    if (!this.enabled) return;
    const model = this.provider === 'mock' ? 'deterministic-mock' : this.model;
    if (!model) return;

    const analysis = await this.db.aIAnalysis.create({
      data: {
        eventId,
        provider: this.provider === 'mock' ? 'DEMO_MOCK' : 'gemini',
        model,
        status: AIProcessingStatus.PROCESSING,
        alternatives: [],
      },
    });

    void this.process(analysis.id, eventId, audio, mimeType, model);
  }

  private async process(
    analysisId: string,
    eventId: string,
    audio: Buffer,
    mimeType: string,
    model: string,
  ): Promise<void> {
    try {
      const response = this.provider === 'mock' ? undefined : await this.client!.models.generateContent({
        model,
        contents: [{
          role: 'user',
          parts: [
            {
              text: [
                'You assist forest monitoring staff by classifying possible acoustic evidence.',
                'Do not state or imply that illegal logging is proven.',
                'Use UNKNOWN when the sound cannot be identified reliably.',
                'This is decision support only; a human must review the original evidence.',
                'Return only the requested JSON fields. Do not invent a confidence score.',
              ].join(' '),
            },
            { inlineData: { mimeType, data: audio.toString('base64') } },
          ],
        }],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: {
            type: 'OBJECT',
            properties: {
              soundType: { type: 'STRING', enum: EVENT_TYPES },
              confidence: { type: 'NUMBER', minimum: 0, maximum: 1 },
              description: { type: 'STRING' },
              severity: { type: 'STRING', enum: SEVERITIES },
              alternativeSounds: {
                type: 'ARRAY',
                items: { type: 'STRING', enum: EVENT_TYPES },
              },
              reasoningSummary: { type: 'STRING' },
            },
            required: ['soundType', 'description', 'severity', 'alternativeSounds'],
          },
        },
      });

      const result: GeminiClassification = this.provider === 'mock'
        ? {
            soundType: EventType.UNKNOWN,
            description: 'DEMO ONLY: mock provider made no acoustic classification.',
            severity: Severity.LOW,
            alternativeSounds: [],
          }
        : this.parseClassification(response?.text);
      const saved = await this.db.$transaction(async (tx) => {
        const updatedAnalysis = await tx.aIAnalysis.update({
          where: { id: analysisId },
          data: {
            status: AIProcessingStatus.COMPLETED,
            type: result.soundType,
            confidence: result.confidence,
            description: result.description,
            reasoningSummary: result.reasoningSummary,
            alternatives: result.alternativeSounds,
            severity: result.severity,
            requiresHumanReview: true,
            responseMetadata: {
              providerMode: this.provider === 'mock' ? 'DEMO ONLY' : 'configured Gemini API',
              modelVersion: response?.modelVersion ?? model,
              candidateCount: response?.candidates?.length ?? 0,
            } satisfies Prisma.InputJsonObject,
          },
        });

        const alert = this.provider !== 'mock' && isLoggingRelatedType(result.soundType)
          ? await tx.alert.create({
              data: {
                eventId,
                priority: result.severity,
                message: `Possible ${result.soundType.toLowerCase().replace('_', ' ')} activity detected. Human verification required.`,
              },
            })
          : null;
        return { updatedAnalysis, alert };
      });

      this.live.publish('ai.completed', saved.updatedAnalysis);
      this.live.publish('event.updated', { eventId, analysis: saved.updatedAnalysis });
      if (saved.alert) this.live.publish('alert.created', saved.alert);
    } catch (error) {
      await this.db.aIAnalysis.update({
        where: { id: analysisId },
        data: {
          status: AIProcessingStatus.FAILED,
          responseMetadata: { error: 'AI provider or response validation failed' },
        },
      }).catch(() => undefined);
      this.logger.warn(`Gemini analysis failed for event ${eventId}`);
      this.live.publish('ai.failed', { eventId });
    }
  }

  private parseClassification(raw: string | undefined): GeminiClassification {
    if (!raw) throw new Error('Gemini returned no response text');
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) throw new Error('Invalid classification object');
    const record = value as Record<string, unknown>;
    if (!EVENT_TYPES.includes(record.soundType as EventType)) throw new Error('Unsupported sound type');
    if (typeof record.description !== 'string' || record.description.length > 1200) throw new Error('Invalid description');
    if (!SEVERITIES.includes(record.severity as Severity)) throw new Error('Unsupported severity');
    if (!Array.isArray(record.alternativeSounds) || !record.alternativeSounds.every((type) => EVENT_TYPES.includes(type as EventType))) {
      throw new Error('Invalid alternative sound list');
    }
    const confidence = record.confidence;
    if (confidence !== undefined && (typeof confidence !== 'number' || confidence < 0 || confidence > 1)) {
      throw new Error('Invalid model-reported confidence');
    }
    return {
      soundType: record.soundType as EventType,
      confidence: confidence as number | undefined,
      description: record.description,
      severity: record.severity as Severity,
      alternativeSounds: record.alternativeSounds as EventType[],
      reasoningSummary: typeof record.reasoningSummary === 'string' ? record.reasoningSummary : undefined,
    };
  }
}
