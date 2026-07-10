import { NextRequest } from 'next/server';
import { verifyUser } from '@/lib/firebase/serverAuth';
import { UnauthorizedError } from '@/lib/api/errors';
import { successResponse } from '@/lib/api/response';
import { withErrorHandler } from '@/lib/api/withErrorHandler';
import { startTask } from '@/services/task.service';

import { withRateLimit } from '@/lib/api/withRateLimit';

async function requestHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const decodedToken = await verifyUser(req);
  if (!decodedToken) {
    throw new UnauthorizedError();
  }
  
  const userId = decodedToken.uid;
  const { id: taskId } = await params;
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const userAgent = req.headers.get('user-agent') ?? '';

  const result = await startTask(userId, taskId, ip, userAgent);

  return successResponse(result);
}

export const POST = withErrorHandler(
  withRateLimit(requestHandler, { limit: 5, windowMs: 60000 })
);
