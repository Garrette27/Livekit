export interface ServiceError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

export interface ServiceResult<T> {
  ok: boolean;
  data?: T;
  error?: ServiceError;
}

export function serviceOk<T>(data: T): ServiceResult<T> {
  return {
    ok: true,
    data,
  };
}

export function serviceError<T>(
  status: number,
  code: string,
  message: string,
  details?: unknown
): ServiceResult<T> {
  return {
    ok: false,
    error: {
      status,
      code,
      message,
      details,
    },
  };
}
