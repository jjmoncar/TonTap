import { NextRequest } from 'next/server';
import { verifyUser } from '@/lib/firebase/serverAuth';
import { UnauthorizedError } from '@/lib/api/errors';
import { successResponse } from '@/lib/api/response';
import { withErrorHandler } from '@/lib/api/withErrorHandler';
import { UpdateUserSettingsSchema } from '@/lib/validations/user.schema';
import { updateUserSettings } from '@/services/user.service';
import { withRateLimit } from '@/lib/api/withRateLimit';

async function getUserId(request: NextRequest) {
  const decodedToken = await verifyUser(request);
  if (!decodedToken) {
    throw new UnauthorizedError();
  }
  return decodedToken.uid;
}

async function putHandler(request: NextRequest) {
  const userId = await getUserId(request);
  const body = await request.json();
  const input = UpdateUserSettingsSchema.parse(body);
  const result = await updateUserSettings(userId, input);
  return successResponse(result);
}

export const PUT = withErrorHandler(
  withRateLimit(putHandler, { limit: 60, windowMs: 60000 })
);
