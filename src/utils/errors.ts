/** Typed operational failure; UI translates codes rather than showing raw payloads. */
export class AppError extends Error {
  constructor(
    public code: string,
    message = code,
    public retryAt = 0,
  ) {
    super(message);
    this.name = "AppError";
  }
}
/** Keeps unknown thrown values out of user-facing messages and logs. */
export function errorCode(error: unknown) {
  return error instanceof AppError ? error.code : "UNKNOWN_ERROR";
}
