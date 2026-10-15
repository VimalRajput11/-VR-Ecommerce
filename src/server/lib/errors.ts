export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public field?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string, field?: string) => new ApiError(400, message, "bad_request", field);
export const unauthorized = (message = "Please sign in to continue.") => new ApiError(401, message, "unauthorized");
export const forbidden = (message = "You do not have permission to do that.") => new ApiError(403, message, "forbidden");
export const notFound = (message = "Not found.") => new ApiError(404, message, "not_found");
export const conflict = (message: string) => new ApiError(409, message, "conflict");
export const tooManyRequests = (message = "Too many attempts. Please wait a moment and try again.") =>
  new ApiError(429, message, "rate_limited");
