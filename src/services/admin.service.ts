import { admin, adminDb } from '@/lib/firebase/admin';
import { ApiError, ForbiddenError } from '@/lib/api/errors';
import { UpdateSystemConfigInput, CreateTaskInput, UpdateTaskInput, AdminUpdateUserInput, AdminProcessWithdrawalInput, AdminResolveFraudFlagInput } from '@/lib/validations/admin.schema';

export const verifyAdmin = async (userId: string) => {
  const userDoc = await adminDb.collection('users').doc(userId).get();
  const requesterProfile = userDoc.exists ? userDoc.data() : null;

  if (requesterProfile?.role !== 'ADMIN') {
    throw new ForbiddenError('Acceso denegado. Se requiere rol de administrador.');
  }
};

export const updateSystemConfig = async (userId: string, input: UpdateSystemConfigInput) => {
  await verifyAdmin(userId);

  const { key, value } = input;

  await adminDb.collection('system_config').doc('global').set({
    [key]: value,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return {};
};

const mapToFirestore = (payload: any) => {
  const result: any = {};
  if (payload.title !== undefined) result.title = payload.title;
  if (payload.url !== undefined) result.url = payload.url;
  
  if (payload.exposure_seconds !== undefined) result.exposure_seconds = payload.exposure_seconds;
  else if (payload.exposureSeconds !== undefined) result.exposure_seconds = payload.exposureSeconds;
  
  if (payload.points_reward !== undefined) result.points_reward = payload.points_reward;
  else if (payload.pointsReward !== undefined) result.points_reward = payload.pointsReward;
  
  if (payload.is_active !== undefined) result.is_active = payload.is_active;
  else if (payload.isActive !== undefined) result.is_active = payload.isActive;
  
  if (payload.sort_order !== undefined) result.sort_order = payload.sort_order;
  else if (payload.sortOrder !== undefined) result.sort_order = payload.sortOrder;
  
  result.updated_at = admin.firestore.FieldValue.serverTimestamp();
  return result;
};

export const createTask = async (userId: string, input: CreateTaskInput) => {
  await verifyAdmin(userId);

  const taskData = mapToFirestore(input);
  taskData.created_at = admin.firestore.FieldValue.serverTimestamp();
  if (taskData.is_active === undefined) taskData.is_active = true;

  const taskRef = adminDb.collection('tasks').doc();
  await taskRef.set(taskData);

  const { created_at, updated_at, ...safeData } = taskData;
  return { id: taskRef.id, ...safeData, created_at: new Date().toISOString() };
};

export const updateTask = async (userId: string, input: UpdateTaskInput) => {
  await verifyAdmin(userId);

  const { id, ...updateData } = input;
  const taskData = mapToFirestore(updateData);

  await adminDb.collection('tasks').doc(id).update(taskData);

  return {};
};

export const deleteTask = async (userId: string, id: string) => {
  await verifyAdmin(userId);

  await adminDb.collection('tasks').doc(id).delete();

  return {};
};

export const adminUpdateUser = async (adminId: string, input: AdminUpdateUserInput) => {
  await verifyAdmin(adminId);

  const { userId, action, payload } = input;
  const userRef = adminDb.collection('users').doc(userId);

  if (action === 'UPDATE_STATUS') {
    await userRef.update({
      status: payload.status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } 
  else if (action === 'UPDATE_ROLE') {
    await userRef.update({
      role: payload.role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  else if (action === 'ADJUST_POINTS') {
    const { amount, description } = payload;
    
    await adminDb.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new ApiError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
      }

      const userData = userDoc.data()!;
      const currentPoints = userData.totalPoints ?? 0;
      const newBalance = currentPoints + Number(amount);

      transaction.update(userRef, {
        totalPoints: newBalance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const txRef = adminDb.collection('point_transactions').doc();
      transaction.set(txRef, {
        userId,
        amount: Number(amount),
        type: Number(amount) > 0 ? 'BONUS' : 'PENALTY',
        balanceAfter: newBalance,
        description: description || `Admin adjustment by ${adminId.slice(0, 8)}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  }

  return {};
};

export const processWithdrawal = async (adminId: string, input: AdminProcessWithdrawalInput) => {
  await verifyAdmin(adminId);

  const { id, action, txHash } = input;
  const withdrawRef = adminDb.collection('withdrawal_requests').doc(id);

  await adminDb.runTransaction(async (transaction) => {
    const withdrawDoc = await transaction.get(withdrawRef);
    if (!withdrawDoc.exists) {
      throw new ApiError('Solicitud de retiro no encontrada', 404, 'NOT_FOUND');
    }

    const withdrawal = withdrawDoc.data()!;
    if (withdrawal.status !== 'PENDING') {
      throw new ApiError('La solicitud ya fue procesada', 400, 'ALREADY_PROCESSED');
    }

    if (action === 'APPROVE') {
      transaction.update(withdrawRef, {
        status: 'COMPLETED',
        txHash,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else if (action === 'REJECT') {
      const userRef = adminDb.collection('users').doc(withdrawal.userId);
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new ApiError('Usuario asociado al retiro no encontrado', 404, 'USER_NOT_FOUND');
      }

      const user = userDoc.data()!;
      const pointsAmount = withdrawal.pointsAmount ?? 0;
      const newPoints = (user.totalPoints ?? 0) + pointsAmount;

      transaction.update(userRef, {
        totalPoints: newPoints,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.update(withdrawRef, {
        status: 'REJECTED',
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const txRef = adminDb.collection('point_transactions').doc();
      transaction.set(txRef, {
        userId: withdrawal.userId,
        amount: pointsAmount,
        type: 'BONUS',
        balanceAfter: newPoints,
        referenceId: id,
        description: `Refund for rejected withdrawal #${id.slice(0, 8)}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  return {};
};

export const getFraudFlags = async (adminId: string) => {
  await verifyAdmin(adminId);

  const flagsSnap = await adminDb.collection('fraud_flags')
    .orderBy('createdAt', 'desc')
    .get();

  const flags = [];
  const userCache: any = {};

  for (const doc of flagsSnap.docs) {
    const data = doc.data();
    const uId = data.userId;

    if (uId && !userCache[uId]) {
      const uSnap = await adminDb.collection('users').doc(uId).get();
      if (uSnap.exists) {
        const uData = uSnap.data()!;
        userCache[uId] = {
          full_name: uData.fullName,
          phone: uData.phone,
        };
      } else {
        userCache[uId] = { full_name: 'Deleted User', phone: '' };
      }
    }

    flags.push({
      id: doc.id,
      user_id: uId,
      reason: data.reason,
      details: data.details,
      resolved: data.resolved,
      created_at: data.createdAt?.toDate()?.toISOString() || new Date().toISOString(),
      users: userCache[uId],
    });
  }

  return { flags };
};

export const resolveFraudFlag = async (adminId: string, input: AdminResolveFraudFlagInput) => {
  await verifyAdmin(adminId);

  const { flagId, resolved } = input;
  
  await adminDb.collection('fraud_flags').doc(flagId).update({
    resolved,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {};
};
