import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import {
  VIDEO_MAX_BYTES,
  VIDEO_MAX_DURATION_MS,
} from '../../common/media-formats';
import type { VideoFormat } from '../../common/media-formats';
import type { FileNode } from '../../prisma/generated/prisma/client';
import { VideoProcessorService } from '../jobs/video-processor.service';
import { STORAGE_PROVIDER, StorageError } from '../storage/storage.provider';
import type { StorageProvider } from '../storage/storage.provider';
import {
  VIDEO_ASR_MAX_RESPONSE_BYTES,
  VIDEO_AUDIO_CHUNK_SECONDS,
  VIDEO_TRANSCRIPT_MAX_CHARS,
  VIDEO_TRANSCRIPT_MAX_SEGMENTS,
  VideoSummaryError,
} from './video-summary.constants';
import type {
  TranscriptSegment,
  VideoTranscript,
} from './video-summary.constants';

const asrSchema = z.object({
  text: z.string().max(VIDEO_TRANSCRIPT_MAX_CHARS).optional(),
  language: z.string().max(100).nullish(),
  segments: z
    .array(
      z.object({
        start: z.number().finite().nonnegative(),
        end: z.number().finite().nonnegative(),
        text: z.string().max(VIDEO_TRANSCRIPT_MAX_CHARS),
      }),
    )
    .max(VIDEO_TRANSCRIPT_MAX_SEGMENTS)
    .optional(),
});

export function parseAsrResult(
  value: unknown,
  start: number,
  duration: number,
) {
  const parsed = asrSchema.safeParse(value);
  if (
    !parsed.success ||
    (parsed.data.text === undefined && !parsed.data.segments)
  )
    throw new VideoSummaryError('语音转写服务返回了无效的 JSON 结果');
  const clean = (text: string) => text.replace(/\u0000/g, '').trim();
  const segments: TranscriptSegment[] = [];
  for (const segment of parsed.data.segments ?? []) {
    if (
      segment.end < segment.start ||
      segment.start > duration + 1 ||
      segment.end > duration + 1
    )
      throw new VideoSummaryError('语音转写服务返回了无效的时间戳');
    const text = clean(segment.text);
    if (text)
      segments.push({
        start: start + Math.min(segment.start, duration),
        end: start + Math.min(segment.end, duration),
        text,
      });
  }
  const text = segments.length
    ? segments.map((segment) => segment.text).join('\n')
    : clean(parsed.data.text ?? '');
  if (!segments.length && text)
    segments.push({ start, end: start + duration, text });
  return { text, segments, language: parsed.data.language || null };
}

