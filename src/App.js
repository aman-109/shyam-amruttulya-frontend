// src/App.js
import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import { api } from "./api";
import "./App.css";

// redirect to login if not logged in
function requireAuth() {
  const token = localStorage.getItem("token");
  if (!token) window.location.href = "/login";
}

function currency(n) {
  return `₹${n}`;
}

// ------------------------------
// DEFAULT CATEGORIES (fallback)
// ------------------------------
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

  // ------------------------------
  // FETCH INITIAL DATA
  // ------------------------------
  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await api("/data");

      let apiToday = res.today;

      // FRESH USER / BROKEN TODAY → USE DEFAULT
      if (
        !apiToday ||
        !apiToday.categories ||
        !Array.isArray(apiToday.categories) ||
        apiToday.categories.length === 0
      ) {
        apiToday = {
          date: dayjs().format("YYYY-MM-DD"),
          categories: DEFAULT_CATEGORIES,
        };
      }

      // MERGE WITH TODAY'S REPORT (if exists)
      const reportForToday = res.reports.find((r) => r.date === apiToday.date);

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
      setReports(res.reports);
      setLoading(false);
    }

    load();
  }, []);

  if (loading || !today) return <p>Loading...</p>;

  const categories = today.categories;

  // Reload helper
  const reloadAll = async () => {
    const res = await api("/data");

    let apiToday = res.today;

    if (
      !apiToday ||
      !apiToday.categories ||
      !Array.isArray(apiToday.categories) ||
      apiToday.categories.length === 0
    ) {
      apiToday = {
        date: dayjs().format("YYYY-MM-DD"),
        categories: DEFAULT_CATEGORIES,
      };
    }

    const reportForToday = res.reports.find((r) => r.date === apiToday.date);

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
    setReports(res.reports);
  };

 // call this from + / - buttons
const handleCountChange = (id, delta) => {
  // compute new categories array locally (no reliance on stale `today`)
  const newCats = today.categories.map((c) =>
    c.id === id ? { ...c, count: Math.max(0, c.count + delta), bubble: delta } : c
  );

  // update UI immediately (optimistic)
  setToday((prev) => ({ ...prev, categories: newCats }));

  // remove bubble after 700ms
  setTimeout(() => {
    setToday((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === id ? { ...c, bubble: null } : c
      ),
    }));
  }, 200);

  // async persist to backend (send the full updated categories array we computed)
  updateCountSave(newCats, today.date).catch((err) => {
    console.error("save /today failed:", err);
    // optional: rollback UI or show toast. For now we keep optimistic UI.
  });
};

