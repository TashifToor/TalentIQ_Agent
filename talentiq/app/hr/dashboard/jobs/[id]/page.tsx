"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import TalentPoolPanel from "@/components/modules/talent-intelligence/TalentPoolPanel";

export default function HRJobDetailPage() {
    const params = useParams();
    const jobId = params?.id as string;

    const [job, setJob] = useState<any>(null);
    const [analytics, setAnalytics] = useState<any>(null);
    const [interviewPostings, setInterviewPostings] = useState<any[]>([]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!jobId) return;
        api
            .getJob(jobId)
            .then(setJob)
            .catch((e: any) => setError(e.message || "Could not load this job."));
        api
            .getJobAnalytics(jobId)
            .then(setAnalytics)
            .catch(() => { });
        api
            .getInterviewPostings()
            .then((r: any) => setInterviewPostings(Array.isArray(r) ? r : []))
            .catch(() => setInterviewPostings([]));
    }, [jobId]);

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
      `}</style>
            <div
                style={{ maxWidth: 920, margin: "0 auto", padding: "36px 24px 80px" }}
            >
                <Link
                    href="/hr/dashboard/jobs"
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
                    Back to Jobs
                </Link>

                {error && (
                    <div style={{ color: "#ef4444", fontSize: 12.5, marginBottom: 16 }}>
                        {error}
                    </div>
                )}

                {job && (
                    <>
                        <div style={{ fontSize: 24, fontWeight: 700 }}>{job.title}</div>
                        <div
                            style={{
                                fontSize: 12.5,
                                color: "rgba(255,255,255,.35)",
                                marginTop: 4,
                                marginBottom: 20,
                            }}
                        >
                            {[job.company, job.location].filter(Boolean).join(" · ")}
                        </div>

                        {analytics && (
                            <>
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))",
                                        gap: 10,
                                        marginBottom: 14,
                                    }}
                                >
                                    {[
                                        ["Views", analytics.views],
                                        ["Applications", analytics.applications],
                                        ["Screening", analytics.screening],
                                        ["Interviews", analytics.interviews],
                                        ["Accepted", analytics.accepted],
                                        ["Rejected", analytics.rejected],
                                    ].map(([label, value]) => (
                                        <div
                                            key={label as string}
                                            style={{
                                                background: "#111110",
                                                border: "1px solid rgba(255,255,255,.07)",
                                                borderRadius: 10,
                                                padding: "12px 14px",
                                            }}
                                        >
                                            <div style={{ fontSize: 20, fontWeight: 700 }}>
                                                {value as number}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 10.5,
                                                    color: "rgba(255,255,255,.35)",
                                                }}
                                            >
                                                {label}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {analytics.applications > 0 && (
                                    <div style={{ marginBottom: 26 }}>
                                        <div
                                            style={{
                                                fontSize: 10.5,
                                                color: "rgba(255,255,255,.35)",
                                                marginBottom: 6,
                                            }}
                                        >
                                            Pipeline progress
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                width: "100%",
                                                height: 8,
                                                borderRadius: 100,
                                                overflow: "hidden",
                                                background: "rgba(255,255,255,.05)",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: `${(analytics.accepted / analytics.applications) * 100}%`,
                                                    background: "#13c28e",
                                                }}
                                            />
                                            <div
                                                style={{
                                                    width: `${(analytics.interviews / analytics.applications) * 100}%`,
                                                    background: "#7c3aed",
                                                }}
                                            />
                                            <div
                                                style={{
                                                    width: `${(analytics.screening / analytics.applications) * 100}%`,
                                                    background: "#7c9cf0",
                                                }}
                                            />
                                            <div
                                                style={{
                                                    width: `${(analytics.rejected / analytics.applications) * 100}%`,
                                                    background: "#ef4444",
                                                }}
                                            />
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: 14,
                                                marginTop: 8,
                                                flexWrap: "wrap",
                                                fontSize: 10.5,
                                                color: "rgba(255,255,255,.4)",
                                            }}
                                        >
                                            <span>
                                                <span style={{ color: "#13c28e" }}>●</span> Accepted{" "}
                                                {analytics.accepted}
                                            </span>
                                            <span>
                                                <span style={{ color: "#7c3aed" }}>●</span> Interview{" "}
                                                {analytics.interviews}
                                            </span>
                                            <span>
                                                <span style={{ color: "#7c9cf0" }}>●</span> Screening{" "}
                                                {analytics.screening}
                                            </span>
                                            <span>
                                                <span style={{ color: "#ef4444" }}>●</span> Rejected{" "}
                                                {analytics.rejected}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}

                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
                    Applicants
                </div>
                <TalentPoolPanel
                    jobId={jobId}
                    interviewPostings={interviewPostings.map((p: any) => ({
                        id: p.id,
                        title: p.title,
                    }))}
                />
            </div>
        </div>
    );
}
