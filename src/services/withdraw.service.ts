import { admin, adminDb } from '@/lib/firebase/admin';
import { ApiError } from '@/lib/api/errors';
import { RequestWithdrawInput } from '@/lib/validations/withdraw.schema';

export const requestWithdrawal = async (userId: string, input: RequestWithdrawInput) => {
  const { amountPoints } = input;

  // 1. Obtener configuraciones del sistema
  const configSnap = await adminDb.collection('system_config').doc('global').get();
  const configMap = configSnap.exists ? configSnap.data()! : {};

  if (configMap.maintenance_mode === 'true') {
    throw new ApiError('El sistema está en mantenimiento. Intenta de nuevo más tarde.', 503, 'MAINTENANCE_MODE');
  }

  const MIN_WITHDRAWAL = Number(configMap.min_withdrawal_points || 10000);
  const TON_RATE = Number(configMap.ton_per_point || 0.00001);

  if (amountPoints < MIN_WITHDRAWAL) {
    throw new ApiError(`El monto mínimo de retiro es ${MIN_WITHDRAWAL} puntos`, 400, 'INSUFFICIENT_MINIMUM');
  }

  const userRef = adminDb.collection('users').doc(userId);

  return adminDb.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new ApiError('Perfil de usuario no encontrado', 404, 'USER_NOT_FOUND');
    }

    const profile = userDoc.data()!;
    const totalPoints = profile.totalPoints ?? 0;

    if (totalPoints < amountPoints) {
      throw new ApiError('Puntos insuficientes', 400, 'INSUFFICIENT_POINTS');
    }

    if (!profile.tonWallet) {
      throw new ApiError('Billetera TON no configurada', 400, 'WALLET_NOT_CONFIGURED');
    }

    const tonAmount = amountPoints * TON_RATE;

    // Crear solicitud de retiro
    const withdrawRef = adminDb.collection('withdrawal_requests').doc();
    const withdrawId = withdrawRef.id;
    transaction.set(withdrawRef, {
      userId,
      pointsAmount: amountPoints,
      tonAmount,
      tonRate: TON_RATE,
      tonWallet: profile.tonWallet,
      status: 'PENDING',
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      processedAt: null,
    });

    // Descontar puntos del usuario
    const newPoints = totalPoints - amountPoints;
    transaction.update(userRef, {
      totalPoints: newPoints,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Crear transacción de puntos
    const txRef = adminDb.collection('point_transactions').doc();
    transaction.set(txRef, {
      userId,
      amount: -amountPoints,
      type: 'WITHDRAW',
      balanceAfter: newPoints,
      referenceId: withdrawId,
      description: `Withdrawal request #${withdrawId.slice(0, 8)}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { withdrawal_id: withdrawId, new_total: newPoints };
  });
};
