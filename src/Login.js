import React, { useState, useEffect } from "react";
import { api } from "./api";

export default function Login() {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showLoader, setShowLoader] = useState(true); // branded loader

  useEffect(() => {
    setTimeout(() => setShowLoader(false), 1400); // show loading screen for 1.4s
  }, []);

  // ANIMATION RESET
  const [animateStep, setAnimateStep] = useState("fadeIn");
  useEffect(() => {
    setAnimateStep("fadeOut");
    setTimeout(() => setAnimateStep("fadeIn"), 140);
  }, [step]);

  const handlePhoneSubmit = () => {
    setError("");
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError("Enter valid 10-digit mobile number");
      return;
    }
    setStep(2);
  };

  const handlePinChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    if (value && index < 3) {
      document.getElementById(`pin-${index + 1}`).focus();
    }
  };

  const handleLogin = async () => {
    const finalPin = pin.join("");
    if (finalPin.length !== 4) {
      setError("Enter 4-digit PIN");
      return;
    }

    try {
      setLoading(true);
      const res = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ phone, pin: finalPin }),
      });

      localStorage.setItem("token", res.token);
      window.location.href = "/";
    } catch (err) {
      setError(err.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // 🟤 BRAND LOADING SCREEN (Floating Logo + Steam Animation)
  // ---------------------------------------------------------
  if (showLoader) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center 
      bg-[linear-gradient(180deg,#fff7ee,#fff9f5)] dark:bg-[#1a120f]"
      >
        <div className="relative">
          {/* Cup Logo */}
          <img
            src="/logo196.jpg"
            className="w-28 h-28 rounded-full shadow-xl animate-float"
          />
        </div>

        <p className="mt-6 text-lg font-semibold text-amber-800 dark:text-amber-200 animate-fadeInSlow">
          Brewing your dashboard...
        </p>

        <style>{`
          .animate-float {
            animation: float 3s ease-in-out infinite;
          }
          @keyframes float {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
            100% { transform: translateY(0px); }
          }
          .animate-fadeInSlow {
            animation: fadeInSlow 1.5s ease;
          }
          @keyframes fadeInSlow {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  // ---------------------------------------------------------
  // NORMAL LOGIN UI
  // ---------------------------------------------------------
  return (
    <div
      className="min-h-screen flex items-center justify-center 
      bg-[linear-gradient(180deg,#fff7ee,#fff9f5)] dark:bg-[#1a120f] px-4"
    >
      <div
        className={`
        w-full max-w-sm rounded-2xl p-6 shadow-xl backdrop-blur-md 
        bg-white/80 dark:bg-[#2c1a13]/60 
        border border-amber-100 dark:border-amber-900/20
        transition-all duration-500
        ${
          animateStep === "fadeIn"
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4"
        }
      `}
      >
        <div className="flex justify-center mb-4">
          <img
            src="/logo196.jpg"
            alt="Tea Logo"
            className="w-32 h-32  animate-float"
          />
        </div>

        <h2 className="text-center text-2xl font-bold text-amber-900 dark:text-amber-100 animate-fadeIn">
          Welcome Back ☕
        </h2>

        <p className="text-center text-sm text-neutral-600 dark:text-neutral-300 mb-6 animate-fadeIn">
          Login to continue
        </p>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="animate-slideUp">
            <label className="block mb-2 text-sm">Mobile Number</label>

            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength="10"
              className="w-full p-3 rounded-lg focus:outline-none focus:ring-0 focus:border-amber-500 border border-amber-200"
              placeholder="Enter mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            {error && (
              <p className="text-red-600 text-sm mt-2 animate-shake">{error}</p>
            )}

            <button
              onClick={handlePhoneSubmit}
              className="w-full mt-4 py-3 rounded-lg bg-amber-700 text-white"
            >
              Next →
            </button>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="animate-slideUp">
            <label className="block mb-3 text-sm text-center">
              Enter 4-digit PIN
            </label>

            <div className="flex justify-center gap-3 mb-4">
              {pin.map((digit, index) => (
                <input
                  key={index}
                  id={`pin-${index}`}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength="1"
                  className={`
                    w-12 h-12 text-xl text-center rounded-lg border 
                    border-amber-200 dark:border-amber-800
                    bg-white dark:bg-[#3a2218]
                    focus:ring-2 focus:ring-amber-600 outline-none
                    transition-all ${digit ? "scale-110" : "scale-100"}
                  `}
                  value={digit}
                  onChange={(e) => handlePinChange(index, e.target.value)}
                />
              ))}
            </div>

            {error && (
              <p className="text-red-600 text-sm text-center animate-shake">
                {error}
              </p>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 rounded-lg bg-amber-700 text-white"
            >
              {loading ? "Logging in..." : "Login"}
            </button>

            <button
              className="w-full mt-3 text-sm text-amber-800 dark:text-amber-200 underline"
              onClick={() => {
                setStep(1);
                setPin(["", "", "", ""]);
              }}
            >
              ← Back
            </button>
          </div>
        )}
      </div>

      {/* Animations */}
      <style>{`
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0px); }
        }

        .animate-slideUp { animation: slideUp 0.5s ease; }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-shake { animation: shake 0.35s ease-in-out; }
        @keyframes shake {
          0% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          50% { transform: translateX(4px); }
          75% { transform: translateX(-4px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