// send server the full categories array (no local state changes here)
const updateCountSave = async (updatedCategories, date) => {
  // prepare payload exactly as backend expects
  const payload = {
    today: {
      date: date || dayjs().format("YYYY-MM-DD"),
      categories: updatedCategories.map((c) => ({
        id: c.id,
        name: c.name,
        price: c.price,
        count: Number(c.count || 0),
      })),
    },
  };

  const res = await api("/today", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  // backend returns updated reports (and possibly updated today). Update reports from server
  if (res && res.reports) {
    setReports(res.reports);
  }
  // If backend returns canonical today and you want to reconcile:
  // if (res && res.today) setToday(res.today);
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

    reloadAll();
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

    reloadAll();
  };

  // DAILY SUMMARY
  const dailyItems = categories.map((c) => ({
    ...c,
    amount: c.price * c.count,
  }));
  const dailyTotalQty = dailyItems.reduce((s, c) => s + c.count, 0);
  const dailyTotalAmount = dailyItems.reduce((s, c) => s + c.amount, 0);

  // CLOSE DAY
  const closeDay = async () => {
    const res = await api("/close", { method: "POST" });
    setToday(res.today);
    setReports(res.reports);
    alert("Day closed and saved.");
    setTab("monthly");
  };

  // DELETE REPORT
  const deleteReport = async (id) => {
    if (!window.confirm("Delete this report?")) return;
    await api(`/reports/${id}`, { method: "DELETE" });
    setReports(reports.filter((r) => r._id !== id));
  };

  // PDF & CSV EXPORTS
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
      if (!r.items.length) {
        rows.push([r.date, "—", 0, 0, 0, r.totalQty, r.totalAmount]);
      } else {
        r.items.forEach((it, idx) => {
          const row = [r.date, it.name, it.count, it.price, it.amount];
          if (idx === 0) row.push(r.totalQty, r.totalAmount);
          else row.push("", "");
          rows.push(row);
        });
      }
    });

    saveAs(
      new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" }),
      `reports-${dayjs().format("YYYYMMDD")}.csv`
    );
  };

  // ------------------------------
  // UI
  // ------------------------------
  return (
    <div className="app">
      <header className="topbar">
        <img
          style={{ cursor: "pointer", paddingLeft: "10px" }}
          src={"/logo196.jpg"}
          alt="Logo"
          height={80}
          width={100}
          onClick={() => {
            setTab("dashboard");
            reloadAll();
          }}
        />

        <nav style={{ display: "flex", float: "right" }}>
          <button
            className={tab === "dashboard" ? "active" : ""}
            onClick={() => {
              setTab("dashboard");
              reloadAll();
            }}
          >
            Dashboard
          </button>

          <button
            className={tab === "daily" ? "active" : ""}
            onClick={() => setTab("daily")}
          >
            Daily Report
          </button>

          <button
            className={tab === "monthly" ? "active" : ""}
            onClick={() => setTab("monthly")}
          >
            Monthly Report
          </button>
        </nav>
      </header>

      {/* MAIN CONTENT */}
      <main className="container">
        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <>
            <section className="grid">
              {categories.map((c) => (
                <div key={c.id} className="card">
                  <div className="card-header">
                    <div>
                      <h3>{c.name}</h3>
                      <div className="price">{currency(c.price)}</div>
                    </div>
                    <button
                      className="reset-small"
                      onClick={() => resetCategory(c.id)}
                    >
                      Reset
                    </button>
                  </div>

                  <div className="counter" style={{ position: "relative" }}>
                    <button
                      className="btn"
                      onClick={() => handleCountChange(c.id, -1)}
                    >
                      -
                    </button>

                    <div className="count">{c.count}</div>

                    <button
                      className="btn"
                      onClick={() => handleCountChange(c.id, +1)}
                    >
                      +
                    </button>

                    {/* Bubble animation */}
                    {c.bubble && (
                      <div
                        className="floating-bubble"
                        style={{
                          left: "50%",
                          top: "-10px",
                          color: c.bubble > 0 ? "green" : "red",
                        }}
                      >
                        {c.bubble > 0 ? `+${c.bubble}` : c.bubble}
                      </div>
                    )}
                  </div>

                  <div className="amount">{currency(c.count * c.price)}</div>
                </div>
              ))}
            </section>

            <section className="summary">
              <h3>Daily Summary</h3>
              <p>
                Quantity: <strong>{dailyTotalQty}</strong>
              </p>
              <p>
                Total Amount: <strong>{currency(dailyTotalAmount)}</strong>
              </p>

              <div className="actions">
                <button
                  className="primary"
                  disabled={dailyTotalQty === 0}
                  onClick={closeDay}
                >
                  Close Day & Save
                </button>
                <button onClick={resetAll}>Reset All</button>
              </div>
            </section>
          </>
        )}

        {/* DAILY LIVE REPORT */}
        {tab === "daily" && (
          <section className="report-view">
            <h2>Today's Live Report — {today.date}</h2>

            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {dailyItems.map((it) => (
                  <tr key={it.id}>
                    <td>{it.name}</td>
                    <td>{it.count}</td>
                    <td>{currency(it.price)}</td>
                    <td>{currency(it.amount)}</td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  <td>
                    <strong>Total</strong>
                  </td>
                  <td>
                    <strong>{dailyTotalQty}</strong>
                  </td>
                  <td></td>
                  <td>
                    <strong>{currency(dailyTotalAmount)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>

            <button
              className="primary"
              disabled={dailyTotalQty === 0}
              onClick={() =>
                exportReportPDF({
                  date: today.date,
                  items: dailyItems.filter((i) => i.count > 0),
                  totalQty: dailyTotalQty,
                  totalAmount: dailyTotalAmount,
                })
              }
            >
              Download Today's PDF
            </button>
          </section>
        )}

        {/* MONTHLY REPORT */}
        {tab === "monthly" && (
          <section className="monthly">
            <div className="monthly-top">
              <h2>Monthly Reports</h2>
              <div className="monthly-actions">
                <button
                  onClick={exportReportsCSV}
                  disabled={reports.length === 0}
                >
                  Download CSV
                </button>
              </div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Total Qty</th>
                  <th>Total Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {reports.map((r) => (
                  <tr key={r._id}>
                    <td>{r.date}</td>
                    <td>{r.totalQty}</td>
                    <td>{currency(r.totalAmount)}</td>
                    <td>
                      <button onClick={() => exportReportPDF(r)}>PDF</button>{" "}
                      <button
                        className="danger"
                        onClick={() => deleteReport(r._id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* DETAILS SECTION */}
            {reports.map((r) => (
              <details key={`d-${r._id}`} className="report-details">
                <summary>Details — {r.date}</summary>

                <table className="table small">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Amount</th>
                    </tr>
                  </thead>

                  <tbody>
                    {r.items.map((it) => (
                      <tr key={it.name}>
                        <td>{it.name}</td>
                        <td>{it.count}</td>
                        <td>{currency(it.price)}</td>
                        <td>{currency(it.amount)}</td>
                      </tr>
                    ))}

                    <tr>
                      <td>
                        <strong>Total</strong>
                      </td>
                      <td>
                        <strong>{r.totalQty}</strong>
                      </td>
                      <td></td>
                      <td>
                        <strong>{currency(r.totalAmount)}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </details>
            ))}
          </section>
        )}
      </main>

      <footer className="footer">
        <small>PWA Enabled • Cloud Sync via MongoDB</small>
      </footer>
    </div>
  );
}
