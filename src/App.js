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

export default function App() {
  requireAuth();

  const [tab, setTab] = useState("dashboard");
  const [today, setToday] = useState(null); // { date, categories[] }
  const [reports, setReports] = useState([]); // list from backend
  const [loading, setLoading] = useState(true);

  // FETCH INITIAL DATA and MERGE today's report into today.categories
  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await api("/data");

      const apiToday = res.today;
      const reportForToday = res.reports.find((r) => r.date === apiToday.date);

      let mergedToday = apiToday;
      if (reportForToday) {
        mergedToday = {
          ...apiToday,
          categories: apiToday.categories.map((cat) => {
            const repItem = reportForToday.items.find(
              (i) => Number(i.id) === Number(cat.id)
            );
            return repItem ? { ...cat, count: repItem.count } : cat;
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

  // helper to reload fresh canonical data
  const reloadAll = async () => {
    const res = await api("/data");
    const apiToday = res.today;
    const reportForToday = res.reports.find((r) => r.date === apiToday.date);

    let mergedToday = apiToday;
    if (reportForToday) {
      mergedToday = {
        ...apiToday,
        categories: apiToday.categories.map((cat) => {
          const repItem = reportForToday.items.find(
            (i) => Number(i.id) === Number(cat.id)
          );
          return repItem ? { ...cat, count: repItem.count } : cat;
        }),
      };
    }

    setToday(mergedToday);
    setReports(res.reports);
  };

  // UPDATE COUNT (send new today and then reload)
  const updateCount = async (id, delta) => {
    const newCats = categories.map((c) =>
      c.id === id ? { ...c, count: Math.max(0, c.count + delta) } : c
    );
    const newToday = { date: today.date, categories: newCats };

    await api("/today", {
      method: "POST",
      body: JSON.stringify({ today: newToday }),
    });

    // reload canonical state
    await reloadAll();
  };

  const resetCategory = async (id) => {
    const newCats = categories.map((c) =>
      c.id === id ? { ...c, count: 0 } : c
    );
    const newToday = { date: today.date, categories: newCats };

    await api("/today", {
      method: "POST",
      body: JSON.stringify({ today: newToday }),
    });
    await reloadAll();
  };

  const resetAll = async () => {
    const newCats = categories.map((c) => ({ ...c, count: 0 }));
    const newToday = { date: today.date, categories: newCats };

    await api("/today", {
      method: "POST",
      body: JSON.stringify({ today: newToday }),
    });
    await reloadAll();
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
    // /close returns canonical today & reports
    setToday(res.today);
    setReports(res.reports);
    alert("Day closed and saved.");
    setTab("monthly");
  };

  const deleteReport = async (id) => {
    if (!window.confirm("Delete this report?")) return;
    await api(`/reports/${id}`, { method: "DELETE" });
    setReports(reports.filter((r) => r._id !== id));
  };

  // PDF & CSV exports
  const exportReportPDF = (report) => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Tea Shop - Daily Report", 14, 18);
    doc.setFontSize(11);
    doc.text(`Date: ${report.date}`, 14, 26);
    doc.text(
      `Total Qty: ${report.totalQty}    Total Amount: ₹${report.totalAmount}`,
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

  return (
    <div className="app">
      <header className="topbar">
        
          <img
            style={{ cursor: "pointer", paddingLeft: "10px" }}
            src={'/logo196.png'}
            alt="Logo"
            height={80}
            width={100}
            className="logo"
            onClick={async () => {
              setTab("dashboard");
              await reloadAll();
            }}
          />
        
        <nav style={{ display: "flex", float:'right'}}>
          <button
            className={tab === "dashboard" ? "active" : ""}
            onClick={async () => {
              setTab("dashboard");
              await reloadAll();
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

      <main className="container">
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

                  <div className="counter">
                    <button
                      className="btn"
                      onClick={() => updateCount(c.id, -1)}
                    >
                      -
                    </button>
                    <div className="count">{c.count}</div>
                    <button
                      className="btn"
                      onClick={() => updateCount(c.id, 1)}
                    >
                      +
                    </button>
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
                  onClick={closeDay}
                  disabled={dailyTotalQty === 0}
                >
                  Close Day & Save
                </button>
                <button onClick={resetAll}>Reset All</button>
              </div>
            </section>
          </>
        )}

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
              Download Today’s PDF
            </button>
          </section>
        )}

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
                      <button onClick={() => exportReportPDF(r)}>PDF</button>
                      <span>{" "}</span>
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
