import { AppError } from "./errors";

/**
 * Reads a response body without allowing an untrusted server to exceed the
 * caller's byte budget. Streaming is used when the runtime exposes a standard
 * ReadableStream; older React Native transports fall back to a post-read check.
 */
export async function readBoundedText(
  response: Response,
  maximumBytes: number,
  errorCode: string,
) {
  const declaredLength = Number(response.headers?.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes)
    throw new AppError(errorCode);

  const body = response.body;
  if (body?.getReader && typeof TextDecoder !== "undefined") {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maximumBytes) {
          await reader.cancel();
          throw new AppError(errorCode);
        }
        text += decoder.decode(value, { stream: true });
      }
      return text + decoder.decode();
    } finally {
      reader.releaseLock();
    }
  }

  const text = await response.text();
  if (new TextEncoder().encode(text).length > maximumBytes)
    throw new AppError(errorCode);
  return text;
}
