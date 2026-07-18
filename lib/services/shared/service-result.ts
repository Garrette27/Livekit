export interface ServiceError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Discriminated on `ok` so a successful result always carries `data` and a
 * failed one always carries `error` — checking `result.ok` narrows the type.
 */
export type ServiceResult<T> =
  | { ok: true; data: T; error?: undefined }
  | { ok: false; data?: undefined; error: ServiceError };

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
