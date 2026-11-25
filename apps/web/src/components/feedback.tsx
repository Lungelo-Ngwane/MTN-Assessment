import { CircleAlert, LoaderCircle } from 'lucide-react';
import { ApiError, apiMessage } from '@/api/client';

export function ErrorNotice({ error }: { error: unknown }) {
  return (
    <div className="notice notice-error" role="alert">
      <CircleAlert size={19} aria-hidden="true" />
      <div>
        {apiMessage(error)}
        {error instanceof ApiError && error.requestId && (
          <small>Request ID {error.requestId}</small>
        )}
      </div>
    </div>
  );
}

export function Loading({ children }: { children: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
      {children}
    </div>
  );
}