@Injectable()
export class VideoTranscriptionService {
  private readonly logger = new Logger(VideoTranscriptionService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly videos: VideoProcessorService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async transcribe(
    asset: FileNode,
    initial: VideoTranscript,
    checkpoint: (result: VideoTranscript) => Promise<void>,
    signal: AbortSignal,
  ): Promise<VideoTranscript> {
    const formats: Record<string, VideoFormat> = {
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/x-matroska': 'mkv',
    };
    const format = formats[asset.mimeType ?? ''];
    const duration = Number(asset.durationMs) / 1000;
    if (
      !format ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration * 1000 > VIDEO_MAX_DURATION_MS
    )
      throw new VideoSummaryError('视频格式或时长无效，无法进行语音转写', true);
    signal.throwIfAborted();
    const directory = await mkdtemp(join(tmpdir(), 'image-stack-transcript-'));
    try {
      const originalPath = await this.stageOriginal(asset, directory, signal);
      if (!(await this.videos.hasAudio(originalPath, format, signal)))
        return {
          transcript: '',
          segments: [],
          language: null,
          transcribedChunks: 0,
        };
      let result = initial;
      const chunkCount = Math.ceil(duration / VIDEO_AUDIO_CHUNK_SECONDS);
      for (
        let index = initial.transcribedChunks;
        index < chunkCount;
        index += 1
      ) {
        signal.throwIfAborted();
        const start = index * VIDEO_AUDIO_CHUNK_SECONDS;
        const length = Math.min(VIDEO_AUDIO_CHUNK_SECONDS, duration - start);
        const audioPath = join(directory, 'audio.wav');
        await this.videos.extractAudio(
          originalPath,
          audioPath,
          format,
          start,
          length,
          signal,
        );
        const chunk = await this.recognize(audioPath, start, length, signal);
        const transcript = [result.transcript, chunk.text]
          .filter(Boolean)
          .join('\n');
        const segments = [...result.segments, ...chunk.segments];
        if (
          transcript.length > VIDEO_TRANSCRIPT_MAX_CHARS ||
          segments.length > VIDEO_TRANSCRIPT_MAX_SEGMENTS
        )
          throw new VideoSummaryError('视频转写内容超过安全长度限制', true);
        const language = chunk.text ? chunk.language : null;
        result = {
          transcript,
          segments,
          language:
            result.language && language && result.language !== language
              ? 'mixed'
              : result.language || language,
          transcribedChunks: index + 1,
        };
        signal.throwIfAborted();
        await checkpoint(result);
        await rm(audioPath, { force: true });
      }
      return result;
    } finally {
      await rm(directory, { recursive: true, force: true }).catch(() =>
        this.logger.warn(`视频 ${asset.id} 的转写临时文件清理失败`),
      );
    }
  }

  private async stageOriginal(
    asset: FileNode,
    directory: string,
    signal: AbortSignal,
  ) {
    if (
      !asset.storageKey ||
      !asset.size ||
      asset.size <= 0n ||
      asset.size > BigInt(VIDEO_MAX_BYTES)
    )
      throw new VideoSummaryError('原视频大小或存储信息无效', true);
    const source = await this.storage
      .read(asset.storageKey)
      .catch((error: unknown) => {
        if (error instanceof StorageError && error.code === 'NOT_FOUND')
          throw new VideoSummaryError('原视频文件不存在，无法转写', true);
        throw error;
      });
    const timer = setTimeout(
      () => source.stream.destroy(new VideoSummaryError('原视频读取超时')),
      this.config.get<number>('MEDIA_PROCESSING_READ_TIMEOUT_MS', 30000),
    );
    timer.unref();
    const abort = () =>
      source.stream.destroy(new VideoSummaryError('原视频读取已停止'));
    signal.addEventListener('abort', abort, { once: true });
    try {
      signal.throwIfAborted();
      if (source.stat.size !== asset.size)
        throw new VideoSummaryError('原视频存储大小不一致', true);
      async function* content() {
        let received = 0n;
        for await (const chunk of source.stream) {
          if (!Buffer.isBuffer(chunk))
            throw new VideoSummaryError('原视频读取格式无效', true);
          received += BigInt(chunk.length);
          if (received > asset.size)
            throw new VideoSummaryError('原视频超过声明大小', true);
          yield chunk;
        }
        if (received !== asset.size)
          throw new VideoSummaryError('原视频读取不完整');
      }
      const path = join(directory, 'original');
      await pipeline(content(), createWriteStream(path, { flags: 'wx' }), {
        signal,
      });
      return path;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      source.stream.destroy();
    }
  }

  private async recognize(
    path: string,
    start: number,
    duration: number,
    signal: AbortSignal,
  ) {
    const metadata = await stat(path);
    if (
      metadata.size < 44 ||
      metadata.size > VIDEO_AUDIO_CHUNK_SECONDS * 32000 + 65536
    )
      throw new VideoSummaryError('提取的音频为空或超过分段大小限制', true);
    const bytes = await readFile(path);
    const body = new FormData();
    body.append(
      'audio_file',
      new Blob([new Uint8Array(bytes)], { type: 'audio/wav' }),
      'audio.wav',
    );
    const baseUrl = this.config
      .get<string>('ASR_BASE_URL', 'http://127.0.0.1:9000')
      .replace(/\/+$/, '');
    const url = new URL(`${baseUrl}/asr`);
    url.search = new URLSearchParams({
      task: 'transcribe',
      output: 'json',
      encode: 'true',
      vad_filter: 'true',
      word_timestamps: 'false',
    }).toString();
    const requestSignal = AbortSignal.any([
      signal,
      AbortSignal.timeout(
        this.config.get<number>('ASR_REQUEST_TIMEOUT_MS', 1800000),
      ),
    ]);
    try {
      const response = await fetch(url, {
        method: 'POST',
        body,
        signal: requestSignal,
        redirect: 'error',
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new VideoSummaryError(
          response.status === 404
            ? '语音转写接口不存在，请将 ASR_BASE_URL 配置为服务根地址'
            : `语音转写服务请求失败（HTTP ${response.status}）`,
          [400, 401, 403, 404, 413, 422].includes(response.status),
        );
      }
      if (!response.body) throw new VideoSummaryError('语音转写服务返回空响应');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > VIDEO_ASR_MAX_RESPONSE_BYTES)
            throw new VideoSummaryError('语音转写响应超过安全大小限制', true);
          chunks.push(chunk.value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
      return parseAsrResult(
        JSON.parse(Buffer.concat(chunks).toString('utf8')),
        start,
        duration,
      );
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      if (error instanceof VideoSummaryError) throw error;
      throw new VideoSummaryError(
        requestSignal.aborted
          ? '语音转写超时，将从已完成的音频分段继续重试'
          : '语音转写服务不可用或响应格式无效，请检查 ASR_BASE_URL 和模型加载状态',
      );
    }
  }
}
