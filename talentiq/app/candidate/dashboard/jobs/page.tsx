"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import CareerInterestsCard from "@/components/modules/candidate/CareerInterestsCard";

const WORK_ARR = [
    { v: "", l: "Any" },
    { v: "remote", l: "Remote" },
    { v: "hybrid", l: "Hybrid" },
    { v: "onsite", l: "On-site" },
];
const EMP_TYPE = [
    { v: "", l: "Any" },
    { v: "full_time", l: "Full-time" },
    { v: "part_time", l: "Part-time" },
    { v: "contract", l: "Contract" },
    { v: "internship", l: "Internship" },
];
// experience_required on Job is HR's own free text -- these values are
// substring-matched against it server-side, not a real structured enum.
const EXPERIENCE = [
    { v: "", l: "Any" },
    { v: "Entry", l: "Entry-level" },
    { v: "Mid", l: "Mid-level" },
    { v: "Senior", l: "Senior" },
    { v: "Lead", l: "Lead" },
];
const POSTED_WITHIN = [
    { v: "", l: "Any time" },
    { v: "1", l: "Past 24 hours" },
    { v: "7", l: "Past week" },
    { v: "30", l: "Past month" },
];

type SortBy = "newest" | "best_match" | "most_relevant";
const SORT_OPTIONS: { v: SortBy; l: string }[] = [
    { v: "newest", l: "Newest" },
    { v: "best_match", l: "Best Match" },
    { v: "most_relevant", l: "Most Relevant" },
];

// Mirrors backend/core/application_status.py's derive_status() output --
// only real values the API returns, never a fabricated state.
const STATUS_META: Record<
    string,
    { label: string; color: string; bg: string }
> = {
    applied: { label: "Applied", color: "#e2b04a", bg: "rgba(226,176,74,.1)" },
    screening: {
        label: "Screening",
        color: "#7c9cf0",
        bg: "rgba(124,156,240,.1)",
    },
    interview: {
        label: "Interview",
        color: "#7c3aed",
        bg: "rgba(124,58,237,.12)",
    },
    rejected: { label: "Rejected", color: "#ef4444", bg: "rgba(239,68,68,.1)" },
    selected: { label: "Selected", color: "#13c28e", bg: "rgba(19,194,142,.1)" },
};

function StatusPill({ status }: { status?: string | null }) {
    if (!status)
        return (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#e2b04a" }}>
                View Job &rarr;
            </span>
        );
    const meta = STATUS_META[status] || STATUS_META.applied;
    return (
        <span
            style={{
                fontSize: 10.5,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: ".03em",
                padding: "4px 11px",
                borderRadius: 100,
                background: meta.bg,
                color: meta.color,
            }}
        >
            {meta.label}
        </span>
    );
}

