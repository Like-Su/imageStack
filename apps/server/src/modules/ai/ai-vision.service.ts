import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { inspectImageContent } from '../../common/image-inspection';
import { sharp } from '../../common/sharp';
import {
  AI_IMAGE_MAX_BYTES,
  AI_IMAGE_MAX_EDGE,
  AiRecognitionError,
} from './ai.constants';
import { join } from 'node:path';

const recognitionSchema = z.object({
  description: z.string().trim().min(1).max(1500),
  keywords: z.array(z.string().trim().min(1).max(64)).max(40),
  ocrText: z.string().max(8000),
});

// TODO: 临时编写绝对路径, 后续替换
const recognitionPrompt = readFileSync(
  join('./src/common/prompts/image-engine.md'),
  'utf-8',
);

@Injectable()
export class AiVisionService {
  private client?: ChatOpenAI;

  constructor(private readonly config: ConfigService) {}

  get model() {
    return (
      this.config.get<string>('OPENAI_API_VISION_MODULE', '').trim() ||
      this.config.get<string>('OPENAI_API_MODULE', '').trim()
    );
  }

  get configurationError(): string | null {
    if (!this.model || !this.config.get<string>('OPENAI_API_KEY', '').trim())
      return '请配置 OPENAI_API_VISION_MODULE（视觉理解模型名）和 OPENAI_API_KEY；兼容旧 OPENAI_API_MODULE 配置';
    if (
      /(?:^|\/)(?:Z-Image|Qwen-Image|FLUX|Kolors|stable-diffusion)(?:$|[./-])/i.test(
        this.model,
      )
    )
      return `模型 ${this.model} 用于 /images/generations 生成图片，不能用于 /chat/completions 识图；请将其放入 OPENAI_API_IMAGE_MODULE，并为 OPENAI_API_VISION_MODULE 配置视觉理解模型`;
    if (/(?:^|[-/])(?:embedding|rerank(?:er)?)(?:$|[-/])/i.test(this.model))
      return `模型 ${this.model} 用于生成向量或重排评分，不能生成画面描述和 OCR；向量模型应放入 OPENAI_EMBEDDING，OPENAI_API_VISION_MODULE 需要视觉理解模型`;
    const baseUrl = this.config.get<string>('OPENAI_BASE_URL', '').trim();
    if (!baseUrl && !/^(gpt-|chatgpt-|o[1-9](?:-|$)|ft:gpt-)/i.test(this.model))
      return '当前为自定义模型，请配置服务商提供的 OPENAI_BASE_URL；不会将第三方密钥发送到默认 OpenAI 地址';
    if (
      baseUrl &&
      /\/(?:chat\/completions|responses|images\/generations|embeddings)\/?$/i.test(
        baseUrl,
      )
    )
      return 'OPENAI_BASE_URL 应填写 API 根地址（如 https://api.siliconflow.cn/v1），而不是完整的聊天、生图或向量接口';
    return null;
  }

  get enabled() {
    return this.configurationError === null;
  }

  assertConfigured() {
    if (this.configurationError)
      throw new ServiceUnavailableException({
        code: 'AI_NOT_CONFIGURED',
        message: this.configurationError,
      });
  }

  async recognize(bytes: Buffer, signal: AbortSignal) {
    this.assertConfigured();
    signal.throwIfAborted();
    try {
      await inspectImageContent(bytes);
    } catch {
      throw new AiRecognitionError('图片内容无效或不适合安全识别', true);
    }
    const image = await sharp(bytes, {
      limitInputPixels: false,
      animated: false,
    })
      .rotate()
      .resize({
        width: AI_IMAGE_MAX_EDGE,
        height: AI_IMAGE_MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 80 })
      .timeout({ seconds: 20 })
      .toBuffer();
    if (!image.length || image.length > AI_IMAGE_MAX_BYTES)
      throw new AiRecognitionError('识图用图片超过安全大小限制', true);
    signal.throwIfAborted();
    this.client ??= new ChatOpenAI({
      model: this.model,
      apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY'),
      configuration: {
        baseURL:
          this.config.get<string>('OPENAI_BASE_URL', '').trim() ||
          'https://api.openai.com/v1',
      },
      useResponsesApi: false,
      maxRetries: 0,
      timeout: this.config.get<number>('AI_REQUEST_TIMEOUT_MS', 60000),
      maxTokens: 3500,
    });

    try {
      const result = await this.client
        .withStructuredOutput(recognitionSchema, { method: 'jsonMode' })
        .invoke(
          [
            new SystemMessage(recognitionPrompt),
            new HumanMessage({
              content: [
                {
                  type: 'text',
                  text: '请为这张图片生成客观的 JSON 搜索索引。',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${image.toString('base64')}`,
                    detail: 'auto',
                  },
                },
              ],
            }),
          ],
          { signal },
        );
      signal.throwIfAborted();
      const parsed = recognitionSchema.parse(result);
      const clean = (value: string) => value.replace(/\u0000/g, '').trim();
      const description = clean(parsed.description);
      if (!description) throw new AiRecognitionError('模型返回了空的识图结果');
      const keywords = [...new Set(parsed.keywords.map(clean).filter(Boolean))];
      const ocrText = clean(parsed.ocrText);
      return {
        description,
        keywords,
        ocrText,
        searchText: [description, ...keywords, ocrText].join('\n'),
        model: this.model,
      };
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      const status =
        error && typeof error === 'object' && 'status' in error
          ? Number(error.status)
          : undefined;
      const rawCode =
        error && typeof error === 'object' && 'code' in error
          ? error.code
          : undefined;
      const codeValue =
        typeof rawCode === 'number' &&
        Number.isSafeInteger(rawCode) &&
        rawCode >= 0
          ? String(rawCode)
          : rawCode;
      const code =
        typeof codeValue === 'string' &&
        /^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(codeValue)
          ? codeValue
          : undefined;
      const details = [
        `模型 ${this.model}`,
        ...(Number.isFinite(status) ? [`HTTP ${status}`] : []),
        ...(code ? [code] : []),
      ].join('，');
      console.log(details);
      if (status === 401)
        throw new AiRecognitionError(
          `识图服务认证失败，请检查 OPENAI_API_KEY 和服务地址（${details}）`,
          true,
        );
      if (status === 403) {
        const workspaceDenied =
          error instanceof Error &&
          /workspace.*access denied/i.test(error.message);
        const guidance = workspaceDenied
          ? '识图服务拒绝访问当前工作空间端点，请确认 OPENAI_API_KEY 与 OPENAI_BASE_URL 属于同一工作空间且端点访问已授权'
          : '识图请求被服务商拒绝，请检查当前 API Key 的模型调用权限，或将 OPENAI_API_VISION_MODULE 配置为已授权的视觉理解模型';
        throw new AiRecognitionError(`${guidance}（${details}）`, true);
      }
      if (status === 404)
        throw new AiRecognitionError(
          `识图模型或接口不存在，请检查模型名称、OPENAI_BASE_URL 及模型访问权限（${details}）`,
          true,
        );
      if (status === 400 || status === 422)
        throw new AiRecognitionError(
          `识图请求参数或模型能力不兼容，请确认所选视觉理解模型支持 image_url 图片输入及 JSON 输出（${details}）`,
          true,
        );
      if (status === 429)
        throw new AiRecognitionError(
          `识图服务限流或额度不足，稍后重试（${details}）`,
        );
      throw new AiRecognitionError(
        `识图请求超时、服务不可用或返回格式无效，稍后重试（${details}）`,
      );
    }
  }
}
