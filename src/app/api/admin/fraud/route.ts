import { NextRequest } from 'next/server';
import { verifyUser } from '@/lib/firebase/serverAuth';
import { UnauthorizedError } from '@/lib/api/errors';
import { successResponse } from '@/lib/api/response';
import { withErrorHandler } from '@/lib/api/withErrorHandler';
import { AdminResolveFraudFlagSchema } from '@/lib/validations/admin.schema';
import { getFraudFlags, resolveFraudFlag } from '@/services/admin.service';

import { withRateLimit } from '@/lib/api/withRateLimit';

async function getUserId(request: NextRequest) {
  const decodedToken = await verifyUser(request);
  if (!decodedToken) {
    throw new UnauthorizedError();
  }
  return decodedToken.uid;
}

async function getHandler(request: NextRequest) {
  const adminId = await getUserId(request);
  const result = await getFraudFlags(adminId);
  return successResponse(result);
}

async function postHandler(request: NextRequest) {
  const adminId = await getUserId(request);
  const body = await request.json();
  const input = AdminResolveFraudFlagSchema.parse(body);
  const result = await resolveFraudFlag(adminId, input);
  return successResponse(result);
}

export const GET = withErrorHandler(
  withRateLimit(getHandler, { limit: 60, windowMs: 60000 })
);
export const POST = withErrorHandler(
  withRateLimit(postHandler, { limit: 60, windowMs: 60000 })
);