function JobCard({
    job,
    matchPercent,
    reasons,
}: {
    job: any;
    matchPercent?: number;
    reasons?: string[];
}) {
    return (
        <Link
            href={`/candidate/dashboard/jobs/${job.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
        >
            <div
                style={{
                    background: "#111110",
                    border: "1px solid rgba(255,255,255,.07)",
                    borderRadius: 12,
                    padding: 18,
                    marginBottom: 10,
                    maxWidth: "100%",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "flex-start",
                    }}
                >
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
                            {job.title}
                        </div>
                        <div
                            style={{
                                fontSize: 12,
                                color: "rgba(255,255,255,.4)",
                                marginTop: 3,
                                wordBreak: "break-word",
                            }}
                        >
                            {[
                                job.company,
                                job.location,
                                job.work_arrangement,
                                job.employment_type?.replace("_", " "),
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                        </div>
                    </div>
                    {typeof matchPercent === "number" && (
                        <div style={{ textAlign: "center", flexShrink: 0 }}>
                            <div
                                style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color:
                                        matchPercent >= 70
                                            ? "#13c28e"
                                            : matchPercent >= 40
                                                ? "#e2b04a"
                                                : "rgba(255,255,255,.4)",
                                }}
                            >
                                {matchPercent}%
                            </div>
                            <div style={{ fontSize: 8.5, color: "rgba(255,255,255,.3)" }}>
                                Match
                            </div>
                        </div>
                    )}
                </div>
                {(job.salary_min || job.salary_max) && (
                    <div
                        style={{
                            fontSize: 12,
                            color: "#13c28e",
                            marginTop: 8,
                            fontWeight: 600,
                        }}
                    >
                        {job.salary_currency || ""} {job.salary_min ?? "?"} –{" "}
                        {job.salary_max ?? "?"}
                    </div>
                )}
                {reasons && reasons.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                        <div
                            style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: ".04em",
                                color: "rgba(255,255,255,.3)",
                                marginBottom: 4,
                            }}
                        >
                            Why this job?
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            {reasons.slice(0, 3).map((r, i) => (
                                <div key={i} style={{ fontSize: 11, color: "#13c28e" }}>
                                    ✓ {r}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 12,
                    }}
                >
                    <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.3)" }}>
                        {job.created_at
                            ? new Date(job.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                            })
                            : ""}
                    </div>
                    <StatusPill
                        status={
                            job.has_applied ? job.application_status || "applied" : null
                        }
                    />
                </div>
            </div>
        </Link>
    );
}

function FilterFields({
    location,
    setLocation,
    workArrangement,
    setWorkArrangement,
    employmentType,
    setEmploymentType,
    experienceLevel,
    setExperienceLevel,
    minSalary,
    setMinSalary,
    postedWithin,
    setPostedWithin,
}: any) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                    className="jobs-input"
                    style={{ flex: 1, minWidth: 120 }}
                    placeholder="Location"
                    value={location}
                    onChange={(e: any) => setLocation(e.target.value)}
                />
                <select
                    className="jobs-input"
                    value={workArrangement}
                    onChange={(e: any) => setWorkArrangement(e.target.value)}
                >
                    {WORK_ARR.map((o: any) => (
                        <option key={o.v} value={o.v}>
                            {o.l}
                        </option>
                    ))}
                </select>
                <select
                    className="jobs-input"
                    value={employmentType}
                    onChange={(e: any) => setEmploymentType(e.target.value)}
                >
                    {EMP_TYPE.map((o: any) => (
                        <option key={o.v} value={o.v}>
                            {o.l}
                        </option>
                    ))}
                </select>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select
                    className="jobs-input"
                    style={{ flex: 1, minWidth: 110 }}
                    value={experienceLevel}
                    onChange={(e: any) => setExperienceLevel(e.target.value)}
                >
                    {EXPERIENCE.map((o: any) => (
                        <option key={o.v} value={o.v}>
                            {o.l}
                        </option>
                    ))}
                </select>
                <select
                    className="jobs-input"
                    style={{ flex: 1, minWidth: 110 }}
                    value={postedWithin}
                    onChange={(e: any) => setPostedWithin(e.target.value)}
                >
                    {POSTED_WITHIN.map((o: any) => (
                        <option key={o.v} value={o.v}>
                            {o.l}
                        </option>
                    ))}
                </select>
                <input
                    className="jobs-input"
                    style={{ flex: 1, minWidth: 110 }}
                    type="number"
                    placeholder="Min salary"
                    value={minSalary}
                    onChange={(e: any) => setMinSalary(e.target.value)}
                />
            </div>
        </div>
    );
}

// Deterministic, purely client-side relevance score against the typed
// search query -- no invented signal, no backend call. Only meaningful
// once the candidate has actually typed something to be "relevant" to;
// with an empty query there's nothing to rank against, so it falls back
// to the backend's own (Newest) order.
function relevanceScore(job: any, query: string): number {
    const q = query.trim().toLowerCase();
    if (!q) return 0;
    let score = 0;
    if ((job.title || "").toLowerCase().includes(q)) score += 3;
    if ((job.company || "").toLowerCase().includes(q)) score += 2;
    const skills = [
        ...(job.required_skills || []),
        ...(job.preferred_skills || []),
    ]
        .join(" ")
        .toLowerCase();
    if (skills.includes(q)) score += 2;
    if ((job.description || "").toLowerCase().includes(q)) score += 1;
    return score;
}

export default function FindJobsPage() {
    const [q, setQ] = useState("");
    const [location, setLocation] = useState("");
    const [workArrangement, setWorkArrangement] = useState("");
    const [employmentType, setEmploymentType] = useState("");
    const [experienceLevel, setExperienceLevel] = useState("");
    const [minSalary, setMinSalary] = useState("");
    const [postedWithin, setPostedWithin] = useState("");
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [sortBy, setSortBy] = useState<SortBy>("newest");

    const [jobs, setJobs] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [recommended, setRecommended] = useState<any[] | null>(null);
    const [resumeAvailable, setResumeAvailable] = useState<boolean | null>(null);
    const [resumeText, setResumeText] = useState("");

    const [matchMap, setMatchMap] = useState<Record<
        string,
        { percent: number; reasons: string[] }
    > | null>(null);
    const [matchMapLoading, setMatchMapLoading] = useState(false);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    const search = useCallback(() => {
        setLoading(true);
        setError("");
        api
            .findJobs({
                q,
                location,
                work_arrangement: workArrangement,
                employment_type: employmentType,
                experience_level: experienceLevel || undefined,
                min_salary: minSalary ? Number(minSalary) : undefined,
                posted_within_days: postedWithin ? Number(postedWithin) : undefined,
                page: 1,
                page_size: 20,
            })
            .then((r: any) => {
                setJobs(r.jobs || []);
                setTotal(r.total || 0);
            })
            .catch((e: any) => setError(e.message || "Could not load jobs."))
            .finally(() => setLoading(false));
    }, [
        q,
        location,
        workArrangement,
        employmentType,
        experienceLevel,
        minSalary,
        postedWithin,
    ]);

    useEffect(() => {
        search();
    }, []);
    useEffect(() => {
        const t = setTimeout(search, 400);
        return () => clearTimeout(t);
    }, [
        q,
        location,
        workArrangement,
        employmentType,
        experienceLevel,
        minSalary,
        postedWithin,
    ]);

    useEffect(() => {
        api
            .getLatestResume()
            .then((r: any) => {
                setResumeAvailable(!!r.available);
                if (r.available && r.cv_text) {
                    setResumeText(r.cv_text);
                    api
                        .getRecommendedJobs(r.cv_text, 4)
                        .then((rec: any) => setRecommended(rec || []))
                        .catch(() => setRecommended([]));
                } else {
                    setRecommended([]);
                }
            })
            .catch(() => {
                setResumeAvailable(false);
                setRecommended([]);
            });
    }, []);

    // Best Match sorting reuses the EXISTING /jobs/recommended/for-me scorer
    // (the same deterministic, zero-LLM-call skill-overlap engine behind
    // "Recommended For You") -- just fetched wider and lazily, only once the
    // candidate actually picks this sort, so it never runs on every render.
    useEffect(() => {
        if (sortBy !== "best_match" || matchMap || !resumeText) return;
        setMatchMapLoading(true);
        api
            .getRecommendedJobs(resumeText, 50)
            .then((rec: any) => {
                const map: Record<string, { percent: number; reasons: string[] }> = {};
                (rec || []).forEach((r: any) => {
                    map[r.job.id] = { percent: r.match_percent, reasons: r.reasons };
                });
                setMatchMap(map);
            })
            .catch(() => setMatchMap({}))
            .finally(() => setMatchMapLoading(false));
    }, [sortBy, resumeText, matchMap]);

    const sortedJobs = useMemo(() => {
        if (sortBy === "best_match" && matchMap) {
            return [...jobs].sort(
                (a, b) =>
                    (matchMap[b.id]?.percent ?? -1) - (matchMap[a.id]?.percent ?? -1),
            );
        }
        if (sortBy === "most_relevant" && q.trim()) {
            return [...jobs].sort(
                (a, b) => relevanceScore(b, q) - relevanceScore(a, q),
            );
        }
        return jobs; // "Newest" -- exactly the order the backend already returns
    }, [jobs, sortBy, matchMap, q]);

    const activeFilterCount = [
        location,
        workArrangement,
        employmentType,
        experienceLevel,
        minSalary,
        postedWithin,
    ].filter(Boolean).length;

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "#0c0c0a",
                fontFamily: "Inter, sans-serif",
                color: "rgba(255,255,255,.88)",
            }}
        >
            <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");
        .jobs-input {
          background: #161614;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 8px;
          padding: 9px 12px;
          font-size: 13px;
          color: #fff;
          font-family: Inter, sans-serif;
          outline: none;
          min-width: 0;
        }
        * {
          box-sizing: border-box;
        }
      `}</style>
            <div
                style={{
                    maxWidth: 720,
                    margin: "0 auto",
                    padding: "36px 20px 80px",
                    overflowX: "hidden",
                }}
            >
                <Link
                    href="/candidate/dashboard"
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        color: "rgba(255,255,255,.4)",
                        textDecoration: "none",
                        marginBottom: 22,
                    }}
                >
                    <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                    Back to Dashboard
                </Link>

                <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
                    Find Jobs
                </div>
                <div
                    style={{
                        fontSize: 12.5,
                        color: "rgba(255,255,255,.35)",
                        marginBottom: 22,
                    }}
                >
                    Search open roles, see your AI match, and apply straight from
                    TalentIQ.
                </div>

                <CareerInterestsCard />

                {recommended !== null && recommended.length > 0 && (
                    <div style={{ marginBottom: 28 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                            Recommended For You
                        </div>
                        {recommended.map((r: any) => (
                            <JobCard
                                key={r.job.id}
                                job={r.job}
                                matchPercent={r.match_percent}
                                reasons={r.reasons}
                            />
                        ))}
                    </div>
                )}
                {resumeAvailable === false && (
                    <div
                        style={{
                            background: "rgba(226,176,74,.06)",
                            border: "1px solid rgba(226,176,74,.2)",
                            borderRadius: 10,
                            padding: "12px 16px",
                            fontSize: 12,
                            color: "#e2b04a",
                            marginBottom: 24,
                        }}
                    >
                        Apply to a job (or scan your CV) once and we'll start showing
                        personalized recommendations here.
                    </div>
                )}

                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        marginBottom: 18,
                    }}
                >
                    <input
                        className="jobs-input"
                        placeholder="Search title, company, keyword…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    {isMobile ? (
                        <button
                            onClick={() => setFiltersOpen(true)}
                            className="jobs-input"
                            style={{
                                textAlign: "left",
                                cursor: "pointer",
                                color: "rgba(255,255,255,.7)",
                            }}
                        >
                            Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
                        </button>
                    ) : (
                        <FilterFields
                            location={location}
                            setLocation={setLocation}
                            workArrangement={workArrangement}
                            setWorkArrangement={setWorkArrangement}
                            employmentType={employmentType}
                            setEmploymentType={setEmploymentType}
                            experienceLevel={experienceLevel}
                            setExperienceLevel={setExperienceLevel}
                            minSalary={minSalary}
                            setMinSalary={setMinSalary}
                            postedWithin={postedWithin}
                            setPostedWithin={setPostedWithin}
                        />
                    )}
                </div>

                {isMobile && filtersOpen && (
                    <div
                        style={{
                            position: "fixed",
                            inset: 0,
                            background: "rgba(0,0,0,.6)",
                            zIndex: 50,
                        }}
                        onClick={() => setFiltersOpen(false)}
                    >
                        <div
                            style={{
                                position: "absolute",
                                bottom: 0,
                                left: 0,
                                right: 0,
                                background: "#111110",
                                border: "1px solid rgba(255,255,255,.1)",
                                borderRadius: "16px 16px 0 0",
                                padding: 20,
                                maxHeight: "70vh",
                                overflowY: "auto",
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
                                Filters
                            </div>
                            <div
                                style={{ display: "flex", flexDirection: "column", gap: 10 }}
                            >
                                <FilterFields
                                    location={location}
                                    setLocation={setLocation}
                                    workArrangement={workArrangement}
                                    setWorkArrangement={setWorkArrangement}
                                    employmentType={employmentType}
                                    setEmploymentType={setEmploymentType}
                                    experienceLevel={experienceLevel}
                                    setExperienceLevel={setExperienceLevel}
                                    minSalary={minSalary}
                                    setMinSalary={setMinSalary}
                                    postedWithin={postedWithin}
                                    setPostedWithin={setPostedWithin}
                                />
                            </div>
                            <button
                                onClick={() => setFiltersOpen(false)}
                                style={{
                                    marginTop: 16,
                                    width: "100%",
                                    fontFamily: "Inter,sans-serif",
                                    fontWeight: 700,
                                    fontSize: 13,
                                    padding: "11px",
                                    borderRadius: 8,
                                    border: "none",
                                    cursor: "pointer",
                                    background: "#e2b04a",
                                    color: "#0a0a08",
                                }}
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>
                )}

                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 8,
                        marginBottom: 10,
                    }}
                >
                    <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.3)" }}>
                        {loading
                            ? "Searching…"
                            : `${total} job${total === 1 ? "" : "s"} found`}
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                        {SORT_OPTIONS.map((o) => {
                            const disabled = o.v === "best_match" && !resumeAvailable;
                            return (
                                <button
                                    key={o.v}
                                    disabled={disabled}
                                    onClick={() => setSortBy(o.v)}
                                    title={
                                        disabled
                                            ? "Add a resume (apply once or scan your CV) to unlock Best Match sorting"
                                            : undefined
                                    }
                                    style={{
                                        fontFamily: "Inter,sans-serif",
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                        padding: "5px 11px",
                                        borderRadius: 100,
                                        cursor: disabled ? "not-allowed" : "pointer",
                                        background:
                                            sortBy === o.v ? "rgba(226,176,74,.14)" : "transparent",
                                        color: disabled
                                            ? "rgba(255,255,255,.2)"
                                            : sortBy === o.v
                                                ? "#e2b04a"
                                                : "rgba(255,255,255,.4)",
                                        border: `1px solid ${sortBy === o.v ? "rgba(226,176,74,.3)" : "rgba(255,255,255,.08)"}`,
                                    }}
                                >
                                    {o.l}
                                </button>
                            );
                        })}
                    </div>
                </div>
                {sortBy === "best_match" && matchMapLoading && (
                    <div
                        style={{
                            fontSize: 11,
                            color: "rgba(255,255,255,.3)",
                            marginBottom: 10,
                        }}
                    >
                        Ranking jobs against your resume…
                    </div>
                )}

                {error && (
                    <div style={{ color: "#ef4444", fontSize: 12.5, marginBottom: 16 }}>
                        {error}
                    </div>
                )}
                {!loading && sortedJobs.length === 0 ? (
                    <div
                        style={{
                            background: "#111110",
                            border: "1px solid rgba(255,255,255,.07)",
                            borderRadius: 12,
                            padding: 36,
                            textAlign: "center",
                            fontSize: 13,
                            color: "rgba(255,255,255,.35)",
                        }}
                    >
                        No jobs match your search right now.
                    </div>
                ) : (
                    sortedJobs.map((j) => (
                        <JobCard
                            key={j.id}
                            job={j}
                            matchPercent={
                                sortBy === "best_match" ? matchMap?.[j.id]?.percent : undefined
                            }
                        />
                    ))
                )}
            </div>
        </div>
    );
}
