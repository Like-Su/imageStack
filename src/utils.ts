import * as crypto from 'crypto';

const extMatch = /(\w|\W)+\.(\w+)$/;
const nameStrategy = {
  'images': [''],
  'videos': ['']
}
export function buildFileName(userId: number, fileName: string) {
  if (!extMatch.test(fileName)) return { _is_suc: false };

  const now = Date.now(),
    ext = fileName.match(extMatch),
    newFileName = `${userId}_${fileName}_${now}`,
    hex = Buffer.from(newFileName, 'hex'),
    fullName = `${newFileName}_${hex}.${ext}`;
  return {
    now,
    ext,
    fileName: newFileName,
    hex,
    fullName,
    _is_suc: true
  }
}


export function md5(str) {
  const hash = crypto.createHash('md5');
  hash.update(str);
  return hash.digest('hex');
}