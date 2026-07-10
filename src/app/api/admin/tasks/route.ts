import { NextRequest } from 'next/server';
import { verifyUser } from '@/lib/firebase/serverAuth';
import { UnauthorizedError } from '@/lib/api/errors';
import { successResponse } from '@/lib/api/response';
import { withErrorHandler } from '@/lib/api/withErrorHandler';
import { CreateTaskSchema, UpdateTaskSchema } from '@/lib/validations/admin.schema';
import { createTask, updateTask, deleteTask } from '@/services/admin.service';

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
  const input = CreateTaskSchema.parse(body);
  const result = await createTask(userId, input);
  return successResponse(result);
}

async function putHandler(request: NextRequest) {
  const userId = await getUserId(request);
  const body = await request.json();
  const input = UpdateTaskSchema.parse(body);
  const result = await updateTask(userId, input);
  return successResponse(result);
}

async function deleteHandler(request: NextRequest) {
  const userId = await getUserId(request);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) throw new Error('Missing task ID'); // Handled by generic error or we can create ValidationError
  const result = await deleteTask(userId, id);
  return successResponse(result);
}

export const POST = withErrorHandler(
  withRateLimit(postHandler, { limit: 60, windowMs: 60000 })
);
export const PUT = withErrorHandler(
  withRateLimit(putHandler, { limit: 60, windowMs: 60000 })
);
export const DELETE = withErrorHandler(
  withRateLimit(deleteHandler, { limit: 60, windowMs: 60000 })
);
