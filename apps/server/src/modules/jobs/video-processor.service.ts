import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { mkdir, open, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  IMAGE_MAX_PIXELS,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_DURATION_MS,
} from '../../common/media-formats';
import type { VideoFormat } from '../../common/media-formats';
import {
  HLS_MAX_PLAYLIST_BYTES,
  HLS_MAX_SEGMENTS,
  HLS_PLAYLIST_NAME,
  HLS_SEGMENT_SECONDS,
  hlsSegmentName,
} from '../../common/video-stream';
import {
  MediaProcessingError,
  VIDEO_PROCESSING_COMMAND,
} from './media-processing.constants';
import type { VideoProcessingCommand } from './media-processing.constants';

interface ProbeStream {
  index?: number;
  codec_name?: string;
  codec_type?: string;
  width?: number;
  height?: number;
  duration?: string;
  disposition?: { attached_pic?: number };
  tags?: { rotate?: string };
  side_data_list?: { rotation?: number }[];
}

interface ProbeResult {
  streams?: ProbeStream[];
  format?: { format_name?: string; duration?: string };
}

export interface InspectedVideo {
  mediaType: 'VIDEO';
  mimeType: string;
  format: VideoFormat;
  streamIndex: number;
  width: number;
  height: number;
  durationMs: number;
}

export interface PreparedHls {
  directory: string;
  playlistPath: string;
  segmentCount: number;
}

@Injectable()
export class VideoProcessorService {
  constructor(private readonly config: ConfigService) {}

  async inspect(path: string, format: VideoFormat): Promise<InspectedVideo> {
    const handle = await open(path, 'r');
    try {
      const header = Buffer.alloc(64);
      const { bytesRead } = await handle.read(header, 0, header.length, 0);
      const signature = header.toString('ascii', 4, 8);
      const isMatroska =
        bytesRead >= 4 && header.readUInt32BE(0) === 0x1a45dfa3;
      const isMovie =
        bytesRead >= 8 &&
        ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip'].includes(signature);
      const isStillImage =
        signature === 'ftyp' &&
        ['avif', 'avis', 'heic', 'heix', 'mif1', 'msf1'].includes(
          header.toString('ascii', 8, 12),
        );
      if (format === 'mkv' ? !isMatroska : !isMovie || isStillImage)
        throw new MediaProcessingError('视频扩展名与文件容器不一致', true);
    } finally {
      await handle.close();
    }

    const output = await this.run(VIDEO_PROCESSING_COMMAND.FFPROBE, [
      '-v',
      'error',
      '-max_alloc',
      '268435456',
      ...this.inputOptions(format),
      '-select_streams',
      'v',
      '-show_entries',
      'format=format_name,duration:stream=index,codec_name,codec_type,width,height,duration:stream_disposition=attached_pic:stream_tags=rotate:stream_side_data=rotation',
      '-of',
      'json',
      path,
    ]);
    let result: ProbeResult;
    try {
      result = JSON.parse(output) as ProbeResult;
    } catch {
      throw new MediaProcessingError('无法读取有效的视频元数据', true);
    }
    const stream = result.streams?.find(
      (item) =>
        item.codec_type === 'video' && item.disposition?.attached_pic !== 1,
    );
    const width = stream?.width;
    const height = stream?.height;
    const streamDuration = Number(stream?.duration);
    const durationMs = Math.round(
      (Number.isFinite(streamDuration) && streamDuration > 0
        ? streamDuration
        : Number(result.format?.duration)) * 1000,
    );
    if (
      !stream ||
      !stream.codec_name ||
      stream.codec_name === 'unknown' ||
      !Number.isInteger(stream.index) ||
      stream.index < 0 ||
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      width * height > IMAGE_MAX_PIXELS ||
      !Number.isSafeInteger(durationMs) ||
      durationMs < 1 ||
      durationMs > VIDEO_MAX_DURATION_MS
    )
      throw new MediaProcessingError(
        '视频须含有效画面，单帧不超过 2000 万像素，时长不超过 4 小时',
        true,
      );

    const rotation = Number(
      stream.side_data_list?.find((item) => item.rotation !== undefined)
        ?.rotation ??
        stream.tags?.rotate ??
        0,
    );
    const rotated =
      Number.isFinite(rotation) && Math.abs(Math.round(rotation)) % 180 === 90;
    return {
      mediaType: 'VIDEO',
      mimeType: {
        mp4: 'video/mp4',
        mov: 'video/quicktime',
        mkv: 'video/x-matroska',
      }[format],
      format,
      streamIndex: stream.index,
      width: rotated ? height : width,
      height: rotated ? width : height,
      durationMs,
    };
  }

  async prepare(
    path: string,
    directory: string,
    video: InspectedVideo,
    needs: { thumbnail: boolean; preview: boolean; hls?: boolean },
  ) {
    const input = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-y',
      '-max_alloc',
      '268435456',
      '-threads',
      '2',
      '-filter_threads',
      '1',
      ...this.inputOptions(video.format),
      '-i',
      path,
    ];
    let thumbnail: Buffer | null = null;
    let previewPath: string | null = null;
    let hls: PreparedHls | null = null;

