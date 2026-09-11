// فحص الصور داخل المتصفح مباشرة (client-side) — بدون إرسال الصورة لأي خادم خارجي.
//
// ملاحظة تقنية: مكتبة nsfwjs تحزّم أوزان نموذج الكشف داخل ملفات JS بطريقة لا يتوافقها
// webpack الخاص بـ Next.js عند استيرادها بشكل عادي (import/require)، لذلك حمّلناها هنا
// كملف ثابت (public/vendor/nsfwjs.min.js) عبر وسم <script> في وقت التشغيل — هذا يتفادى
// المشكلة تمامًا، ويعمل بدون أي اتصال بخادم خارجي (النموذج مضمّن داخل نفس الملف).
//
// ⚠️ حدود مهمة يجب معرفتها:
// 1) دقة فحص NSFW جيدة لكن ليست 100%.
// 2) هذا الفحص client-side فقط — مستخدم متقدم يقدر نظريًا يتلاعب بالكود من المتصفح
//    ويتجاوزه. للحماية الكاملة، يُفضَّل لاحقًا إضافة فحص ثانٍ من طرف الخادم
//    (Cloud Function تراجع الصورة بعد الإرسال وتحذفها لو خالفت).
// 3) "كشف الشجرة" لا يوجد له نموذج مجاني جاهز بدقة عالية، لذلك استخدمنا هنا
//    تقدير تقريبي (نسبة الألوان الخضراء/الترابية في الصورة) كمرشّح أولي فقط —
//    وليس حكمًا قاطعًا. أي صورة تحصل على تقدير منخفض تُعلَّم "بانتظار المراجعة"
//    بدل رفضها مباشرة، لتفادي رفض صور حقيقية (غرسة صغيرة، إضاءة ضعيفة، تربة جافة...).

const NSFWJS_SCRIPT_URL = "/vendor/nsfwjs.min.js";

let scriptLoadPromise = null;
function loadNsfwScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("server-side"));
  if (window.nsfwjs) return Promise.resolve(window.nsfwjs);
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${NSFWJS_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.nsfwjs));
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.src = NSFWJS_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(window.nsfwjs);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

let nsfwModelPromise = null;
async function loadNsfwModel() {
  if (!nsfwModelPromise) {
    nsfwModelPromise = loadNsfwScript().then((nsfwjs) => nsfwjs.load());
  }
  return nsfwModelPromise;
}

function dataUrlToImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// تقدير تقريبي لنسبة البكسلات "الخضراء/الترابية" في الصورة (نبات، أوراق، تربة)
function estimateGreeneryScore(imgEl) {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imgEl, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  let plantLike = 0;
  const total = size * size;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const isGreenish = g > r * 1.08 && g > b * 1.08;
    const isEarthy = r > 80 && r < 190 && g > 55 && g < 160 && b < 110 && r >= g;
    if (isGreenish || isEarthy) plantLike++;
  }
  return plantLike / total; // 0 → لا يوجد أخضر/ترابي إطلاقًا، 1 → الصورة كلها كذلك
}

/**
 * يفحص صورة (dataURL) ويرجع:
 * { blocked, blockedReason, needsReview, greenScore, predictions }
 */
export async function checkPlantingPhoto(dataUrl) {
  const imgEl = await dataUrlToImage(dataUrl);

  // 1) فحص المحتوى غير اللائق
  const model = await loadNsfwModel();
  const predictions = await model.classify(imgEl);
  const flagged = predictions.find(
    (p) => ["Porn", "Hentai", "Sexy"].includes(p.className) && p.probability > 0.5
  );

  if (flagged) {
    return {
      blocked: true,
      blockedReason: flagged.className,
      needsReview: false,
      greenScore: null,
      predictions,
    };
  }

  // 2) تقدير أولي: هل تبدو الصورة نباتية؟ (مرشّح وليس حكم نهائي)
  const greenScore = estimateGreeneryScore(imgEl);
  const needsReview = greenScore < 0.12;

  return { blocked: false, blockedReason: null, needsReview, greenScore, predictions };
}
