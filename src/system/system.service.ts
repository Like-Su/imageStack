import { Injectable } from '@nestjs/common';
import * as nodeDiskInfo from 'node-disk-info';

const toGB = (n: number, fixed: number) => (bytes: number) => (bytes / (Math.pow(1024, n))).toFixed(fixed)

@Injectable()
export class SystemService {
  // k => GB, 1024 ** 3
  static bytesToGB = toGB(3, 2);
  async getDiskInfo() {
    const disks = await nodeDiskInfo.getDiskInfoSync();
    return disks.map((disk: any) => {
      let {
        _mounted,
        _filesystem,
        _blocks,
        _used,
        _available
      } = disk;

      _blocks = _blocks || 0;
      return {
        dirName: _mounted.slice(0, 1),
        typeName: _filesystem,
        total: this.bytesToGB(_blocks),
        used: this.bytesToGB(_used),
        free: this.bytesToGB(_available),
        usage: this.toPercenter(_used, _blocks)
      }
    });
  }

  bytesToGB(bytes) {
    return SystemService.bytesToGB(bytes) + 'GB';
  }

  toPercenter(used, blocks) {
    return ((used / blocks) * 100).toFixed(2) + '%';
  }

}
