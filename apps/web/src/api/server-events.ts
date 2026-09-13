export interface ServerEvent {
  type: string;
  id?: string;
  data: string;
}

export async function readServerEvents(
  response: Response,
  signal: AbortSignal,
  receive: (event: ServerEvent) => void,
) {
  if (!response.body) throw new Error("Empty event stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let type = "message";
  let id: string | undefined;
  let data: string[] = [];
  let eventSize = 0;
  const abort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    while (true) {
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        eventSize += line.length;
        if (eventSize > 65536) throw new Error("Event exceeds size limit");
        if (!line) {
          if (data.length) receive({ type, id, data: data.join("\n") });
          type = "message";
          id = undefined;
          data = [];
          eventSize = 0;
        } else {
          const separator = line.indexOf(":");
          const field = separator < 0 ? line : line.slice(0, separator);
          const value =
            separator < 0 ? "" : line.slice(separator + 1).replace(/^ /, "");
          if (field === "event") type = value;
          if (field === "id" && !value.includes("\0")) id = value;
          if (field === "data") data.push(value);
        }
        newline = buffer.indexOf("\n");
      }
      if (buffer.length > 65536) throw new Error("Event exceeds size limit");
    }
  } finally {
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
