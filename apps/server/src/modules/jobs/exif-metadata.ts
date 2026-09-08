import { parse } from 'exifr';
import type { Prisma } from '../../prisma/generated/prisma/client';
import { MediaProcessingError } from './media-processing.constants';

const exifFields = [
  'Make',
  'Model',
  'Software',
  'Orientation',
  'DateTimeOriginal',
  'CreateDate',
  'ModifyDate',
  'OffsetTimeOriginal',
  'OffsetTimeDigitized',
  'OffsetTime',
  'SubSecTimeOriginal',
  'SubSecTimeDigitized',
  'ExposureTime',
  'FNumber',
  'ISO',
  'FocalLength',
  'FocalLengthIn35mmFormat',
  'LensMake',
  'LensModel',
  'ExposureProgram',
  'ExposureCompensation',
  'MeteringMode',
  'Flash',
  'WhiteBalance',
  'ColorSpace',
  'ExifImageWidth',
  'ExifImageHeight',
  'GPSLatitude',
  'GPSLatitudeRef',
  'GPSLongitude',
  'GPSLongitudeRef',
  'GPSAltitude',
  'GPSAltitudeRef',
  'GPSDateStamp',
  'GPSTimeStamp',
];

type ExifJson = Record<string, Prisma.InputJsonValue | null>;

function jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (typeof value === 'string') {
    return value
      .replace(/\u0000/g, '')
      .trim()
      .slice(0, 2000);
  }

  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    const entries: Prisma.InputJsonValue[] = [];
    for (const item of value.slice(0, 32)) {
      if (Array.isArray(item) || (typeof item === 'object' && item !== null)) {
        continue;
      }
      const normalized = jsonValue(item);
      if (normalized !== undefined) entries.push(normalized);
    }
    return entries;
  }

  return undefined;
}

function captureDate(
  value: unknown,
  offsetValue: unknown,
  subsecondValue: unknown,
  defaultOffset: string,
): Date | null {
  if (typeof value !== 'string') return null;

  const matched =
    /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})?$/.exec(
      value,
    );
  if (!matched) return null;

  const [, year, month, day, hours, minutes, seconds, fraction, zone] = matched;
  const localTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  const local = new Date(`${localTime}.000Z`);

  if (
    !Number.isFinite(local.getTime()) ||
    local.toISOString().slice(0, 19) !== localTime
  ) {
    return null;
  }

  const offset =
    zone ??
    (typeof offsetValue === 'string' && offsetValue.length > 0
      ? offsetValue
      : defaultOffset);
  if (!/^(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/.test(offset)) {
    return null;
  }

  const offsetMinutes =
    offset === 'Z'
      ? 0
      : (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6))) *
        (offset.startsWith('-') ? -1 : 1);
  const subseconds =
    fraction ??
    (typeof subsecondValue === 'string' && /^\d{1,9}$/.test(subsecondValue)
      ? subsecondValue
      : '0');
  const milliseconds = Number(subseconds.padEnd(3, '0').slice(0, 3));

  const captured = new Date(
    local.getTime() - offsetMinutes * 60000 + milliseconds,
  );
  return captured.getUTCFullYear() >= 1 && captured.getUTCFullYear() <= 9999
    ? captured
    : null;
}

export async function extractExif(
  buffer: Buffer | undefined,
  defaultOffset: string,
): Promise<{ exif: ExifJson; takenAt: Date | null }> {
  if (!buffer?.length) return { exif: {}, takenAt: null };

  const bytes = buffer.subarray(0, 6).equals(Buffer.from('Exif\u0000\u0000'))
    ? buffer.subarray(6)
    : buffer;

  let parsed: Record<string, unknown> | undefined;

  try {
    parsed = await parse(bytes, {
      tiff: true,
      ifd1: false,
      exif: true,
      gps: true,
      pick: exifFields,
      translateKeys: true,
      translateValues: false,
      reviveValues: false,
      mergeOutput: true,
    });
  } catch {
    throw new MediaProcessingError('EXIF 元数据损坏或无法解析', true);
  }

  const exif: ExifJson = {};
  for (const field of [...exifFields, 'latitude', 'longitude']) {
    const value = jsonValue(parsed?.[field]);
    if (value !== undefined) exif[field] = value;
  }

  const takenAt =
    captureDate(
      exif.DateTimeOriginal,
      exif.OffsetTimeOriginal,
      exif.SubSecTimeOriginal,
      defaultOffset,
    ) ??
    captureDate(
      exif.CreateDate,
      exif.OffsetTimeDigitized,
      exif.SubSecTimeDigitized,
      defaultOffset,
    );

  return { exif, takenAt };
}
