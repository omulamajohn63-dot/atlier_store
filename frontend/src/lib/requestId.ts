let lastRequestId = '';

export function setLastRequestId(requestId: string): void {
  if (requestId) lastRequestId = requestId;
}

export function getLastRequestId(): string {
  return lastRequestId;
}