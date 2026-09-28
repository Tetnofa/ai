import OpenAI from 'openai'
import { BaseTTSAdapter } from '@tanstack/ai/adapters'
import { toRunErrorPayload, speechMedia } from '@tanstack/ai/adapter-internals'
import { generateId } from '@tanstack/ai-utils'
import {
  getLovableApiKeyFromEnv,
  openaiRequestOptions,
  withLovableDefaults,
} from '../utils/client'
import type { TTSOptions, TTSResult, MediaUploader } from '@tanstack/ai'
import type OpenAI_SDK from 'openai'
import type { LovableTTSModel } from '../model-meta'
import type { LovableTTSProviderOptions } from '../audio/tts-provider-options'
import type { LovableClientConfig } from '../utils/client'

export interface LovableTTSConfig extends LovableClientConfig {
  mediaUploader?: MediaUploader
}

const CONTENT_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  opus: 'audio/opus',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wav: 'audio/wav',
  pcm: 'audio/pcm',
}

export class LovableTTSAdapter<
  TModel extends LovableTTSModel,
> extends BaseTTSAdapter<TModel, LovableTTSProviderOptions> {
  readonly name = 'lovable' as const

  private readonly mediaUploader: MediaUploader | undefined
  protected client: OpenAI

  constructor(config: LovableTTSConfig, model: TModel) {
    super(model, {})
    const { mediaUploader, ...clientConfig } = config
    this.mediaUploader = mediaUploader
    this.client = new OpenAI(withLovableDefaults(clientConfig))
  }

  async generateSpeech(
    options: TTSOptions<LovableTTSProviderOptions>,
  ): Promise<TTSResult> {
    const { model, text, voice, format, speed, modelOptions } = options

    const request: OpenAI_SDK.Audio.SpeechCreateParams = {
      model,
      input: text,
      voice: voice || 'alloy',
      response_format: format,
      ...(speed !== undefined && { speed }),
      ...(modelOptions ?? {}),
    }

    try {
      options.logger.request(
        `activity=tts provider=${this.name} model=${model} format=${request.response_format ?? 'default'} voice=${request.voice}`,
        { provider: this.name, model },
      )
      const response = await this.client.audio.speech.create(
        request,
        openaiRequestOptions(options.abortSignal),
      )
      const outputFormat = (request.response_format as string) || 'mp3'
      const contentType = CONTENT_TYPES[outputFormat] || 'audio/mpeg'

      return {
        id: generateId(this.name),
        model,
        ...(await speechMedia(
          response,
          contentType,
          this.mediaUploader,
          options.logger,
        )),
        format: outputFormat,
        contentType,
      }
    } catch (error: unknown) {
      options.logger.errors(`${this.name}.generateSpeech fatal`, {
        error: toRunErrorPayload(error, `${this.name}.generateSpeech failed`),
        source: `${this.name}.generateSpeech`,
      })
      throw error
    }
  }
}

export function createLovableSpeech<TModel extends LovableTTSModel>(
  model: TModel,
  apiKey: string,
  config?: Omit<LovableTTSConfig, 'apiKey'>,
): LovableTTSAdapter<TModel> {
  return new LovableTTSAdapter({ apiKey, ...config }, model)
}

export function lovableSpeech<TModel extends LovableTTSModel>(
  model: TModel,
  config?: Omit<LovableTTSConfig, 'apiKey'>,
): LovableTTSAdapter<TModel> {
  return createLovableSpeech(model, getLovableApiKeyFromEnv(), config)
}
