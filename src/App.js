import React, { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import { api } from "./api";

// Warm Café Tailwind App.js
// - Bottom glass navbar
// - Floating +1 / -1 bubble animation
// - Dark mode toggle (persisted)
// - Keeps same backend interactions as before (optimistic updates)

// redirect to login if not logged in
function requireAuth() {
  const token = localStorage.getItem("token");
  if (!token) window.location.href = "/login";
}

function currency(n) {
  return `₹${n}`;
}

const DEFAULT_CATEGORIES = [
  { id: 1, name: "Tea", price: 10, count: 0 },
  { id: 2, name: "Coffee", price: 20, count: 0 },
  { id: 3, name: "Black Coffee", price: 15, count: 0 },
  { id: 4, name: "Cigarette (₹10)", price: 10, count: 0 },
  { id: 5, name: "Cigarette (₹12)", price: 12, count: 0 },
  { id: 6, name: "Cigarette (₹17)", price: 17, count: 0 },
  { id: 7, name: "Cigarette (₹20)", price: 20, count: 0 },
  { id: 8, name: "Biscuits", price: 5, count: 0 },
  { id: 9, name: "Sweet", price: 5, count: 0 },
  { id: 10, name: "Water Bottle (Small)", price: 10, count: 0 },
  { id: 11, name: "Water Bottle (Large)", price: 20, count: 0 },
  { id: 12, name: "Doughnut", price: 10, count: 0 },
  { id: 13, name: "Cigarette (₹15)", price: 15, count: 0 },
  { id: 14, name: "Tea (Bank)", price: 8, count: 0 },
];

export default function App() {
  requireAuth();

  const [tab, setTab] = useState("dashboard");
  const [today, setToday] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(() => {
    const v = localStorage.getItem("ui_dark_mode");
    return v === "1";
  });

  // keep timeouts refs so we can clear
  const bubbleTimers = useRef({});

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("ui_dark_mode", dark ? "1" : "0");
  }, [dark]);

  // initial load
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const res = await api("/data");

      let apiToday = res.today;
      if (
        !apiToday ||
        !Array.isArray(apiToday.categories) ||
        apiToday.categories.length === 0
      ) {
        apiToday = {
          date: dayjs().format("YYYY-MM-DD"),
          categories: DEFAULT_CATEGORIES,
        };
      }

      const reportForToday = res.reports
        ? res.reports.find((r) => r.date === apiToday.date)
        : null;

      let mergedToday = apiToday;
      if (reportForToday) {
        mergedToday = {
          ...apiToday,
          categories: apiToday.categories.map((cat) => {
            const rep = reportForToday.items.find(
              (i) => Number(i.id) === Number(cat.id)
            );
            return rep ? { ...cat, count: rep.count } : cat;
          }),
        };
      }

      if (!mounted) return;
      setToday(mergedToday);
      setReports(res.reports || []);
      setLoading(false);
    }
    load();
    return () => (mounted = false);
  }, []);

  if (loading || !today) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(0deg,#fff6ed,#fffdf9)] dark:bg-gradient-to-b dark:from-[#2b1e19] dark:to-[#1b1310]">
        <div className="text-center">
          <div className="animate-pulse text-2xl font-semibold text-amber-800 dark:text-amber-300">
            Loading Tea-Shop...
          </div>
        </div>
      </div>
    );
  }

  const categories = today.categories;

  // reload canonical data
  const reloadAll = async () => {
    const res = await api("/data");
    let apiToday = res.today;
    if (
      !apiToday ||
      !Array.isArray(apiToday.categories) ||
      apiToday.categories.length === 0
    ) {
      apiToday = {
        date: dayjs().format("YYYY-MM-DD"),
        categories: DEFAULT_CATEGORIES,
      };
    }
    const reportForToday = res.reports
      ? res.reports.find((r) => r.date === apiToday.date)
      : null;
    let mergedToday = apiToday;
    if (reportForToday) {
      mergedToday = {
        ...apiToday,
        categories: apiToday.categories.map((cat) => {
          const rep = reportForToday.items.find(
            (i) => Number(i.id) === Number(cat.id)
          );
          return rep ? { ...cat, count: rep.count } : cat;
        }),
      };
    }
    setToday(mergedToday);
    setReports(res.reports || []);
  };

  // Optimistic + single-update save
  const handleCountChange = (id, delta) => {
    // compute new categories immediately
    const newCats = today.categories.map((c) =>
      c.id === id
        ? {
            ...c,
            count: Math.max(0, Number(c.count || 0) + delta),
            bubble: delta,
          }
        : c
    );

    // set UI
    setToday((prev) => ({ ...prev, categories: newCats }));

    // clear previous timer for this id
    if (bubbleTimers.current[id]) {
      clearTimeout(bubbleTimers.current[id]);
    }

    // hide bubble after 500ms
    bubbleTimers.current[id] = setTimeout(() => {
      setToday((prev) => ({
        ...prev,
        categories: prev.categories.map((c) =>
          c.id === id ? { ...c, bubble: null } : c
        ),
      }));
      bubbleTimers.current[id] = null;
    }, 500);

    // prepare payload exactly (send full categories array as backend expects)
    const payloadCats = newCats.map((c) => ({
      id: c.id,
      name: c.name,
      price: c.price,
      count: Number(c.count || 0),
    }));

    // call backend but don't await; still update reports when response returns
    api("/today", {
      method: "POST",
      body: JSON.stringify({
        today: { date: today.date, categories: payloadCats },
      }),
    })
      .then((res) => {
        if (res && res.reports) setReports(res.reports);
        // do NOT overwrite local today — keep optimistic UI
      })
      .catch((err) => {
        console.error("/today save failed", err);
      });
  };

  const resetCategory = async (id) => {
    const optimisticCats = categories.map((c) =>
      c.id === id ? { ...c, count: 0 } : c
    );
    setToday({ date: today.date, categories: optimisticCats });
    await api("/today", {
      method: "POST",
      body: JSON.stringify({
        today: { date: today.date, categories: optimisticCats },
      }),
    });
    await reloadAll();
  };

  const resetAll = async () => {
    const optimisticCats = categories.map((c) => ({ ...c, count: 0 }));
    setToday({ date: today.date, categories: optimisticCats });
    await api("/today", {
      method: "POST",
      body: JSON.stringify({
        today: { date: today.date, categories: optimisticCats },
      }),
    });
    await reloadAll();
  };

  // derived
  const dailyItems = categories.map((c) => ({
    ...c,
    amount: c.price * c.count,
  }));
  const dailyTotalQty = dailyItems.reduce((s, c) => s + c.count, 0);
  const dailyTotalAmount = dailyItems.reduce((s, c) => s + c.amount, 0);

  const closeDay = async () => {
    const res = await api("/close", { method: "POST" });
    if (res) {
      setToday(res.today);
      setReports(res.reports || []);
      alert("Day closed and saved.");
      setTab("monthly");
    }
  };

  const deleteReport = async (id) => {
    if (!window.confirm("Delete this report?")) return;
    await api(`/reports/${id}`, { method: "DELETE" });
    setReports((prev) => prev.filter((r) => r._id !== id));
  };

  // Exports (same as before)
  const exportReportPDF = (report) => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Tea Shop - Daily Report", 14, 18);
    doc.setFontSize(11);
    doc.text(`Date: ${report.date}`, 14, 26);
    doc.text(
      `Total Qty: ${report.totalQty}   Total Amount: ₹${report.totalAmount}`,
      14,
      33
    );
    autoTable(doc, {
      startY: 42,
      head: [["Item", "Qty", "Price", "Amount"]],
      body: report.items.map((i) => [i.name, i.count, i.price, i.amount]),
    });
    doc.save(`report-${report.date}.pdf`);
  };

  const exportReportsCSV = () => {
    const rows = [
      ["Date", "Item", "Qty", "Price", "Amount", "Total Qty", "Total Amount"],
    ];
    reports.forEach((r) => {
      if (!r.items.length)
        rows.push([r.date, "—", 0, 0, 0, r.totalQty, r.totalAmount]);
      else
        r.items.forEach((it, idx) => {
          const row = [r.date, it.name, it.count, it.price, it.amount];
          if (idx === 0) row.push(r.totalQty, r.totalAmount);
          else row.push("", "");
          rows.push(row);
        });
    });
    saveAs(
      new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" }),
      `reports-${dayjs().format("YYYYMMDD")}.csv`
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[linear-gradient(180deg,#fff7ee,#fff9f5)] dark:bg-gradient-to-b dark:from-[#261812] dark:to-[#120908] transition-colors">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 shadow-sm backdrop-blur-sm bg-white/60 dark:bg-[#2a1a14]/60">
        <div className="flex items-center gap-3">
          <img
            src="/logo196.jpg"
            alt="logo"
            className="w-16 h-16 rounded-full shadow-md"
          />
          <div>
            <div className="text-lg font-semibold text-amber-900 dark:text-amber-200">
              Shyam's Tea Shop
            </div>
            <div className="text-xs text-neutral-600 dark:text-neutral-300">
              Point of Sale • Warm Café
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-200">
            <input type="checkbox" className="hidden" checked={dark} onChange={(e) => setDark(e.target.checked)} />
            <div
              onClick={() => setDark((v) => !v)}
              className="relative w-12 h-6 rounded-full bg-amber-200/80 dark:bg-amber-800/30 p-0.5 cursor-pointer"
              role="switch"
              aria-checked={dark}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transform transition ${dark ? "translate-x-6" : "translate-x-0"}`} />
            </div>
            <span className="select-none">{dark ? "Dark" : "Light"}</span>
          </label> */}
          <button
            onClick={() => {
              document.documentElement.classList.toggle("dark");
            }}
            className="px-3 py-1 bg-cafe-primary text-white rounded-full shadow 
             dark:bg-cafe-gold dark:text-black"
          >
            🌙
          </button>

          <button
            className="px-3 py-2 rounded-md bg-amber-700 text-white text-sm shadow hover:brightness-95"
            onClick={reloadAll}
          >
            Sync
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 p-4 pb-32 md:p-6 lg:p-8">
        {tab === "dashboard" && (
          <section>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3 lg:grid-cols-4">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="relative bg-white/80 dark:bg-[#3a2218]/70 rounded-2xl p-4 shadow-md border border-amber-50 dark:border-amber-900/20"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-amber-900 dark:text-amber-100">
                        {c.name}
                      </h3>
                      <div className="text-sm text-neutral-600 dark:text-neutral-300">
                        {currency(c.price)}
                      </div>
                    </div>
                    <button
                      onClick={() => resetCategory(c.id)}
                      className="text-xs px-2 py-1 rounded bg-amber-100/60 dark:bg-transparent border border-amber-100 text-amber-800 dark:text-amber-200"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        aria-label="decrement"
                        onClick={() => handleCountChange(c.id, -1)}
                        className="w-10 h-10 rounded-lg bg-amber-100/60 flex items-center justify-center font-bold text-xl"
                      >
                        -
                      </button>
                      <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                        {c.count}
                      </div>
                      <button
                        aria-label="increment"
                        onClick={() => handleCountChange(c.id, +1)}
                        className="w-10 h-10 rounded-lg bg-amber-700 text-white flex items-center justify-center font-bold text-xl shadow"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-lg font-semibold text-amber-800 dark:text-amber-200">
                      {currency(c.count * c.price)}
                    </div>
                  </div>

                  {/* floating bubble */}
                  {c.bubble ? (
                    <div
                      className={`absolute right-4 -top-3 text-sm font-semibold ${
                        c.bubble > 0 ? "text-green-600" : "text-red-500"
                      } animate-fade-up`}
                    >
                      {c.bubble > 0 ? `+${c.bubble}` : c.bubble}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-xl bg-white/60 dark:bg-[#261610]/60 border border-amber-50 dark:border-amber-900/20 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="text-sm text-neutral-700 dark:text-neutral-300">
                  Daily Summary
                </div>
                <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                  Qty: {dailyTotalQty} — {currency(dailyTotalAmount)}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={closeDay}
                  disabled={dailyTotalQty === 0}
                  className="px-4 py-2 rounded-lg bg-amber-700 text-white shadow disabled:opacity-50"
                >
                  Close Day & Save
                </button>
                <button
                  onClick={resetAll}
                  className="px-4 py-2 rounded-lg border border-amber-200 dark:border-amber-800"
                >
                  Reset All
                </button>
              </div>
            </div>
          </section>
        )}

        {tab === "daily" && (
          <section>
            <h2 className="text-xl font-semibold text-amber-900 dark:text-amber-100">
              Today's Live Report — {today.date}
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-amber-800 rounded-lg overflow-hidden">
                <thead className="bg-amber-100">
                  <tr>
                    <th className="p-3">Item</th>
                    <th className="p-3">Qty</th>
                    <th className="p-3">Price</th>
                    <th className="p-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyItems.map((it) => (
                    <tr
                      key={it.id}
                      className="border-b border-amber-50 dark:bg-[#3a2218]/70 dark:text-amber-100 dark:border-amber-800/30"
                    >
                      <td className="p-3">{it.name}</td>
                      <td className="p-3">{it.count}</td>
                      <td className="p-3">{currency(it.price)}</td>
                      <td className="p-3">{currency(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="dark:text-amber-200">
                  <tr>
                    <td className="p-3 font-semibold">Total</td>
                    <td className="p-3 font-semibold">{dailyTotalQty}</td>
                    <td className="p-3"></td>
                    <td className="p-3 font-semibold">
                      {currency(dailyTotalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <div className="mt-4">
                <button
                  disabled={dailyTotalQty === 0}
                  onClick={() =>
                    exportReportPDF({
                      date: today.date,
                      items: dailyItems.filter((i) => i.count > 0),
                      totalQty: dailyTotalQty,
                      totalAmount: dailyTotalAmount,
                    })
                  }
                  className="px-4 py-2 rounded bg-amber-700 text-white"
                >
                  Download Today's PDF
                </button>
              </div>
            </div>
          </section>
        )}

        {tab === "monthly" && (
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-amber-900 dark:text-amber-100">
                Monthly Reports
              </h2>
              <div>
                <button
                  onClick={exportReportsCSV}
                  className="px-3 py-2 rounded bg-amber-700 text-white"
                >
                  Download CSV
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto text-amber-800">
              <table className="w-full text-left ">
                <thead className="bg-amber-100">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Total Qty</th>
                    <th className="p-3">Total Amount</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr
                      key={r._id}
                      className="border-b border-amber-50 dark:bg-[#3a2218]/70 dark:text-amber-100 dark:border-amber-800/30"
                    >
                      <td className="p-3">{r.date}</td>
                      <td className="p-3">{r.totalQty}</td>
                      <td className="p-3">{currency(r.totalAmount)}</td>
                      <td className="p-3">
                        <button
                          onClick={() => exportReportPDF(r)}
                          className="px-2 py-1 mr-2 rounded bg-amber-700 text-white"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            className="w-6 h-6"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5m-5 5V4"
                            />
                          </svg>
                        </button>
                        {/* <button
                          onClick={() => deleteReport(r._id)}
                          className="px-2 py-1 rounded border border-amber-200"
                        >
                          Delete
                        </button> */}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {reports.map(
                (r) =>
                  r.items.length > 0 && (
                    <details
                      key={`d-${r._id}`}
                      className="mt-4 p-3 bg-white/60  dark:bg-[#3a2218]/70 dark:text-amber-100 rounded-lg border border-amber-50 dark:border-amber-900/20"
                    >
                      <summary className="font-semibold">
                        Details — {r.date}
                      </summary>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="text-neutral-700 dark:text-neutral-300">
                              <th className="p-2">Item</th>
                              <th className="p-2">Qty</th>
                              <th className="p-2">Price</th>
                              <th className="p-2">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.items.map((it) => (
                              <tr
                                key={it.name}
                                className="border-t border-amber-50 dark:border-amber-800/20"
                              >
                                <td className="p-2">{it.name}</td>
                                <td className="p-2">{it.count}</td>
                                <td className="p-2">{currency(it.price)}</td>
                                <td className="p-2">{currency(it.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )
              )}
            </div>
          </section>
        )}
      </main>

      {/* Bottom glass navbar */}
      <nav className="fixed bottom-4 left-1/2 transform -translate-x-1/2 w-[calc(100%-48px)] max-w-3xl rounded-xl backdrop-blur-sm bg-white/60 dark:bg-[#1b120f]/60 border border-amber-100 dark:border-amber-900/30 p-2 flex justify-between shadow-lg">
        <button
          onClick={() => {
            setTab("dashboard");
            reloadAll();
          }}
          className={`flex-1 py-3 rounded-lg ${
            tab === "dashboard"
              ? "bg-amber-700 text-white"
              : "bg-transparent text-amber-800 dark:text-amber-200"
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setTab("daily")}
          className={`flex-1 mx-2 py-3 rounded-lg ${
            tab === "daily"
              ? "bg-amber-700 text-white"
              : "bg-transparent text-amber-800 dark:text-amber-200"
          }`}
        >
          Live
        </button>
        <button
          onClick={() => setTab("monthly")}
          className={`flex-1 py-3 rounded-lg ${
            tab === "monthly"
              ? "bg-amber-700 text-white"
              : "bg-transparent text-amber-800 dark:text-amber-200"
          }`}
        >
          Monthly
        </button>
      </nav>

      {/* small styles for animation (Tailwind plugin not required) */}
      <style>{`
        @keyframes fadeUp {0% { opacity: 0; transform: translateY(6px);} 20% { opacity: 1; transform: translateY(0);} 100% { opacity: 0; transform: translateY(-18px);} }
        .animate-fade-up { animation: fadeUp 700ms ease forwards; }
      `}</style>
    </div>
  );
}
