import { Request, Response } from 'express';
import { SSEEvent } from '../types';

const sseConnections = new Map<string, Response>();

export function sseHandler(req: Request<{ sessionId: string }>, res: Response): void {
  const { sessionId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  sseConnections.set(sessionId, res);

  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  req.on('close', () => {
    sseConnections.delete(sessionId);
  });
}

export function emitSSE(sessionId: string, event: SSEEvent): void {
  const res = sseConnections.get(sessionId);
  if (res && !res.writableEnded) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}

export function closeSseConnection(sessionId: string): void {
  const res = sseConnections.get(sessionId);
  if (res && !res.writableEnded) {
    res.end();
  }
  sseConnections.delete(sessionId);
}
