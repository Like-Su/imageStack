export class CoalescedReads {
  private readonly pending = new Map<string, Promise<unknown>>();

  run<Result>(key: string, read: () => Promise<Result>): Promise<Result> {
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<Result>;
    if (this.pending.size >= 512) return read();
    const result = Promise.resolve().then(read);
    this.pending.set(key, result);
    const clear = () => {
      if (this.pending.get(key) === result) this.pending.delete(key);
    };
    void result.then(clear, clear);
    return result;
  }
}
