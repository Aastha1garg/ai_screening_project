/** Format API education entries (string legacy or structured dict) for display. */
export function formatEducationList(edu) {
  if (!edu || !edu.length) return "N/A";
  const parts = edu
    .map((e) => {
      if (typeof e === "string") return e;
      if (e && typeof e === "object") {
        const s = e.summary;
        if (s) return s;
        return [e.degree, e.institution, e.year].filter(Boolean).join(", ");
      }
      return "";
    })
    .filter(Boolean);
  return parts.length ? parts.join("; ") : "N/A";
}