    if (needs.thumbnail) {
      const thumbnailPath = join(directory, 'thumbnail.webp');
      await this.run(VIDEO_PROCESSING_COMMAND.FFMPEG, [
        ...input,
        '-map',
        `0:${video.streamIndex}`,
        '-frames:v',
        '1',
        '-an',
        '-sn',
        '-dn',
        '-vf',
        "scale=w='min(256,iw)':h='min(256,ih)':force_original_aspect_ratio=decrease,setsar=1",
        '-c:v',
        'libwebp',
        '-quality',
        '80',
        '-threads',
        '2',
        '-map_metadata',
        '-1',
        thumbnailPath,
      ]);
      const metadata = await stat(thumbnailPath);
      if (metadata.size < 1 || metadata.size > 1024 * 1024)
        throw new MediaProcessingError('视频封面生成结果无效', true);
      thumbnail = await readFile(thumbnailPath);
    }

    if (needs.preview || needs.hls) {
      previewPath = join(directory, 'preview.mp4');
      await this.run(VIDEO_PROCESSING_COMMAND.FFMPEG, [
        ...input,
        '-map',
        `0:${video.streamIndex}`,
        '-map',
        '0:a:0?',
        '-sn',
        '-dn',
        '-vf',
        "scale=w='max(2,min(1920,iw))':h='max(2,min(1080,ih))':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1",
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-threads',
        '2',
        '-fpsmax',
        '60',
        '-force_key_frames',
        `expr:gte(t,n_forced*${HLS_SEGMENT_SECONDS})`,
        '-sc_threshold',
        '0',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-ac',
        '2',
        '-map_metadata',
        '-1',
        '-map_chapters',
        '-1',
        '-movflags',
        '+faststart',
        '-fs',
        String(VIDEO_MAX_BYTES + 65536),
        previewPath,
      ]);
      const metadata = await stat(previewPath);
      if (metadata.size < 1 || metadata.size > VIDEO_MAX_BYTES)
        throw new MediaProcessingError('兼容视频预览超过 512 MiB 限制', true);
      const preview = await this.inspect(previewPath, 'mp4');
      if (Math.abs(preview.durationMs - video.durationMs) > 2000)
        throw new MediaProcessingError(
          '兼容视频预览不完整，原视频仍可下载',
          true,
        );
    }

    if (needs.hls && previewPath) {
      const hlsDirectory = join(directory, 'hls');
      await mkdir(hlsDirectory, { recursive: true });
      const playlistPath = join(hlsDirectory, HLS_PLAYLIST_NAME);
      await this.run(VIDEO_PROCESSING_COMMAND.FFMPEG, [
        '-hide_banner',
        '-loglevel',
        'error',
        '-nostdin',
        '-y',
        '-max_alloc',
        '268435456',
        ...this.inputOptions('mp4'),
        '-i',
        previewPath,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-c',
        'copy',
        '-sn',
        '-dn',
        '-f',
        'hls',
        '-hls_time',
        String(HLS_SEGMENT_SECONDS),
        '-hls_playlist_type',
        'vod',
        '-hls_flags',
        'independent_segments',
        '-hls_segment_filename',
        join(hlsDirectory, 'segment-%06d.ts'),
        playlistPath,
      ]);
      const metadata = await stat(playlistPath);
      if (metadata.size < 1 || metadata.size > HLS_MAX_PLAYLIST_BYTES)
        throw new MediaProcessingError('HLS 播放列表大小无效', true);
      const playlist = await readFile(playlistPath, 'utf8');
      const segments = playlist
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith('#'));
      if (
        !playlist.startsWith('#EXTM3U') ||
        !playlist.includes('#EXT-X-ENDLIST') ||
        segments.length < 1 ||
        segments.length > HLS_MAX_SEGMENTS ||
        segments.some((name, index) => name !== hlsSegmentName(index))
      )
        throw new MediaProcessingError('HLS 播放列表不完整', true);
      hls = {
        directory: hlsDirectory,
        playlistPath,
        segmentCount: segments.length,
      };
    }
    return { thumbnail, previewPath, hls };
  }

  private inputOptions(format: VideoFormat) {
    return [
      '-protocol_whitelist',
      'file',
      '-probesize',
      '10485760',
      '-analyzeduration',
      '10000000',
      '-f',
      format === 'mkv' ? 'matroska' : 'mov',
      ...(format === 'mkv'
        ? []
        : ['-enable_drefs', '0', '-use_absolute_path', '0']),
    ];
  }

  private run(tool: VideoProcessingCommand, args: string[]): Promise<string> {
    const isProbe = tool === VIDEO_PROCESSING_COMMAND.FFPROBE;
    const executable = this.config.get<string>(
      isProbe ? 'FFPROBE_PATH' : 'FFMPEG_PATH',
      tool,
    );
    const commandArgs = args;

    const timeout = isProbe
      ? this.config.get<number>('MEDIA_VIDEO_PROBE_TIMEOUT_MS', 3000000)
      : this.config.get<number>('MEDIA_VIDEO_PROCESSING_TIMEOUT_MS', 60000000);
    return new Promise((resolve, reject) => {
      execFile(
        executable,
        commandArgs,
        {
          encoding: 'utf8',
          timeout,
          killSignal: 'SIGKILL',
          maxBuffer: 1024 * 1024,
          windowsHide: true,
          shell: false,
        },
        (error, stdout) => {
          if (!error) {
            resolve(stdout);
            return;
          }
          const unavailable =
            error.code === 'ENOENT' || error.code === 'EACCES';
          reject(
            new MediaProcessingError(
              unavailable
                ? '服务器未配置可执行的 FFmpeg / ffprobe，请联系管理员'
                : error.killed
                  ? '视频处理超时，请稍后重试或缩短视频'
                  : isProbe
                    ? '视频损坏、容器无效或不含可解码的视频流'
                    : '视频封面或兼容预览生成失败，请检查服务器编码器及原视频',
              !unavailable && !error.killed && isProbe,
            ),
          );
        },
      );
    });
  }
}
