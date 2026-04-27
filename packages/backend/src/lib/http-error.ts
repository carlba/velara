export class HttpError extends Error {
  statusCode: number;

  constructor(message: string, options: ErrorOptions & { statusCode: number }) {
    super(message, options);
    this.statusCode = options.statusCode;
    this.name = 'HttpError';
    Error.captureStackTrace(this, HttpError);
  }
}
