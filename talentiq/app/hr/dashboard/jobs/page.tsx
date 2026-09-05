"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Job = any;

const WORK_ARR = [
    { v: "remote", l: "Remote" },
    { v: "hybrid", l: "Hybrid" },
    { v: "onsite", l: "On-site" },
];
const EMP_TYPE = [
    { v: "full_time", l: "Full-time" },
    { v: "part_time", l: "Part-time" },
    { v: "contract", l: "Contract" },
    { v: "internship", l: "Internship" },
];

const STATUS_COLOR: Record<string, string> = {
    draft: "#e2b04a",
    published: "#13c28e",
    closed: "rgba(255,255,255,.35)",
};

function emptyForm() {
    return {
        title: "",
        company: "",
        location: "",
        description: "",
        responsibilities: "",
        required_skills: [] as string[],
        preferred_skills: [] as string[],
        experience_required: "",
        work_arrangement: "",
        employment_type: "",
        salary_min: "",
        salary_max: "",
        salary_currency: "",
        application_deadline: "",
        openings: "",
    };
}

export default function HRJobsPage() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [tab, setTab] = useState<"all" | "draft" | "published" | "closed">(
        "all",
    );

    const [mode, setMode] = useState<"list" | "edit" | "preview">("list");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm());

    const [rawDraft, setRawDraft] = useState("");
    const [assisting, setAssisting] = useState(false);
    const [assistError, setAssistError] = useState("");

    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");

    const load = () => {
        setLoading(true);
        api
            .getMyJobs()
            .then((r: any) => setJobs(r.jobs || []))
            .catch((e: any) => setError(e.message || "Could not load your jobs."))
            .finally(() => setLoading(false));
    };
    useEffect(() => {
        load();
    }, []);

    const visible = jobs.filter((j) => tab === "all" || j.status === tab);

    const startCreate = () => {
        setEditingId(null);
        setForm(emptyForm());
        setRawDraft("");
        setAssistError("");
        setSaveError("");
        setMode("edit");
    };
    const startEdit = (j: Job) => {
        setEditingId(j.id);
        setForm({
            title: j.title || "",
            company: j.company || "",
            location: j.location || "",
            description: j.description || "",
            responsibilities: j.responsibilities || "",
            required_skills: j.required_skills || [],
            preferred_skills: j.preferred_skills || [],
            experience_required: j.experience_required || "",
            work_arrangement: j.work_arrangement || "",
            employment_type: j.employment_type || "",
            salary_min: j.salary_min ?? "",
            salary_max: j.salary_max ?? "",
            salary_currency: j.salary_currency || "",
            application_deadline: j.application_deadline
                ? j.application_deadline.slice(0, 10)
                : "",
            openings: j.openings ?? "",
        });
        setSaveError("");
        setMode("edit");
    };

    const runAiAssist = async () => {
        if (!rawDraft.trim()) return;
        setAssisting(true);
        setAssistError("");
        try {
            const r: any = await api.aiAssistJob(rawDraft);
            setForm((f) => ({
                ...f,
                title: r.title || f.title,
                description: r.description || f.description,
                responsibilities: r.responsibilities || f.responsibilities,
                required_skills: r.required_skills?.length
                    ? r.required_skills
                    : f.required_skills,
                preferred_skills: r.preferred_skills?.length
                    ? r.preferred_skills
                    : f.preferred_skills,
                experience_required: r.experience_required || f.experience_required,
            }));
        } catch (e: any) {
            setAssistError(e.message || "Could not structure this draft right now.");
        } finally {
            setAssisting(false);
        }
    };

    const buildPayload = () => ({
        title: form.title,
        company: form.company || null,
        location: form.location || null,
        description: form.description,
        responsibilities: form.responsibilities || null,
        required_skills: form.required_skills,
        preferred_skills: form.preferred_skills,
        experience_required: form.experience_required || null,
        work_arrangement: form.work_arrangement || null,
        employment_type: form.employment_type || null,
        salary_min: form.salary_min === "" ? null : Number(form.salary_min),
        salary_max: form.salary_max === "" ? null : Number(form.salary_max),
        salary_currency: form.salary_currency || null,
        application_deadline: form.application_deadline || null,
        openings: form.openings === "" ? null : Number(form.openings),
    });

    const saveDraft = async () => {
        if (!form.title.trim() || !form.description.trim()) {
            setSaveError("Title and description are required.");
            return;
        }
        setSaving(true);
        setSaveError("");
        try {
            let job: any;
            if (editingId) job = await api.updateJob(editingId, buildPayload());
            else job = await api.createJob(buildPayload());
            setEditingId(job.id);
            load();
            setMode("preview");
        } catch (e: any) {
            setSaveError(e.message || "Could not save this job.");
        } finally {
            setSaving(false);
        }
    };

    const publish = async () => {
        if (!editingId) return;
        setSaving(true);
        setSaveError("");
        try {
            await api.publishJob(editingId);
            load();
            setMode("list");
        } catch (e: any) {
            setSaveError(e.message || "Could not publish this job.");
        } finally {
            setSaving(false);
        }
    };

    const doAction = async (j: Job, action: "close" | "reopen" | "delete") => {
        try {
            if (action === "close") await api.closeJob(j.id);
            else if (action === "reopen") await api.reopenJob(j.id);
            else if (action === "delete") {
                if (!confirm(`Delete draft "${j.title}"?`)) return;
                await api.deleteJob(j.id);
            }
            load();
        } catch (e: any) {
            alert(e.message || "Action failed.");
        }
    };

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
        width: 100%;
        }
        .jobs-input:focus {
        border-color: #e2b04a;
        }
        .jobs-btn {
        font-family: Inter, sans-serif;
        font-weight: 700;
        cursor: pointer;
        border: none;
        border-radius: 8px;
        }
    `}</style>

            <div
                style={{ maxWidth: 920, margin: "0 auto", padding: "36px 24px 80px" }}
            >
                <Link
                    href="/hr/dashboard"
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        color: "rgba(255,255,255,.4)",
                        textDecoration: "none",
                        marginBottom: 24,
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

                {mode === "list" && (
                    <>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 22,
                                flexWrap: "wrap",
                                gap: 12,
                            }}
                        >
                            <div>
                                <div style={{ fontSize: 26, fontWeight: 700 }}>
                                    Job Postings
                                </div>
                                <div
                                    style={{
                                        fontSize: 12.5,
                                        color: "rgba(255,255,255,.35)",
                                        marginTop: 3,
                                    }}
                                >
                                    Create, publish and track jobs candidates can find and apply
                                    to.
                                </div>
                            </div>
                            <button
                                onClick={startCreate}
                                className="jobs-btn"
                                style={{
                                    background: "#e2b04a",
                                    color: "#0a0a08",
                                    padding: "10px 18px",
                                    fontSize: 13,
                                }}
                            >
                                + New Job
                            </button>
                        </div>

                        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
                            {(["all", "draft", "published", "closed"] as const).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setTab(t)}
                                    className="jobs-btn"
                                    style={{
                                        padding: "7px 14px",
                                        fontSize: 12,
                                        textTransform: "capitalize",
                                        background:
                                            tab === t ? "rgba(226,176,74,.14)" : "transparent",
                                        color: tab === t ? "#e2b04a" : "rgba(255,255,255,.4)",
                                        border: `1px solid ${tab === t ? "rgba(226,176,74,.3)" : "rgba(255,255,255,.08)"}`,
                                    }}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        {error && (
                            <div
                                style={{ color: "#ef4444", fontSize: 12.5, marginBottom: 16 }}
                            >
                                {error}
                            </div>
                        )}
                        {loading ? (
                            <div
                                style={{
                                    fontSize: 13,
                                    color: "rgba(255,255,255,.3)",
                                    textAlign: "center",
                                    padding: 40,
                                }}
                            >
                                Loading…
                            </div>
                        ) : visible.length === 0 ? (
                            <div
                                style={{
                                    background: "#111110",
                                    border: "1px solid rgba(255,255,255,.07)",
                                    borderRadius: 12,
                                    padding: 40,
                                    textAlign: "center",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 13,
                                        color: "rgba(255,255,255,.3)",
                                        marginBottom: 14,
                                    }}
                                >
                                    No jobs in this view yet.
                                </div>
                                <button
                                    onClick={startCreate}
                                    className="jobs-btn"
                                    style={{
                                        background: "transparent",
                                        color: "#e2b04a",
                                        fontSize: 13,
                                        padding: 0,
                                    }}
                                >
                                    Create your first job posting →
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {visible.map((j) => (
                                    <div
                                        key={j.id}
                                        style={{
                                            background: "#111110",
                                            border: "1px solid rgba(255,255,255,.07)",
                                            borderRadius: 12,
                                            padding: "16px 20px",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "flex-start",
                                                gap: 12,
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            <div style={{ minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 8,
                                                        flexWrap: "wrap",
                                                    }}
                                                >
                                                    <Link
                                                        href={`/hr/dashboard/jobs/${j.id}`}
                                                        style={{
                                                            fontSize: 15,
                                                            fontWeight: 700,
                                                            color: "#fff",
                                                            textDecoration: "none",
                                                        }}
                                                    >
                                                        {j.title}
                                                    </Link>
                                                    <span
                                                        style={{
                                                            fontSize: 10,
                                                            fontWeight: 700,
                                                            textTransform: "uppercase",
                                                            padding: "2px 8px",
                                                            borderRadius: 100,
                                                            background: `${STATUS_COLOR[j.status]}18`,
                                                            color: STATUS_COLOR[j.status],
                                                        }}
                                                    >
                                                        {j.status}
                                                    </span>
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 11.5,
                                                        color: "rgba(255,255,255,.35)",
                                                        marginTop: 4,
                                                    }}
                                                >
                                                    {[
                                                        j.company,
                                                        j.location,
                                                        j.employment_type?.replace("_", " "),
                                                    ]
                                                        .filter(Boolean)
                                                        .join(" · ")}
                                                </div>
                                            </div>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    gap: 14,
                                                    alignItems: "center",
                                                    fontSize: 11.5,
                                                    color: "rgba(255,255,255,.4)",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <span>
                                                    {j.applicant_count ?? 0} applicant
                                                    {j.applicant_count === 1 ? "" : "s"}
                                                </span>
                                                <span>{j.views_count ?? 0} views</span>
                                            </div>
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: 8,
                                                marginTop: 12,
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            <Link
                                                href={`/hr/dashboard/jobs/${j.id}`}
                                                className="jobs-btn"
                                                style={{
                                                    textDecoration: "none",
                                                    display: "inline-block",
                                                    fontSize: 11.5,
                                                    padding: "6px 12px",
                                                    background: "rgba(255,255,255,.05)",
                                                    color: "rgba(255,255,255,.7)",
                                                    border: "1px solid rgba(255,255,255,.1)",
                                                }}
                                            >
                                                Applicants
                                            </Link>
                                            <button
                                                onClick={() => startEdit(j)}
                                                className="jobs-btn"
                                                style={{
                                                    fontSize: 11.5,
                                                    padding: "6px 12px",
                                                    background: "rgba(255,255,255,.05)",
                                                    color: "rgba(255,255,255,.7)",
                                                    border: "1px solid rgba(255,255,255,.1)",
                                                }}
                                            >
                                                Edit
                                            </button>
                                            {j.status === "draft" && (
                                                <button
                                                    onClick={() => doAction(j, "delete")}
                                                    className="jobs-btn"
                                                    style={{
                                                        fontSize: 11.5,
                                                        padding: "6px 12px",
                                                        background: "rgba(239,68,68,.08)",
                                                        color: "#ef4444",
                                                        border: "1px solid rgba(239,68,68,.2)",
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                            )}
                                            {j.status === "published" && (
                                                <button
                                                    onClick={() => doAction(j, "close")}
                                                    className="jobs-btn"
                                                    style={{
                                                        fontSize: 11.5,
                                                        padding: "6px 12px",
                                                        background: "rgba(255,255,255,.05)",
                                                        color: "rgba(255,255,255,.7)",
                                                        border: "1px solid rgba(255,255,255,.1)",
                                                    }}
                                                >
                                                    Close
                                                </button>
                                            )}
                                            {j.status === "closed" && (
                                                <button
                                                    onClick={() => doAction(j, "reopen")}
                                                    className="jobs-btn"
                                                    style={{
                                                        fontSize: 11.5,
                                                        padding: "6px 12px",
                                                        background: "rgba(19,194,142,.1)",
                                                        color: "#13c28e",
                                                        border: "1px solid rgba(19,194,142,.25)",
                                                    }}
                                                >
                                                    Reopen
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {mode === "edit" && (
                    <div>
                        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                            {editingId ? "Edit Job" : "New Job"}
                        </div>
                        <div
                            style={{
                                fontSize: 12.5,
                                color: "rgba(255,255,255,.35)",
                                marginBottom: 22,
                            }}
                        >
                            Fill in the core fields, or paste a rough draft below and let AI
                            structure it — everything stays editable.
                        </div>

                        <div
                            style={{
                                background: "#111110",
                                border: "1px solid rgba(255,255,255,.07)",
                                borderRadius: 12,
                                padding: 18,
                                marginBottom: 18,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    color: "#e2b04a",
                                    marginBottom: 8,
                                }}
                            >
                                AI-Assisted Draft (optional)
                            </div>
                            <textarea
                                value={rawDraft}
                                onChange={(e) => setRawDraft(e.target.value)}
                                placeholder="Paste a rough job description here and TalentIQ will structure it into the fields below…"
                                className="jobs-input"
                                style={{ minHeight: 90, resize: "vertical", marginBottom: 10 }}
                            />
                            {assistError && (
                                <div
                                    style={{ color: "#ef4444", fontSize: 11.5, marginBottom: 8 }}
                                >
                                    {assistError}
                                </div>
                            )}
                            <button
                                onClick={runAiAssist}
                                disabled={assisting || !rawDraft.trim()}
                                className="jobs-btn"
                                style={{
                                    fontSize: 12,
                                    padding: "8px 14px",
                                    background: assisting ? "rgba(255,255,255,.08)" : "#7c3aed",
                                    color: "#fff",
                                    opacity: assisting || !rawDraft.trim() ? 0.6 : 1,
                                }}
                            >
                                {assisting ? "Structuring…" : "Structure with AI"}
                            </button>
                        </div>

                        <Field label="Job Title *">
                            <input
                                className="jobs-input"
                                value={form.title}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, title: e.target.value }))
                                }
                            />
                        </Field>
                        <Row>
                            <Field label="Company">
                                <input
                                    className="jobs-input"
                                    value={form.company}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, company: e.target.value }))
                                    }
                                />
                            </Field>
                            <Field label="Location">
                                <input
                                    className="jobs-input"
                                    value={form.location}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, location: e.target.value }))
                                    }
                                />
                            </Field>
                        </Row>
                        <Row>
                            <Field label="Work Arrangement">
                                <select
                                    className="jobs-input"
                                    value={form.work_arrangement}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, work_arrangement: e.target.value }))
                                    }
                                >
                                    <option value="">—</option>
                                    {WORK_ARR.map((o) => (
                                        <option key={o.v} value={o.v}>
                                            {o.l}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Employment Type">
                                <select
                                    className="jobs-input"
                                    value={form.employment_type}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, employment_type: e.target.value }))
                                    }
                                >
                                    <option value="">—</option>
                                    {EMP_TYPE.map((o) => (
                                        <option key={o.v} value={o.v}>
                                            {o.l}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                        </Row>
                        <Field label="Job Description *">
                            <textarea
                                className="jobs-input"
                                style={{ minHeight: 120, resize: "vertical" }}
                                value={form.description}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, description: e.target.value }))
                                }
                            />
                        </Field>
                        <Field label="Responsibilities">
                            <textarea
                                className="jobs-input"
                                style={{ minHeight: 80, resize: "vertical" }}
                                value={form.responsibilities}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, responsibilities: e.target.value }))
                                }
                            />
                        </Field>

                        <Row>
                            <TagField
                                label="Required Skills"
                                values={form.required_skills}
                                onChange={(v) => setForm((f) => ({ ...f, required_skills: v }))}
                            />
                            <TagField
                                label="Preferred Skills"
                                values={form.preferred_skills}
                                onChange={(v) =>
                                    setForm((f) => ({ ...f, preferred_skills: v }))
                                }
                            />
                        </Row>

                        <Row>
                            <Field label="Experience Required">
                                <input
                                    className="jobs-input"
                                    placeholder="e.g. 3-5 years"
                                    value={form.experience_required}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            experience_required: e.target.value,
                                        }))
                                    }
                                />
                            </Field>
                            <Field label="Number of Openings">
                                <input
                                    type="number"
                                    className="jobs-input"
                                    value={form.openings}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, openings: e.target.value }))
                                    }
                                />
                            </Field>
                        </Row>
                        <Row>
                            <Field label="Salary Min">
                                <input
                                    type="number"
                                    className="jobs-input"
                                    value={form.salary_min}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, salary_min: e.target.value }))
                                    }
                                />
                            </Field>
                            <Field label="Salary Max">
                                <input
                                    type="number"
                                    className="jobs-input"
                                    value={form.salary_max}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, salary_max: e.target.value }))
                                    }
                                />
                            </Field>
                            <Field label="Currency">
                                <input
                                    className="jobs-input"
                                    placeholder="USD"
                                    value={form.salary_currency}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, salary_currency: e.target.value }))
                                    }
                                />
                            </Field>
                        </Row>
                        <Field label="Application Deadline">
                            <input
                                type="date"
                                className="jobs-input"
                                value={form.application_deadline}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        application_deadline: e.target.value,
                                    }))
                                }
                            />
                        </Field>

                        {saveError && (
                            <div
                                style={{ color: "#ef4444", fontSize: 12.5, margin: "10px 0" }}
                            >
                                {saveError}
                            </div>
                        )}
                        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                            <button
                                onClick={() => setMode("list")}
                                className="jobs-btn"
                                style={{
                                    fontSize: 13,
                                    padding: "10px 18px",
                                    background: "rgba(255,255,255,.05)",
                                    color: "rgba(255,255,255,.6)",
                                    border: "1px solid rgba(255,255,255,.1)",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveDraft}
                                disabled={saving}
                                className="jobs-btn"
                                style={{
                                    fontSize: 13,
                                    padding: "10px 18px",
                                    background: "#e2b04a",
                                    color: "#0a0a08",
                                    opacity: saving ? 0.6 : 1,
                                }}
                            >
                                {saving ? "Saving…" : "Save & Preview"}
                            </button>
                        </div>
                    </div>
                )}

                {mode === "preview" && (
                    <JobPreview
                        form={form}
                        onBack={() => setMode("edit")}
                        onPublish={publish}
                        saving={saving}
                        error={saveError}
                    />
                )}
            </div>
        </div>
    );
}

function Row({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: `repeat(${Array.isArray(children) ? children.length : 1}, 1fr)`,
                gap: 14,
            }}
        >
            {children}
        </div>
    );
}
function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div style={{ marginBottom: 14 }}>
            <div
                style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "rgba(255,255,255,.45)",
                    marginBottom: 6,
                }}
            >
                {label}
            </div>
            {children}
        </div>
    );
}
function TagField({
    label,
    values,
    onChange,
}: {
    label: string;
    values: string[];
    onChange: (v: string[]) => void;
}) {
    const [val, setVal] = useState("");
    const add = () => {
        const v = val.trim();
        if (v && !values.includes(v)) onChange([...values, v]);
        setVal("");
    };
    return (
        <Field label={label}>
            <div
                style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}
            >
                {values.map((s) => (
                    <span
                        key={s}
                        style={{
                            fontSize: 11,
                            background: "rgba(226,176,74,.1)",
                            color: "#e2b04a",
                            padding: "4px 10px",
                            borderRadius: 100,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                        }}
                    >
                        {s}
                        <span
                            onClick={() => onChange(values.filter((x) => x !== s))}
                            style={{ cursor: "pointer", opacity: 0.6 }}
                        >
                            ×
                        </span>
                    </span>
                ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
                <input
                    className="jobs-input"
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
                    placeholder="Type a skill, Enter to add"
                />
                <button
                    onClick={add}
                    className="jobs-btn"
                    style={{
                        fontSize: 12,
                        padding: "0 14px",
                        background: "rgba(255,255,255,.08)",
                        color: "#fff",
                    }}
                >
                    Add
                </button>
            </div>
        </Field>
    );
}

function JobPreview({
    form,
    onBack,
    onPublish,
    saving,
    error,
}: {
    form: any;
    onBack: () => void;
    onPublish: () => void;
    saving: boolean;
    error: string;
}) {
    return (
        <div>
            <div
                style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,.4)",
                    marginBottom: 16,
                }}
            >
                This is approximately what candidates will see.
            </div>
            <div
                style={{
                    background: "#111110",
                    border: "1px solid rgba(255,255,255,.08)",
                    borderRadius: 14,
                    padding: 26,
                }}
            >
                <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>
                    {form.title || "Untitled Role"}
                </div>
                <div
                    style={{ fontSize: 13, color: "rgba(255,255,255,.4)", marginTop: 4 }}
                >
                    {[
                        form.company,
                        form.location,
                        form.work_arrangement,
                        form.employment_type?.replace("_", " "),
                    ]
                        .filter(Boolean)
                        .join(" · ")}
                </div>
                {(form.salary_min || form.salary_max) && (
                    <div
                        style={{
                            fontSize: 13,
                            color: "#13c28e",
                            marginTop: 8,
                            fontWeight: 600,
                        }}
                    >
                        {form.salary_currency || ""} {form.salary_min || "?"} –{" "}
                        {form.salary_max || "?"}
                    </div>
                )}
                <div
                    style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}
                >
                    {[...form.required_skills, ...form.preferred_skills].map(
                        (s: string) => (
                            <span
                                key={s}
                                style={{
                                    fontSize: 11,
                                    background: "rgba(255,255,255,.06)",
                                    padding: "4px 10px",
                                    borderRadius: 100,
                                    color: "rgba(255,255,255,.6)",
                                }}
                            >
                                {s}
                            </span>
                        ),
                    )}
                </div>
                <div
                    style={{
                        marginTop: 20,
                        fontSize: 13.5,
                        color: "rgba(255,255,255,.65)",
                        lineHeight: 1.8,
                        whiteSpace: "pre-wrap",
                    }}
                >
                    {form.description}
                </div>
                {form.responsibilities && (
                    <>
                        <div
                            style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: "rgba(255,255,255,.5)",
                                marginTop: 18,
                                marginBottom: 6,
                            }}
                        >
                            Responsibilities
                        </div>
                        <div
                            style={{
                                fontSize: 13,
                                color: "rgba(255,255,255,.6)",
                                lineHeight: 1.8,
                                whiteSpace: "pre-wrap",
                            }}
                        >
                            {form.responsibilities}
                        </div>
                    </>
                )}
                {form.experience_required && (
                    <div
                        style={{
                            fontSize: 12,
                            color: "rgba(255,255,255,.45)",
                            marginTop: 14,
                        }}
                    >
                        Experience: {form.experience_required}
                    </div>
                )}
                {form.application_deadline && (
                    <div
                        style={{
                            fontSize: 12,
                            color: "rgba(255,255,255,.45)",
                            marginTop: 4,
                        }}
                    >
                        Apply by: {form.application_deadline}
                    </div>
                )}
            </div>

            {error && (
                <div style={{ color: "#ef4444", fontSize: 12.5, margin: "14px 0 0" }}>
                    {error}
                </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button
                    onClick={onBack}
                    className="jobs-btn"
                    style={{
                        fontSize: 13,
                        padding: "10px 18px",
                        background: "rgba(255,255,255,.05)",
                        color: "rgba(255,255,255,.6)",
                        border: "1px solid rgba(255,255,255,.1)",
                    }}
                >
                    Back to Edit
                </button>
                <button
                    onClick={onPublish}
                    disabled={saving}
                    className="jobs-btn"
                    style={{
                        fontSize: 13,
                        padding: "10px 18px",
                        background: "#13c28e",
                        color: "#0a0a08",
                        opacity: saving ? 0.6 : 1,
                    }}
                >
                    {saving ? "Publishing…" : "Publish Job"}
                </button>
            </div>
        </div>
    );
}
