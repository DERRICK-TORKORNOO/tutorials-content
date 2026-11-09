export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: 400 | 401 | 404 | 409 | 413 | 415 | 500 | 503 = 400,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
