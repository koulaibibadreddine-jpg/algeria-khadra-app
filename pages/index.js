import { useEffect, useRef, useState } from "react";
import {
  Leaf, TreePine, Trophy, Camera, Video, MapPin, X, Radio, Flame, Users, ChevronLeft, Square,
} from "lucide-react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  collection, doc, onSnapshot, query, orderBy, limit, where,
  setDoc, addDoc, updateDoc, deleteDoc, increment, serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import {
  WILAYAS, getBadge, nextBadge, timeAgo, compressImage, youtubeEmbed, isFacebook,
} from "../lib/constants";

const TARGET_TREES = 1000;
const LIVE_WINDOW_MS = 4 * 60 * 60 * 1000;

export default function Home() {
  const [uid, setUid] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [users, setUsers] = useState([]);
  const [feed, setFeed] = useState([]);
  const [live, setLive] = useState([]);
  const [tab, setTab] = useState("home");
  const [showOnboard, setShowOnboard] = useState(false);
  const [showPlant, setShowPlant] = useState(false);
  const [showLiveForm, setShowLiveForm] = useState(false);
  const [toast, setToast] = useState(null);
  const notify = (m) => { setToast(m); setTimeout(() => setToast(null), 2800); };

  // 1) مصادقة مجهولة تلقائية — كل جهاز يحصل على هوية ثابتة بدون كلمة مرور
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try { await signInAnonymously(auth); } catch (e) { notify("تعذّر الاتصال بالخادم"); }
        return;
      }
      setUid(user.uid);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  // 2) الاستماع لملفي الشخصي
  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setProfile({ id: uid, ...snap.data() });
      else { setProfile(null); setShowOnboard(true); }
      setProfileChecked(true);
    });
    return unsub;
  }, [uid]);

  // 3) لوحة المتصدرين (كل المستخدمين) — تحديث لحظي فعلي
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("points", "desc"), limit(300));
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // 4) آخر الغرسات — تحديث لحظي فعلي
  useEffect(() => {
    const q = query(collection(db, "plantings"), orderBy("ts", "desc"), limit(150));
    const unsub = onSnapshot(q, (snap) => {
      setFeed(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // 5) البثوث المباشرة النشطة
  useEffect(() => {
    const cutoff = Date.now() - LIVE_WINDOW_MS;
    const q = query(collection(db, "liveSessions"), where("startedAt", ">", cutoff));
    const unsub = onSnapshot(q, (snap) => {
      setLive(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.startedAt - a.startedAt));
    });
    return unsub;
  }, []);

  async function createProfile(name, wilaya) {
    if (!uid) return;
    try {
      await setDoc(doc(db, "users", uid), { name, wilaya, points: 0, trees: 0, createdAt: serverTimestamp() });
      setShowOnboard(false);
      notify(`أهلاً بك يا ${name} 🌱`);
    } catch { notify("تعذّر إنشاء الحساب، تحقق من اتصالك"); }
  }

  async function submitPlanting(photo, note) {
    if (!uid || !profile || !photo) return;
    try {
      await addDoc(collection(db, "plantings"), {
        userId: uid, name: profile.name, wilaya: profile.wilaya,
        photo, note: note || "", ts: Date.now(), points: 50,
      });
      await updateDoc(doc(db, "users", uid), { points: increment(50), trees: increment(1) });
      setShowPlant(false);
      notify("+50 نقطة! شجرتك سُجّلت في السجل الوطني 🌳");
    } catch { notify("تعذّر الحفظ، تحقق من اتصالك بالإنترنت"); }
  }

  async function startLive(url) {
    if (!uid || !profile || !url.trim()) return;
    try {
      await setDoc(doc(db, "liveSessions", uid), {
        userId: uid, name: profile.name, wilaya: profile.wilaya, url: url.trim(), startedAt: Date.now(),
      });
      setShowLiveForm(false);
      notify("بثّك الآن ظاهر للجميع 📡");
    } catch { notify("تعذّر بدء البث"); }
  }

  async function endLive() {
    if (!uid) return;
    try { await deleteDoc(doc(db, "liveSessions", uid)); } catch {}
  }

  if (!authReady || !profileChecked) return <div className="gk-loading">جارٍ التحميل...</div>;

  const totalTrees = users.reduce((s, u) => s + (u.trees || 0), 0);
  const pct = Math.min(100, Math.round((totalTrees / TARGET_TREES) * 100));
  const wilayaStats = {};
  users.forEach((u) => {
    if (!wilayaStats[u.wilaya]) wilayaStats[u.wilaya] = { points: 0, trees: 0, people: 0 };
    wilayaStats[u.wilaya].points += u.points || 0;
    wilayaStats[u.wilaya].trees += u.trees || 0;
    wilayaStats[u.wilaya].people += 1;
  });
  const wilayaRanking = Object.entries(wilayaStats).sort((a, b) => b[1].points - a[1].points);
  const myPoints = profile ? profile.points || 0 : 0;
  const myBadge = getBadge(myPoints);
  const nb = nextBadge(myPoints);
  const isLiveMine = uid && live.some((s) => s.id === uid);

  return (
    <div className="gk-root">
      <div className="gk-header">
        <div className="gk-brand"><Leaf size={20} /> الجزائر الخضراء</div>
        {profile && <div className="gk-chip"><Trophy size={14} /> {myPoints} نقطة</div>}
      </div>

      <div className="gk-hero">
        <div className="gk-hero-leaf">🌿</div>
        <h1>كل شجرة تغرسها، تراها كل الجزائر</h1>
        <p>صوّر غرستك، اجمع النقاط، وتنافس مع كل الولايات في تحدٍ وطني واحد.</p>
        <div className="gk-count"><small>مجموع الأشجار المسجّلة</small><br />{totalTrees}</div>
        <button className="gk-cta" onClick={() => (profile ? setShowPlant(true) : setShowOnboard(true))}>
          <Camera size={18} /> ازرع وسجّل شجرتك الآن
        </button>
      </div>

      {tab === "home" && (
        <div className="gk-section">
          <div className="gk-challenge">
            <h2 style={{ marginBottom: 4 }}><Flame size={16} color="#D9A441" /> تحدي الموسم</h2>
            <div style={{ fontSize: 13, color: "#4a544c" }}>
              هدفنا {TARGET_TREES} شجرة على مستوى الوطن — بلغنا {totalTrees}
            </div>
            <div className="gk-bar-track"><div className="gk-bar-fill" style={{ width: pct + "%" }} /></div>
            {profile && (
              <div style={{ fontSize: 12, marginTop: 10, color: "#4a544c" }}>
                رتبتك: {myBadge.icon} {myBadge.name}
                {nb && ` — بقي ${nb.min - myPoints} نقطة لرتبة ${nb.name} ${nb.icon}`}
              </div>
            )}
          </div>

          {live.length > 0 && (
            <>
              <h2><Radio size={16} color="#e0483a" /> بثوث مباشرة الآن</h2>
              {live.slice(0, 2).map((s) => <LiveCard key={s.id} s={s} />)}
            </>
          )}

          <h2><TreePine size={16} /> آخر الغرسات</h2>
          {feed.length === 0 && <div className="gk-empty">لا توجد غرسات بعد. كن أول من يزرع 🌱</div>}
          {feed.slice(0, 12).map((f) => (
            <div className="gk-feed-item" key={f.id}>
              <img src={f.photo} alt="" />
              <div className="gk-feed-txt">
                <b>{f.name}</b>
                <div className="gk-feed-meta">
                  <span><MapPin size={11} style={{ verticalAlign: "-1px" }} /> {f.wilaya}</span>
                  <span>{timeAgo(f.ts)}</span>
                  <span style={{ color: "#4C9A5B", fontWeight: 700 }}>+{f.points}</span>
                </div>
                {f.note && <div style={{ fontSize: 12, marginTop: 3, color: "#4a544c" }}>{f.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "board" && (
        <div className="gk-section">
          <h2><Trophy size={16} /> ترتيب الولايات</h2>
          {wilayaRanking.length === 0 && <div className="gk-empty">لا بيانات بعد.</div>}
          {wilayaRanking.length >= 3 && (
            <div className="gk-podium">
              <PodiumCard cls="second" label={wilayaRanking[1][0]} val={wilayaRanking[1][1].points} medal="🥈" />
              <PodiumCard cls="first" label={wilayaRanking[0][0]} val={wilayaRanking[0][1].points} medal="🥇" />
              <PodiumCard cls="third" label={wilayaRanking[2][0]} val={wilayaRanking[2][1].points} medal="🥉" />
            </div>
          )}
          {wilayaRanking.slice(wilayaRanking.length >= 3 ? 3 : 0).map(([name, st], i) => (
            <div className="gk-list-row" key={name}>
              <div className="gk-rank">{wilayaRanking.length >= 3 ? i + 4 : i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{name}</div>
                <div style={{ fontSize: 11, color: "#8a9587" }}>{st.trees} شجرة · {st.people} مشارك</div>
              </div>
              <div style={{ fontWeight: 800, color: "var(--forest)" }}>{st.points}</div>
            </div>
          ))}

          <h2 style={{ marginTop: 26 }}><Users size={16} /> أفضل المتطوعين</h2>
          {users.length === 0 && <div className="gk-empty">كن أول متطوّع مسجّل.</div>}
          {users.slice(0, 30).map((u, i) => (
            <div className="gk-list-row" key={u.id}>
              <div className="gk-rank">{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{u.name} {getBadge(u.points).icon}</div>
                <div style={{ fontSize: 11, color: "#8a9587" }}>{u.wilaya} · {u.trees} شجرة</div>
              </div>
              <div style={{ fontWeight: 800, color: "var(--forest)" }}>{u.points}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "live" && (
        <div className="gk-section">
          <h2><Radio size={16} color="#e0483a" /> البث المباشر</h2>
          <p style={{ fontSize: 12.5, color: "#5a655c", marginTop: -6, marginBottom: 16 }}>
            ابدأ بثاً على يوتيوب أو فيسبوك من هاتفك، ثم الصق الرابط هنا ليظهر مباشرة لكل مستخدمي التطبيق حول الوطن.
          </p>
          {profile && (
            isLiveMine ? (
              <button className="gk-btn" style={{ background: "#e0483a", marginBottom: 16 }} onClick={endLive}>
                <Square size={14} style={{ display: "inline", verticalAlign: "-2px", marginLeft: 6 }} /> إنهاء بثّي
              </button>
            ) : (
              <button className="gk-btn" style={{ marginBottom: 16 }} onClick={() => setShowLiveForm(true)}>
                <Video size={16} style={{ display: "inline", verticalAlign: "-3px", marginLeft: 6 }} /> ابدأ بثاً مباشراً
              </button>
            )
          )}
          {live.length === 0 && <div className="gk-empty">لا يوجد بث الآن. كن أول من يبث غرسه 📡</div>}
          {live.map((s) => <LiveCard key={s.id} s={s} />)}
        </div>
      )}

      <div className="gk-tabs">
        <TabBtn active={tab === "home"} onClick={() => setTab("home")} icon={<Leaf size={18} />} label="الرئيسية" />
        <TabBtn active={tab === "board"} onClick={() => setTab("board")} icon={<Trophy size={18} />} label="الترتيب" />
        <TabBtn active={tab === "live"} onClick={() => setTab("live")} icon={<Radio size={18} />} label="البث المباشر" />
      </div>

      {showOnboard && <OnboardModal onSubmit={createProfile} />}

      {showPlant && (
        <PlantModal
          onClose={() => setShowPlant(false)}
          onSubmit={submitPlanting}
        />
      )}

      {showLiveForm && (
        <div className="gk-modal-wrap">
          <div className="gk-modal">
            <button className="gk-close" onClick={() => setShowLiveForm(false)}><X size={16} /></button>
            <h3>📡 ابدأ بثاً مباشراً</h3>
            <p style={{ fontSize: 12.5, color: "#5a655c", marginTop: -8, marginBottom: 14 }}>
              افتح تطبيق يوتيوب أو فيسبوك وابدأ البث المباشر من الكاميرا، ثم انسخ رابط البث والصقه هنا.
            </p>
            <LiveForm onSubmit={startLive} />
          </div>
        </div>
      )}

      {toast && <div className="gk-toast">{toast}</div>}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }) {
  return <button className={"gk-tab" + (active ? " active" : "")} onClick={onClick}>{icon}{label}</button>;
}

function PodiumCard({ cls, label, val, medal }) {
  return (
    <div className={"gk-podium-card " + cls}>
      <div className="gk-podium-medal">{medal}</div>
      <div style={{ fontWeight: 800, fontSize: 13, marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: "#8a9587" }}>{val} نقطة</div>
    </div>
  );
}

function LiveCard({ s }) {
  const yt = youtubeEmbed(s.url);
  const fb = isFacebook(s.url);
  return (
    <div className="gk-live-card">
      {yt ? (
        <iframe src={yt} title="live" allow="autoplay; encrypted-media" allowFullScreen />
      ) : fb ? (
        <iframe src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(s.url)}&show_text=0`} title="live" allowFullScreen />
      ) : (
        <a href={s.url} target="_blank" rel="noopener noreferrer" className="gk-live-fallback">
          <Video size={22} /> افتح البث الخارجي
        </a>
      )}
      <div className="gk-live-meta">
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</div>
          <div style={{ fontSize: 11, color: "#8a9587" }}><MapPin size={11} style={{ verticalAlign: "-1px" }} /> {s.wilaya}</div>
        </div>
        <div className="gk-live-tag"><Radio size={10} /> مباشر</div>
      </div>
    </div>
  );
}

function LiveForm({ onSubmit }) {
  const [url, setUrl] = useState("");
  return (
    <>
      <div className="gk-field">
        <label>رابط البث (يوتيوب أو فيسبوك)</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
      </div>
      <button className="gk-btn" disabled={!url.trim()} onClick={() => onSubmit(url)}>نشر البث للجميع</button>
    </>
  );
}

function PlantModal({ onClose, onSubmit }) {
  const [photo, setPhoto] = useState(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try { setPhoto(await compressImage(file)); } catch { /* ignore */ }
  }

  async function submit() {
    setSaving(true);
    await onSubmit(photo, note);
    setSaving(false);
  }

  return (
    <div className="gk-modal-wrap">
      <div className="gk-modal">
        <button className="gk-close" onClick={onClose}><X size={16} /></button>
        <h3>🌳 سجّل غرستك</h3>
        {!photo ? (
          <div className="gk-camera-box" onClick={() => fileRef.current && fileRef.current.click()}>
            <Camera size={28} style={{ marginBottom: 8 }} />
            <div>اضغط لالتقاط صورة الشجرة</div>
          </div>
        ) : (
          <img src={photo} className="gk-photo-preview" alt="معاينة" />
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFile} />
        {photo && (
          <button className="gk-btn ghost" style={{ marginBottom: 12 }} onClick={() => { setPhoto(null); fileRef.current && fileRef.current.click(); }}>
            تغيير الصورة
          </button>
        )}
        <div className="gk-field">
          <label>أين غرستها؟ (اختياري)</label>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: حديقة الحي، بسكرة" />
        </div>
        <button className="gk-btn" disabled={!photo || saving} onClick={submit}>
          {saving ? "جارٍ الحفظ..." : "إرسال والحصول على 50 نقطة"}
        </button>
      </div>
    </div>
  );
}

function OnboardModal({ onSubmit }) {
  const [name, setName] = useState("");
  const [wilaya, setWilaya] = useState("بسكرة");
  return (
    <div className="gk-modal-wrap">
      <div className="gk-modal">
        <h3>🌱 مرحباً بك في الجزائر الخضراء</h3>
        <div className="gk-field">
          <label>اسمك</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: أمين" />
        </div>
        <div className="gk-field">
          <label>ولايتك</label>
          <select value={wilaya} onChange={(e) => setWilaya(e.target.value)}>
            {WILAYAS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <button className="gk-btn" disabled={!name.trim()} onClick={() => onSubmit(name.trim(), wilaya)}>
          انضم للتحدي <ChevronLeft size={14} style={{ display: "inline", verticalAlign: "-2px" }} />
        </button>
      </div>
    </div>
  );
}
