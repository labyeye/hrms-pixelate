import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { recruitmentAPI, departmentAPI } from "@/services/api";
import { Job, Department } from "@/types/hrms";
import { cn } from "@/lib/utils";
import {
  Plus,
  Briefcase,
  Users,
  X,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { ActionModal } from "@/components/ui/ActionModal";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C] px-2 py-0.5",
  on_hold: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C] px-2 py-0.5",
  closed: "bg-gray-100 text-gray-500 border-gray-300 px-2 py-0.5",
  cancelled: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444] px-2 py-0.5",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-500 border-gray-300 px-2 py-0.5",
  medium: "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB] px-2 py-0.5",
  high: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C] px-2 py-0.5",
  urgent: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444] px-2 py-0.5",
};

const STAGES = [
  "applied",
  "screening",
  "interview",
  "technical",
  "hr_round",
  "offered",
  "hired",
  "rejected",
];

export default function RecruitmentPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [candidateModal, setCandidateModal] = useState<{
    jobId: string;
  } | null>(null);
  const [form, setForm] = useState({
    title: "",
    department: "",
    positions: "1",
    type: "full_time",
    priority: "medium",
    description: "",
    location: "",
    closingDate: "",
  });
  const [candForm, setCandForm] = useState({ name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [actionModal, setActionModal] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({ show: false, type: "success", title: "", message: "" });
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [sortKey, setSortKey] = useState<"title" | "candidates" | "positions">("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsRes, deptRes] = await Promise.all([
        recruitmentAPI.getAll(),
        departmentAPI.getAll(),
      ]);
      if (jobsRes.success) setJobs(jobsRes.data);
      if (deptRes.success) setDepartments(deptRes.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await recruitmentAPI.create({
        ...form,
        positions: Number(form.positions),
      });
      setActionModal({
        show: true,
        type: "success",
        title: "Job Posted",
        message: "New job opening has been created successfully.",
      });
      setShowModal(false);
      load();
    } catch (err: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: err.message || "Failed to create job.",
      });
    }
    setSaving(false);
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateModal) return;
    setSaving(true);
    try {
      await recruitmentAPI.addCandidate(candidateModal.jobId, candForm);
      setActionModal({
        show: true,
        type: "success",
        title: "Candidate Added",
        message: "Candidate has been added to the pipeline.",
      });
      setCandidateModal(null);
      setCandForm({ name: "", email: "", phone: "" });
      load();
    } catch (err: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: err.message || "Failed to add candidate.",
      });
    }
    setSaving(false);
  };

  const handleStageUpdate = async (
    jobId: string,
    candidateId: string,
    stage: string,
  ) => {
    try {
      await recruitmentAPI.updateCandidateStage(jobId, candidateId, { stage });
      load();
    } catch {}
  };

  const handleJobStatus = async (jobId: string, status: string) => {
    try {
      await recruitmentAPI.update(jobId, { status });
      load();
    } catch {}
  };

  const openJobs = jobs.filter((j) => j.status === "open");

  const displayedJobs = [...jobs]
    .filter(j => {
      if (search && !j.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus && j.status !== filterStatus) return false;
      if (filterPriority && j.priority !== filterPriority) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title") cmp = a.title.localeCompare(b.title);
      else if (sortKey === "candidates") cmp = (a.candidates?.length ?? 0) - (b.candidates?.length ?? 0);
      else if (sortKey === "positions") cmp = (a.positions ?? 0) - (b.positions ?? 0);
      return sortDir === "asc" ? cmp : -cmp;
    });

  return (
    <AppLayout title="Recruitment">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <p className="text-sm font-medium text-muted-foreground">
          {openJobs.length} open positions ·{" "}
          {jobs.reduce((s, j) => s + j.candidates.length, 0)} total candidates
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Post Job
        </button>
      </div>

      {/* Search, Filter & Sort */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 flex-1 min-w-48">
          <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
          <input type="text" placeholder="Search by job title..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full font-medium" />
          {search && <button onClick={() => setSearch("")}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none">
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="on_hold">On Hold</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none">
          <option value="">All Priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <select value={sortKey} onChange={e => setSortKey(e.target.value as any)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none">
          <option value="title">Sort: Title</option>
          <option value="candidates">Sort: Candidates</option>
          <option value="positions">Sort: Positions</option>
        </select>
        <button onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
          className="border-2 border-black bg-white px-3 py-2 flex items-center gap-1 font-semibold text-sm">
          {sortDir === "asc" ? <ArrowUp className="w-4 h-4"/> : <ArrowDown className="w-4 h-4"/>}
          {sortDir === "asc" ? "Asc" : "Desc"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <img src={nesthrlogo} alt="NestHR" className="h-16 w-auto" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="border-2 bg-white p-12 flex flex-col items-center justify-center">
          <Briefcase className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No job postings yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm mt-4"
          >
            Post First Job
          </button>
        </div>
      ) : displayedJobs.length === 0 ? (
        <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
          <Search className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No jobs match your filters</p>
          <button onClick={() => { setSearch(""); setFilterStatus(""); setFilterPriority(""); }}
            className="text-sm text-[#024BAB] font-bold mt-2 hover:underline">Clear filters</button>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedJobs.map((job) => (
            <div key={job._id} className="border-2 bg-white overflow-hidden">
              {}
              <div
                className="p-4 flex items-start justify-between gap-3 cursor-pointer"
                onClick={() =>
                  setExpandedJob(expandedJob === job._id ? null : job._id)
                }
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-[#024BAB] border-2 border-black flex items-center justify-center shrink-0">
                    <Briefcase className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-display font-bold text-black">
                        {job.title}
                      </h3>
                      <span
                        className={cn(
                          "border-2 text-[10px] capitalize",
                          STATUS_COLORS[job.status],
                        )}
                      >
                        {job.status}
                      </span>
                      <span
                        className={cn(
                          "border-2 text-[10px] capitalize",
                          PRIORITY_COLORS[job.priority],
                        )}
                      >
                        {job.priority}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground font-medium">
                      <span>{(job.department as any)?.name || "No dept"}</span>
                      <span>
                        {job.positions} position{job.positions > 1 ? "s" : ""}
                      </span>
                      <span className="capitalize">
                        {job.type.replace("_", " ")}
                      </span>
                      <span>{job.location || "Remote"}</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {job.candidates.length} candidates
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {job.status === "open" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJobStatus(job._id, "closed");
                      }}
                      className="text-xs font-bold border-2 border-black px-2 py-1 hover:bg-black hover:text-white transition-colors"
                    >
                      Close
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCandidateModal({ jobId: job._id });
                    }}
                    className="text-xs font-bold border-2 border-black bg-[#FA731C] text-white px-2 py-1 hover:bg-[#FA731C]/80 transition-colors"
                  >
                    + Candidate
                  </button>
                  {expandedJob === job._id ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </div>

              {}
              {expandedJob === job._id && job.candidates.length > 0 && (
                <div className="border-t-2 border-black p-4">
                  <h4 className="font-bold text-sm text-black mb-3">
                    Candidates ({job.candidates.length})
                  </h4>
                  <div className="overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b-2 border-black bg-[#024BAB]/5">
                          {[
                            "Candidate",
                            "Email",
                            "Phone",
                            "Stage",
                            "Applied",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left font-bold text-black uppercase"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {job.candidates.map((cand) => (
                          <tr
                            key={cand._id}
                            className="border-b border-black/10 hover:bg-[#024BAB]/5"
                          >
                            <td className="px-3 py-2 font-bold text-black">
                              {cand.name}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {cand.email}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {cand.phone || "—"}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={cand.stage}
                                onChange={(e) =>
                                  handleStageUpdate(
                                    job._id,
                                    cand._id,
                                    e.target.value,
                                  )
                                }
                                className="border-2 border-black px-2 py-1 text-xs font-semibold bg-white outline-none capitalize"
                              >
                                {STAGES.map((s) => (
                                  <option key={s} value={s}>
                                    {s.replace("_", " ")}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {new Date(cand.appliedAt).toLocaleDateString(
                                "en-IN",
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {expandedJob === job._id && job.candidates.length === 0 && (
                <div className="border-t-2 border-black p-6 text-center text-muted-foreground text-sm font-bold">
                  No candidates yet. Add the first one!
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg">Post New Job</h3>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={handleCreateJob}
              onInvalidCapture={(e) => {
                const el = e.target as HTMLInputElement;
                e.preventDefault();
                const label =
                  el
                    .closest("div")
                    ?.querySelector("label")
                    ?.textContent?.replace("*", "")
                    .trim() ||
                  el.placeholder ||
                  el.name ||
                  "a required field";
                setActionModal({
                  show: true,
                  type: "error",
                  title: "Required Field Missing",
                  message: `Please fill in: ${label}`,
                });
              }}
              className="p-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Job Title
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="border-2 w-full px-3 py-2 text-sm"
                  required
                  placeholder="e.g. Senior Developer"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Department
                  </label>
                  <select
                    required
                    value={form.department}
                    onChange={(e) =>
                      setForm({ ...form, department: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  >
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Positions
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={form.positions}
                    onChange={(e) =>
                      setForm({ ...form, positions: e.target.value })
                    }
                    title="Positions must be between 1 and 50"
                    className="border-2 w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Type
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="border-2 w-full px-3 py-2 text-sm"
                  >
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="intern">Intern</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Location
                  </label>
                  <input
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                    placeholder="City / Remote"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Closing Date
                  </label>
                  <input
                    type="date"
                    value={form.closingDate}
                    onChange={(e) =>
                      setForm({ ...form, closingDate: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="border-2 w-full px-3 py-2 text-sm resize-none"
                  rows={3}
                  placeholder="Job description..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="border-2 bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold flex-1"
                >
                  {saving ? "Posting..." : "Post Job"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="border-2 bg-white text-black px-4 py-2.5 text-sm font-bold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {}
      {candidateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg">Add Candidate</h3>
              <button onClick={() => setCandidateModal(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={handleAddCandidate}
              onInvalidCapture={(e) => {
                const el = e.target as HTMLInputElement;
                e.preventDefault();
                const label =
                  el
                    .closest("div")
                    ?.querySelector("label")
                    ?.textContent?.replace("*", "")
                    .trim() ||
                  el.placeholder ||
                  el.name ||
                  "a required field";
                setActionModal({
                  show: true,
                  type: "error",
                  title: "Required Field Missing",
                  message: `Please fill in: ${label}`,
                });
              }}
              className="p-5 space-y-4"
            >
              {[
                {
                  label: "Full Name",
                  key: "name",
                  type: "text",
                  required: true,
                },
                { label: "Email", key: "email", type: "email", required: true },
                { label: "Phone", key: "phone", type: "tel", required: false },
              ].map(({ label, key, type, required }) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-black mb-1">
                    {label}
                  </label>
                  <input
                    type={type}
                    value={(candForm as any)[key]}
                    required={required}
                    onChange={(e) =>
                      setCandForm({ ...candForm, [key]: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  />
                </div>
              ))}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="border-2 bg-[#FA731C] text-white px-6 py-2.5 text-sm font-bold flex-1"
                >
                  {saving ? "Adding..." : "Add Candidate"}
                </button>
                <button
                  type="button"
                  onClick={() => setCandidateModal(null)}
                  className="border-2 bg-white text-black px-4 py-2.5 text-sm font-bold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ActionModal
        show={actionModal.show}
        type={actionModal.type}
        title={actionModal.title}
        message={actionModal.message}
        onClose={() => setActionModal({ ...actionModal, show: false })}
      />
    </AppLayout>
  );
}
