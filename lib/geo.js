// أدوات جغرافية: قراءة موقع GPS الحالي، وحساب المسافة بين نقطتين (لمنع تسجيل
// نفس مكان الغرسة أكثر من مرة من نفس الحساب).

/** يطلب إذن الموقع ويرجع {lat, lng, accuracy} أو يرفض بخطأ واضح بالعربية */
export function getCurrentLocation(timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("هذا الجهاز/المتصفح لا يدعم تحديد الموقع"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        const map = {
          1: "تم رفض إذن الموقع. فعّله من إعدادات المتصفح لتسجيل الشجرة.",
          2: "تعذّر تحديد موقعك الحالي.",
          3: "استغرق تحديد الموقع وقتاً طويلاً، حاول مرة أخرى.",
        };
        reject(new Error(map[err.code] || "تعذّر الحصول على الموقع"));
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}

/** المسافة بين نقطتين بالأمتار (صيغة Haversine) */
export function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** هل هذا الموقع قريب جداً (أقل من minMeters) من أي غرسة سابقة لنفس المستخدم؟ */
export function findDuplicateLocation(newLoc, previousPlantings, minMeters = 15) {
  return previousPlantings.find(
    (p) => p.geo && distanceMeters(newLoc, p.geo) < minMeters
  );
}
