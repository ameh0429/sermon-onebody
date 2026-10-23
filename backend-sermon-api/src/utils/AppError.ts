export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message = 'Bad request', details?: unknown) {
    return new AppError(400, message, details);
  }
  static unauthorized(message = 'Authentication required') {
    return new AppError(401, message);
  }
  static forbidden(message = 'You do not have permission to perform this action') {
    return new AppError(403, message);
  }
  static notFound(message = 'Resource not found') {
    return new AppError(404, message);
  }
  static conflict(message = 'Resource already exists') {
    return new AppError(409, message);
  }
}
