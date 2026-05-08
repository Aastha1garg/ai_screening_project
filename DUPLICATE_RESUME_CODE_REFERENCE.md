# Code Changes Reference - Duplicate Resume Fix

## 1. ComparePage.js

### Change 1: Added resumeOptions useMemo
**Location:** After line 74 (after `resumeOptions = useMemo...`)

```javascript
const resumeOptions = useMemo(() => {
  const byName = new Map();
  history.forEach((row) => {
    const existing = byName.get(row.resume_name);
    // Keep record with higher score, or if equal, keep the more recent (higher ID)
    if (!existing || row.final_score > existing.final_score || (row.final_score === existing.final_score && row.id > existing.id)) {
      byName.set(row.resume_name, row);
    }
  });
  return Array.from(byName.values());
}, [history]);
```

### Change 2: Updated resume list rendering
**Location:** Resume Selection section (around line 173)

**BEFORE:**
```javascript
<div className="compare-list">
  {history.map((row) => (
    <label key={row.id} className="compare-item">
      <input
        type="checkbox"
        checked={selectedResumes.includes(row.id)}
        onChange={() => toggleResume(row.id)}
      />
      <span>{row.resume_name}</span>
    </label>
  ))}
</div>
```

**AFTER:**
```javascript
<div className="compare-list">
  {resumeOptions.map((row) => (
    <label key={row.id} className="compare-item">
      <input
        type="checkbox"
        checked={selectedResumes.includes(row.id)}
        onChange={() => toggleResume(row.id)}
      />
      <span>{row.resume_name}</span>
    </label>
  ))}
</div>
```

---

## 2. ExplainPage.js

### Change 1: Added resumeOptions useMemo
**Location:** After useEffect (around line 18)

```javascript
const resumeOptions = useMemo(() => {
  const byName = new Map();
  history.forEach((item) => {
    const existing = byName.get(item.resume_name);
    // Keep record with higher score, or if equal, keep the more recent (higher ID)
    if (!existing || item.final_score > existing.final_score || (item.final_score === existing.final_score && item.id > existing.id)) {
      byName.set(item.resume_name, item);
    }
  });
  return Array.from(byName.values());
}, [history]);
```

### Change 2: Updated resume dropdown rendering
**Location:** Resume select dropdown (around line 65)

**BEFORE:**
```javascript
<select value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
  <option value="">Select Resume</option>
  {history.map((item) => (
    <option key={item.id} value={item.id}>
      {item.resume_name}
    </option>
  ))}
</select>
```

**AFTER:**
```javascript
<select value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
  <option value="">Select Resume</option>
  {resumeOptions.map((item) => (
    <option key={item.id} value={item.id}>
      {item.resume_name}
    </option>
  ))}
</select>
```

---

## 3. ImproveResume.js

### Change 1: Added resumeOptions useMemo
**Location:** After useEffect (around line 18)

```javascript
const resumeOptions = useMemo(() => {
  const byName = new Map();
  history.forEach((item) => {
    const existing = byName.get(item.resume_name);
    // Keep record with higher score, or if equal, keep the more recent (higher ID)
    if (!existing || item.final_score > existing.final_score || (item.final_score === existing.final_score && item.id > existing.id)) {
      byName.set(item.resume_name, item);
    }
  });
  return Array.from(byName.values());
}, [history]);
```

### Change 2: Updated resume dropdown rendering
**Location:** Resume select dropdown (around line 53)

**BEFORE:**
```javascript
<select value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
  <option value="">Select Resume</option>
  {history.map((item) => (
    <option key={item.id} value={item.id}>
      {item.resume_name}
    </option>
  ))}
</select>
```

**AFTER:**
```javascript
<select value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
  <option value="">Select Resume</option>
  {resumeOptions.map((item) => (
    <option key={item.id} value={item.id}>
      {item.resume_name}
    </option>
  ))}
</select>
```

---

## Summary of Changes

| Component | Changes |
|-----------|---------|
| ComparePage.js | Added resumeOptions deduplication; Updated resume list render |
| ExplainPage.js | Added resumeOptions deduplication; Updated dropdown render |
| ImproveResume.js | Added resumeOptions deduplication; Updated dropdown render |

**Total files modified:** 3  
**Lines added:** ~12 per component (36 total)  
**Lines modified:** 1 per component (3 total)  
**Backward compatibility:** Full ✅
