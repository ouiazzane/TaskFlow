export type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
};

export type ApiErrorBody = {
  success: false;
  message: string;
  errors: string[];
};

export function successResponse<T>(message: string, data: T): ApiSuccess<T> {
  return { success: true, message, data };
}

export function errorResponse(message: string, errors: string[] = []): ApiErrorBody {
  return { success: false, message, errors };
}
