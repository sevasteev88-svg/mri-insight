import React, { useState, useEffect } from "react";
import { supabase } from "../services/supabase.js";
import { P } from "../styles/styles.js";
import { Lock, Mail, AlertCircle, LogOut } from "lucide-react";

export function AuthModal({ isLocked, setIsLocked }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState("");
  const [busy, setBusy] = useState(false);

  // PIN states: "auth" | "setup" | "locked" | "unlocked"
  const [pinMode, setPinMode] = useState("locked");
  const [pinInput, setPinInput] = useState("");
  const [pinSetupFirst, setPinSetupFirst] = useState("");
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const savedPin = localStorage.getItem("mri_doctor_pin");
      if (!session) {
        setPinMode("auth");
        setIsLocked(true);
      } else if (!savedPin) {
        setPinMode("setup");
        setIsLocked(true);
      } else {
        setPinMode("locked");
        setIsLocked(true);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setPinMode("auth");
        setIsLocked(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [setIsLocked]);

  useEffect(() => {
    if (isLocked) {
      const savedPin = localStorage.getItem("mri_doctor_pin");
      if (!session) setPinMode("auth");
      else if (!savedPin) setPinMode("setup");
      else setPinMode("locked");
      setPinInput("");
    }
  }, [isLocked, session]);

  const handleAuth = async (e) => {
    e?.preventDefault();
    setAuthError("");
    setBusy(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data?.session) {
          setSession(data.session);
          setPinMode("setup");
        } else {
          setAuthError("Перевірте вашу пошту для підтвердження або увійдіть!");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setSession(data.session);
        const savedPin = localStorage.getItem("mri_doctor_pin");
        if (!savedPin) setPinMode("setup");
        else setPinMode("locked");
      }
    } catch (err) {
      setAuthError(err.message || "Помилка авторизації");
    } finally {
      setBusy(false);
    }
  };

  const handlePinDigit = (digit) => {
    if (pinInput.length >= 4) return;
    const next = pinInput + digit;
    setPinInput(next);
    setPinError("");

    if (next.length === 4) {
      if (pinMode === "setup") {
        if (!pinSetupFirst) {
          setPinSetupFirst(next);
          setPinInput("");
        } else {
          if (next === pinSetupFirst) {
            localStorage.setItem("mri_doctor_pin", next);
            setPinMode("unlocked");
            setIsLocked(false);
          } else {
            setPinError("PIN-коди не співпадають. Спробуйте знову.");
            setPinSetupFirst("");
            setPinInput("");
          }
        }
      } else if (pinMode === "locked") {
        const savedPin = localStorage.getItem("mri_doctor_pin");
        if (next === savedPin) {
          setPinMode("unlocked");
          setIsLocked(false);
        } else {
          setPinError("Невірний PIN-код");
          setTimeout(() => setPinInput(""), 400);
        }
      }
    }
  };

  const handlePinDelete = () => {
    setPinInput(p => p.slice(0, -1));
    setPinError("");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("mri_doctor_pin");
    setSession(null);
    setPinMode("auth");
    setIsLocked(true);
    setPinInput("");
    setPinSetupFirst("");
  };

  if (loading || !isLocked) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(10, 12, 16, 0.96)",
      backdropFilter: "blur(12px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: 16
    }}>
      <div style={{
        width: "100%",
        maxWidth: 380,
        background: "#13161c",
        border: "1px solid rgba(255,255,255,.1)",
        borderRadius: 16,
        padding: 24,
        boxShadow: "0 25px 50px -12px rgba(0,0,0,.8)",
        textAlign: "center"
      }}>
        {/* Header Icon */}
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          background: "rgba(74,163,223,.12)",
          color: "#4aa3df",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px"
        }}>
          {pinMode === "auth" ? <Mail size={24} /> : <Lock size={24} />}
        </div>

        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>
          {pinMode === "auth" ? (isSignUp ? "Реєстрація лікаря" : "Авторизація лікаря") :
           pinMode === "setup" ? (pinSetupFirst ? "Повторіть 4-значний PIN" : "Встановіть PIN-код для входу") :
           "Швидкий вхід лікаря"}
        </h3>
        <p style={{ fontSize: 12, color: "#8b919c", marginBottom: 20 }}>
          {pinMode === "auth" ? "Введіть обліковий запис для захисту медичних даних" :
           pinMode === "setup" ? "Цей PIN-код використовуватиметься для щоденного розблокування" :
           `Введіть 4-значний PIN (${session?.user?.email || "Робоче місце"})`}
        </p>

        {/* 1. EMAIL AUTH VIEW */}
        {pinMode === "auth" && (
          <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="email"
              placeholder="Email лікаря"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={P.inp}
            />
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={P.inp}
            />

            {authError && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#ef4444", fontSize: 12, textAlign: "left" }}>
                <AlertCircle size={14} />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{ ...P.pri, marginTop: 4, height: 42, fontSize: 14 }}
            >
              {busy ? "Зачекайте..." : (isSignUp ? "Зареєструватися" : "Увійти в робоче місце")}
            </button>

            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setAuthError(""); }}
              style={{ background: "none", border: "none", color: "#4aa3df", fontSize: 12, cursor: "pointer", marginTop: 6 }}
            >
              {isSignUp ? "Вже є аккаунт? Увійти" : "Створити новий аккаунт лікаря"}
            </button>
          </form>
        )}

        {/* 2. PIN CODE VIEW (SETUP OR UNLOCK) */}
        {(pinMode === "locked" || pinMode === "setup") && (
          <div>
            {/* PIN Dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 14, margin: "16px 0 24px" }}>
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: pinInput.length > i ? "#4aa3df" : "rgba(255,255,255,.15)",
                    boxShadow: pinInput.length > i ? "0 0 10px rgba(74,163,223,.6)" : "none",
                    transition: "all .15s ease"
                  }}
                />
              ))}
            </div>

            {pinError && (
              <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 14, fontWeight: 500 }}>
                {pinError}
              </p>
            )}

            {/* Keypad */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              maxWidth: 260,
              margin: "0 auto"
            }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePinDigit(String(num))}
                  style={{
                    height: 52,
                    borderRadius: 12,
                    background: "rgba(255,255,255,.05)",
                    border: "1px solid rgba(255,255,255,.08)",
                    color: "#f1f5f9",
                    fontSize: 20,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    userSelect: "none"
                  }}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleLogout}
                title="Вийти з аккаунта"
                style={{
                  height: 52,
                  borderRadius: 12,
                  background: "transparent",
                  border: "none",
                  color: "#ef4444",
                  fontSize: 11,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <LogOut size={16} />
              </button>
              <button
                type="button"
                onClick={() => handlePinDigit("0")}
                style={{
                  height: 52,
                  borderRadius: 12,
                  background: "rgba(255,255,255,.05)",
                  border: "1px solid rgba(255,255,255,.08)",
                  color: "#f1f5f9",
                  fontSize: 20,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  userSelect: "none"
                }}
              >
                0
              </button>
              <button
                type="button"
                onClick={handlePinDelete}
                style={{
                  height: 52,
                  borderRadius: 12,
                  background: "transparent",
                  border: "none",
                  color: "#8b919c",
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                ⌫
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
