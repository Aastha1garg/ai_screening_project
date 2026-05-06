import React from "react";
import { useTranslation } from "react-i18next";
import { formatDate } from "../utils/dateFormatter";
import { useLanguageSettings } from "../context/LanguageContext";

function HistoryPage({ history = [], shortlistedIds, onToggleShortlist }) {
  const { t } = useTranslation();
  const { languageSettings } = useLanguageSettings();
  return (
    <section className="card">
      <h3>{t("history.title")}</h3>
      <table className="table">
        <thead>
          <tr>
            <th>{t("history.resumeName")}</th>
            <th>{t("history.score")}</th>
            <th>{t("history.date")}</th>
            <th>{t("history.status")}</th>
            <th>{t("history.formatScore")}</th>
            <th>{t("history.shortlist")}</th>
          </tr>
        </thead>
        <tbody>
          {history.length ? (
            history.map((row) => (
              <tr key={row.id}>
                <td>{row.resume_name}</td>
                <td>{row.score}</td>
                <td>{formatDate(row.date, languageSettings)}</td>
                <td>
                  <span className={`status-pill ${row.status}`}>{row.status}</span>
                  {(shortlistedIds || []).includes(Number(row.id)) && (
                    <span className="shortlisted-badge">{t("history.shortlisted")}</span>
                  )}
                </td>
                <td>{row.format_score ?? 0}</td>
                <td>
                  <button
                    type="button"
                    className={(shortlistedIds || []).includes(Number(row.id)) ? "secondary-btn" : ""}
                    onClick={() =>
                      onToggleShortlist(
                        Number(row.id),
                        !(shortlistedIds || []).includes(Number(row.id))
                      )
                    }
                  >
                    {(shortlistedIds || []).includes(Number(row.id))
                      ? t("buttons.cancel")
                      : t("buttons.shortlist")}
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6">{t("history.noResults")}</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

export default HistoryPage;
