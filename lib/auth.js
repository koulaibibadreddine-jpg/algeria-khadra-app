// أدوات المصادقة الحقيقية: تحويل الحساب المجهول (Anonymous) إلى حساب بريد/كلمة مرور
// حقيقي بدون أن يفقد المستخدم نقاطه أو أشجاره — لأننا نربط (link) بنفس الـ uid
// بدل إنشاء حساب جديد من الصفر.

import {
  EmailAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { auth } from "./firebase";

// رسائل خطأ Firebase الشائعة مترجمة للعربية
function translateAuthError(code) {
  const map = {
    "auth/email-already-in-use": "هذا البريد مستخدم من قبل. جرّب تسجيل الدخول بدل إنشاء حساب.",
    "auth/invalid-email": "صيغة البريد الإلكتروني غير صحيحة.",
    "auth/weak-password": "كلمة المرور ضعيفة، استخدم 6 أحرف على الأقل.",
    "auth/wrong-password": "كلمة المرور غير صحيحة.",
    "auth/invalid-credential": "البريد أو كلمة المرور غير صحيحة.",
    "auth/user-not-found": "لا يوجد حساب بهذا البريد.",
    "auth/too-many-requests": "محاولات كثيرة، حاول لاحقاً.",
    "auth/credential-already-in-use": "هذا البريد مرتبط بحساب آخر بالفعل.",
    "auth/network-request-failed": "تعذّر الاتصال بالخادم، تحقق من الإنترنت.",
  };
  return map[code] || "حدث خطأ غير متوقع، حاول مرة أخرى.";
}

/**
 * يربط الحساب المجهول الحالي بحساب بريد/كلمة مرور حقيقي — يحافظ على نفس الـ uid
 * (وبالتالي كل النقاط والأشجار المسجّلة تبقى كما هي).
 */
export async function registerWithEmail(email, password, displayName) {
  const user = auth.currentUser;
  if (!user) throw new Error("لا يوجد مستخدم حالي");
  try {
    const credential = EmailAuthProvider.credential(email, password);
    const result = await linkWithCredential(user, credential);
    if (displayName) {
      try { await updateProfile(result.user, { displayName }); } catch {}
    }
    return { ok: true, user: result.user };
  } catch (e) {
    return { ok: false, error: translateAuthError(e.code) };
  }
}

/**
 * تسجيل دخول بحساب بريد/كلمة مرور موجود مسبقاً (مثلاً من جهاز آخر).
 * تنبيه: هذا يبدّل الجلسة الحالية بالكامل إلى الحساب المُسجَّل دخوله،
 * فلو كان عنده بيانات anonymous غير مرتبطة سابقاً ستبقى منفصلة عنه.
 */
export async function loginWithEmail(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { ok: true, user: result.user };
  } catch (e) {
    return { ok: false, error: translateAuthError(e.code) };
  }
}

export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: translateAuthError(e.code) };
  }
}

export async function logout() {
  try {
    await signOut(auth);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** هل المستخدم الحالي مسجَّل بحساب حقيقي (بريد) وليس مجهولاً فقط؟ */
export function isRealAccount(user) {
  if (!user) return false;
  return user.providerData && user.providerData.some((p) => p.providerId === "password");
}
