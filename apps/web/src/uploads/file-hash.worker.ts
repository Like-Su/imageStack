import { blake3, createBLAKE3 } from "hash-wasm";

self.onmessage = async (
  event: MessageEvent<{ file: File; chunkSize: number }>,
) => {
  try {
    const { file, chunkSize } = event.data;
    const hasher = await createBLAKE3();
    hasher.init();
    const chunkHashes: string[] = [];
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      const bytes = new Uint8Array(
        await file.slice(offset, offset + chunkSize).arrayBuffer(),
      );
      hasher.update(bytes);
      chunkHashes.push(await blake3(bytes));
      self.postMessage({
        type: "progress",
        loaded: Math.min(offset + chunkSize, file.size),
      });
    }
    self.postMessage({
      type: "complete",
      hash: hasher.digest("hex"),
      chunkHashes,
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "文件指纹计算失败",
    });
  }
};
