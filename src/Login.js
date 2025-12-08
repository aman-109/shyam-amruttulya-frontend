import React, { useState } from "react";
import { api } from "./api";
import "./Login.css";

export default function Login() {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      setError("");

      const res = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ phone, pin: finalPin })
      });

      localStorage.setItem("token", res.token);
      window.location.href = "/";
    } catch (err) {
      setError(err.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">

        {/* STEP 1 → ENTER PHONE */}
        {step === 1 && (
          <>
          <h1 className="text-3xl font-bold text-blue-600">Tailwind Works!</h1>
            <h2>Login</h2>
            <p className="subtitle">Enter your mobile number</p>

            <input
              className="phone-input"
              type="tel"
              maxLength="10"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile Number"
            />

            {error && <p className="error">{error}</p>}

            <button onClick={handlePhoneSubmit} className="next-btn">
              Next →
            </button>
          </>
        )}

        {/* STEP 2 → ENTER PIN */}
        {step === 2 && (
          <>
            <h2>Enter PIN</h2>
            <p className="subtitle">Enter your 4-digit PIN</p>

            <div className="otp-boxes">
              {pin.map((digit, index) => (
                <input
                  key={index}
                  id={`pin-${index}`}
                  type="password"
                  className="otp-input"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handlePinChange(index, e.target.value)}
                />
              ))}
            </div>

            {error && <p className="error">{error}</p>}

            <button onClick={handleLogin} className="next-btn" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>

            <button
              className="back-btn"
              onClick={() => {
                setStep(1);
                setPin(["", "", "", ""]);
              }}
            >
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
