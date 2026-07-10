import { NextRequest } from 'next/server';
import { verifyUser } from '@/lib/firebase/serverAuth';
import { UnauthorizedError } from '@/lib/api/errors';
import { successResponse } from '@/lib/api/response';
import { withErrorHandler } from '@/lib/api/withErrorHandler';
import { CompleteTaskSchema } from '@/lib/validations/task.schema';
import { completeTask } from '@/services/task.service';

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

  const body = await req.json();
  const input = CompleteTaskSchema.parse(body);
  
  const resolvedParams = await params;
  const taskId = resolvedParams.id;
  const userIp = req.headers.get('x-forwarded-for') ?? '';

  const result = await completeTask(userId, taskId, input, userIp);

  return successResponse(result);
}

export const POST = withErrorHandler(
  withRateLimit(requestHandler, { limit: 5, windowMs: 60000 })
);
