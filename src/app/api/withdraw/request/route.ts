import { NextRequest } from 'next/server';
import { verifyUser } from '@/lib/firebase/serverAuth';
import { UnauthorizedError } from '@/lib/api/errors';
import { successResponse } from '@/lib/api/response';
import { withErrorHandler } from '@/lib/api/withErrorHandler';
import { RequestWithdrawSchema } from '@/lib/validations/withdraw.schema';
import { requestWithdrawal } from '@/services/withdraw.service';
import { withRateLimit } from '@/lib/api/withRateLimit';

async function getUserId(request: NextRequest) {
  const decodedToken = await verifyUser(request);
  if (!decodedToken) {
    throw new UnauthorizedError();
  }
  return decodedToken.uid;
}

async function postHandler(request: NextRequest) {
  const userId = await getUserId(request);
  const body = await request.json();
  const input = RequestWithdrawSchema.parse(body);

  const result = await requestWithdrawal(userId, input);

  return successResponse(result);
}

export const POST = withErrorHandler(
  withRateLimit(postHandler, { limit: 10, windowMs: 60000 })
);
