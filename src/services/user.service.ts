import { admin, adminDb } from '@/lib/firebase/admin';
import { UpdateUserSettingsInput } from '@/lib/validations/user.schema';

export const updateUserSettings = async (userId: string, input: UpdateUserSettingsInput) => {
  const { full_name, ton_wallet } = input;
  
  const userRef = adminDb.collection('users').doc(userId);
  
  await userRef.update({
    fullName: full_name,
    tonWallet: ton_wallet,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {};
};
