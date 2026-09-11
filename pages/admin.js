import { useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  collection, doc, onSnapshot, query, orderBy, where,
  updateDoc, deleteDoc, getDoc,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { Shield, Check, Trash2, Ban, Users, TreePine, Radio, ShieldOff } from "lucide-react";

export default function AdminPage() {
  const [uid, setUid] = useState(null);
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState("pending");

  const [pending, setPending] = useState([]);
  const [users, setUsers] = useState([]);
  const [live, setLive] = useState([]);
  const [toast, setToast] = useState(null);
  const notify = (m) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  // مصادقة (نفس نظام التطبيق الرئيسي) ثم التحقق هل هذا الحساب أدمن
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try { await signInAnonymously(auth); } catch {}
        return;
      }
      setUid(user.uid);
      try {
        const snap = await getDoc(doc(db, "admins", user.uid));
        setIsAdmin(snap.exists());
      } catch {
        setIsAdmin(false);
      }
      setChecking(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, "plantings"), where("moderationStatus", "==", "pending_review"));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => b.ts - a.ts);
      setPending(rows);
    });
    return unsub;
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, "users"), orderBy("points", "desc"));
    const unsub = onSnapshot(q, (snap) => setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(collection(db, "liveSessions"), (snap) =>
      setLive(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [isAdmin]);

  async function approvePlanting(id) {
    try {
      await updateDoc(doc(db, "plantings", id), { moderationStatus: "approved" });
      notify("تم قبول الصورة ✅");
    } catch { notify("تعذّر الحفظ"); }
  }

  async function rejectPlanting(p) {
    try {
      await deleteDoc(doc(db, "plantings", p.id));
      notify("تم رفض وحذف الصورة");
    } catch { notify("تعذّر الحذف"); }
  }

  async function toggleBan(u) {
    try {
      await updateDoc(doc(db, "users", u.id), { banned: !u.banned });
      notify(u.banned ? "تم رفع الحظر" : "تم حظر المستخدم");
    } catch { notify("تعذّر تنفيذ العملية"); }
  }

  async function stopLive(id) {
    try {
      await deleteDoc(doc(db, "liveSessions", id));
      notify("تم إيقاف البث");
    } catch { notify("تعذّر الإيقاف"); }
  }

  if (checking) return <div className="gk-loading">جارٍ التحقق من الصلاحيات...</div>;

  if (!isAdmin) {
    return (
      <div className="gk-admin-denied">
        <ShieldOff size={40} />
        <h2>هذه الصفحة للأدمن فقط</h2>
        <p>حسابك الحالي ليس له صلاحية الدخول للوحة التحكم.</p>
        {uid && <p className="gk-admin-uid">معرّف حسابك: <code>{uid}</code></p>}
      </div>
    );
  }

  return (
    <div className="gk-admin">
      <div className="gk-admin-header">
        <Shield size={20} /> لوحة تحكم — الجزائر الخضراء
      </div>

      <div className="gk-admin-tabs">
        <button className={tab === "pending" ? "active" : ""} onClick={() => setTab("pending")}>
          <TreePine size={15} /> بانتظار المراجعة ({pending.length})
        </button>
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
          <Users size={15} /> المستخدمون ({users.length})
        </button>
        <button className={tab === "live" ? "active" : ""} onClick={() => setTab("live")}>
          <Radio size={15} /> البثوث ({live.length})
        </button>
      </div>

      {tab === "pending" && (
        <div className="gk-admin-list">
          {pending.length === 0 && <div className="gk-empty">لا توجد صور بانتظار المراجعة 🎉</div>}
          {pending.map((p) => (
            <div className="gk-admin-card" key={p.id}>
              <img src={p.photo} alt="" />
              <div className="gk-admin-card-body">
                <b>{p.name}</b> — {p.wilaya}
                {p.note && <div className="gk-admin-note">{p.note}</div>}
                {p.geo && (
                  <a
                    className="gk-admin-geo"
                    target="_blank" rel="noopener noreferrer"
                    href={`https://www.google.com/maps?q=${p.geo.lat},${p.geo.lng}`}
                  >
                    📍 عرض الموقع على الخريطة
                  </a>
                )}
                <div className="gk-admin-actions">
                  <button className="gk-admin-btn approve" onClick={() => approvePlanting(p.id)}>
                    <Check size={14} /> قبول
                  </button>
                  <button className="gk-admin-btn reject" onClick={() => rejectPlanting(p)}>
                    <Trash2 size={14} /> رفض وحذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "users" && (
        <div className="gk-admin-list">
          {users.map((u) => (
            <div className="gk-admin-user-row" key={u.id}>
              <div>
                <b>{u.name}</b>
                <div className="gk-admin-note">{u.wilaya} — {u.points || 0} نقطة — {u.trees || 0} شجرة</div>
              </div>
              <button
                className={"gk-admin-btn " + (u.banned ? "approve" : "reject")}
                onClick={() => toggleBan(u)}
              >
                <Ban size={14} /> {u.banned ? "رفع الحظر" : "حظر"}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "live" && (
        <div className="gk-admin-list">
          {live.length === 0 && <div className="gk-empty">لا يوجد بث نشط حالياً</div>}
          {live.map((s) => (
            <div className="gk-admin-user-row" key={s.id}>
              <div>
                <b>{s.name}</b>
                <div className="gk-admin-note">{s.wilaya} — {s.url}</div>
              </div>
              <button className="gk-admin-btn reject" onClick={() => stopLive(s.id)}>
                <Trash2 size={14} /> إيقاف البث
              </button>
            </div>
          ))}
        </div>
      )}

      {toast && <div className="gk-toast">{toast}</div>}
    </div>
  );
}
