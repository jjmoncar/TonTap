import { admin, adminDb } from '@/lib/firebase/admin';
import { ApiError } from '@/lib/api/errors';
import { CompleteTaskInput } from '@/lib/validations/task.schema';
import { after } from 'next/server';

export const completeTask = async (userId: string, taskId: string, input: CompleteTaskInput, userIp: string) => {
  const { captchaToken, sessionId } = input;

  // 1. Verificar CAPTCHA con Google
  const captchaRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    body: new URLSearchParams({
      secret: process.env.RECAPTCHA_SECRET_KEY!,
      response: captchaToken,
      remoteip: userIp,
    }),
  });
  const { success: captchaOk } = await captchaRes.json();
  
  if (!captchaOk) {
    throw new ApiError('CAPTCHA inválido', 400, 'INVALID_CAPTCHA');
  }

  // 2. Ejecutar transacción en Firestore
  const result = await adminDb.runTransaction(async (transaction) => {
    const sessionRef = adminDb.collection('task_sessions').doc(sessionId);
    const sessionDoc = await transaction.get(sessionRef);

    if (!sessionDoc.exists) {
      throw new ApiError('Sesión no encontrada', 404, 'SESSION_NOT_FOUND');
    }

    const session = sessionDoc.data()!;
    if (session.status === 'COMPLETED') {
      throw new ApiError('La tarea ya fue completada', 400, 'TASK_ALREADY_COMPLETED');
    }

    const taskRef = adminDb.collection('tasks').doc(taskId);
    const taskDoc = await transaction.get(taskRef);

    if (!taskDoc.exists) {
      throw new ApiError('Tarea no encontrada', 404, 'TASK_NOT_FOUND');
    }

    const task = taskDoc.data()!;
    
    // Validar tiempo transcurrido
    const startedAt = session.startedAt.toDate();
    const now = new Date();
    const elapsedSeconds = (now.getTime() - startedAt.getTime()) / 1000;
    const requiredSeconds = task.exposureSeconds ?? 30;

    if (elapsedSeconds < (requiredSeconds - 2)) {
      throw new ApiError('Tiempo de exposición insuficiente', 400, 'TIME_NOT_MET');
    }

    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new ApiError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    }

    const user = userDoc.data()!;
    const pointsReward = task.pointsReward ?? 0;
    const newTotalPoints = (user.totalPoints ?? 0) + pointsReward;

    // Actualizar puntos del usuario
    transaction.update(userRef, {
      totalPoints: newTotalPoints,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Marcar la sesión como completada
    transaction.update(sessionRef, {
      status: 'COMPLETED',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      captchaValid: true,
    });

    // Registrar la transacción de puntos
    const transactionRef = adminDb.collection('point_transactions').doc();
    transaction.set(transactionRef, {
      userId,
      type: 'EARN',
      amount: pointsReward,
      balanceAfter: newTotalPoints,
      referenceId: sessionId,
      description: `Completed task: ${taskId}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { newTotalPoints };
  });

  // 3. Lógica de Detección de Bot en Background/Post-transacción (no bloquea el response)
  after(() => {
    runBotDetection(userId).catch(err => console.error('Error running bot detection:', err));
  });

  return result;
};

async function runBotDetection(userId: string) {
  const configDoc = await adminDb.collection('system_config').doc('global').get();
  const systemConfig = configDoc.data() || {};
  const fraudAlertsEnabled = systemConfig.fraud_alerts_enabled !== 'false';

  if (!fraudAlertsEnabled) return;

  const botThreshold = parseInt(systemConfig.bot_detection_consecutive_threshold || '5', 10);
  
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySessionsQuery = await adminDb.collection('task_sessions')
    .where('userId', '==', userId)
    .where('status', '==', 'COMPLETED')
    .where('sessionDate', '==', todayStr)
    .get();

  let suspiciousCount = 0;
  
  for (const doc of todaySessionsQuery.docs) {
    const session = doc.data();
    if (session.completedAt && session.startedAt) {
      const completed = session.completedAt.toDate().getTime();
      const started = session.startedAt.toDate().getTime();
      const diffSeconds = (completed - started) / 1000;

      const taskSnapshot = await adminDb.collection('tasks').doc(session.taskId).get();
      const taskData = taskSnapshot.data();
      const reqSec = taskData?.exposureSeconds ?? 30;
      
      if (diffSeconds >= (reqSec - 2) && diffSeconds <= (reqSec + 3)) {
        suspiciousCount++;
      }
    }
  }

  if (suspiciousCount >= botThreshold) {
    const existingFlag = await adminDb.collection('fraud_flags')
      .where('userId', '==', userId)
      .where('reason', '==', 'SUSPICIOUS_BOT_BEHAVIOR')
      .where('resolved', '==', false)
      .get();

    if (existingFlag.empty) {
      const fraudFlagRef = adminDb.collection('fraud_flags').doc();
      await fraudFlagRef.set({
        userId,
        reason: 'SUSPICIOUS_BOT_BEHAVIOR',
        details: {
          message: `User completed ${suspiciousCount}+ tasks today with completion times within 3 seconds of the required minimum.`,
          consecutiveFastCompletions: suspiciousCount,
        },
        resolved: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await adminDb.collection('users').doc(userId).set({
        isFlagged: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }
}

export const startTask = async (userId: string, taskId: string, ip: string, userAgent: string) => {
  // 1. Verificar que la tarea existe y está activa
  const taskDoc = await adminDb.collection('tasks').doc(taskId).get();
  if (!taskDoc.exists || !taskDoc.data()?.isActive) {
    throw new ApiError('Tarea no encontrada o inactiva', 404, 'TASK_NOT_FOUND');
  }

  // 2. Verificar que no exista sesión hoy
  const sessionDate = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
  const sessionDocId = `${userId}_${taskId}_${sessionDate}`;
  const sessionRef = adminDb.collection('task_sessions').doc(sessionDocId);
  const sessionDoc = await sessionRef.get();

  if (sessionDoc.exists) {
    throw new ApiError('Ya iniciaste esta tarea hoy', 409, 'TASK_ALREADY_STARTED');
  }

  // 3. Crear la sesión
  const sessionData = {
    id: sessionDocId,
    userId,
    taskId,
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    completedAt: null,
    status: 'IN_PROGRESS',
    ipAddress: ip,
    userAgent,
    captchaValid: false,
    sessionDate,
  };

  await sessionRef.set(sessionData);

  // 4. Lógica de Detección de Fraude por IP
  if (ip && ip !== 'unknown' && ip !== '') {
    after(() => {
      runIpFraudDetection(userId, ip).catch(err => console.error('Error running IP fraud detection:', err));
    });
  }

  return { sessionId: sessionDocId };
};

async function runIpFraudDetection(userId: string, ip: string) {
  const ipRegistryId = `${ip.replace(/\//g, '_')}_${userId}`;
  const ipRegistryRef = adminDb.collection('ip_registry').doc(ipRegistryId);
  
  await ipRegistryRef.set({
    ipAddress: ip,
    userId,
    seenAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const configDoc = await adminDb.collection('system_config').doc('global').get();
  const systemConfig = configDoc.data() || {};
  const fraudAlertsEnabled = systemConfig.fraud_alerts_enabled !== 'false';
  const maxSharedIps = parseInt(systemConfig.max_shared_ips || '2', 10);

  if (fraudAlertsEnabled) {
    const ipQuery = await adminDb.collection('ip_registry')
      .where('ipAddress', '==', ip)
      .get();

    const otherUserIds = new Set<string>();
    ipQuery.forEach(doc => {
      const data = doc.data();
      if (data.userId !== userId) {
        otherUserIds.add(data.userId);
      }
    });

    if (otherUserIds.size >= maxSharedIps) {
      const fraudFlagRef = adminDb.collection('fraud_flags').doc();
      await fraudFlagRef.set({
        userId,
        reason: 'SHARED_IP',
        details: {
          ipAddress: ip,
          reason: 'Multiple accounts sharing the same IP address',
          sharedAccountsCount: otherUserIds.size + 1,
          otherUserIds: Array.from(otherUserIds),
        },
        resolved: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await adminDb.collection('users').doc(userId).set({
        isFlagged: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }
}
