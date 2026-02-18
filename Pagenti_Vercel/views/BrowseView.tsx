import React, { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DEPARTMENT_COLORS, DEPARTMENTS } from "../constants";
import { agentService } from "../services/agentService";
import { CandidateCard } from "../components/CandidateCard";
import { DigitalAssociate } from "../types";
import {
  Search,
  ChevronRight,
  BarChart3,
  LayoutGrid,
  List as ListIcon,
  Zap,
  X,
  AlertTriangle,
} from "lucide-react";
import { useI18n } from "../I18nContext";
import { analyzeJobDescription } from "../services/geminiService";

export const BrowseView: React.FC = () => {
  const { t, tl, language } = useI18n();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("All Departments");
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  // JD Analysis State
  const [jdText, setJdText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ match: boolean; message: string } | null>(
    null
  );

  // Edit / Delete state
  const [editingAgent, setEditingAgent] = useState<DigitalAssociate | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<DigitalAssociate | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "",
    department: "",
    hourlyRate: 0,
    description: "",
  });

  // Load merged agents (excluding internal system agents like Ares)
  const [candidates, setCandidates] = useState(() =>
    agentService.getAgents().filter((agent) => agent.id !== "ares-architect")
  );

  useEffect(() => {
    agentService.getAllAgents().then((data) => {
      setCandidates(data.filter((agent) => agent.id !== "ares-architect"));
    });
  }, []);

  const handleEditOpen = (agent: DigitalAssociate) => {
    setEditingAgent(agent);
    setEditForm({
      name: agent.name,
      role: typeof agent.role === "string" ? agent.role : agent.role.en || "",
      department: agent.department,
      hourlyRate: agent.hourlyRate,
      description:
        typeof agent.description === "string" ? agent.description : agent.description.en || "",
    });
  };

  const handleEditSave = async () => {
    if (!editingAgent) return;
    const updatedRole =
      typeof editingAgent.role === "string"
        ? ({
            en: editForm.role,
            "en-GB": editForm.role,
            es: editForm.role,
            fr: editForm.role,
            de: editForm.role,
            it: editForm.role,
            pt: editForm.role,
            ja: editForm.role,
          } as DigitalAssociate["role"])
        : ({
            ...editingAgent.role,
            en: editForm.role,
            "en-GB": editForm.role,
          } as DigitalAssociate["role"]);
    const updatedDesc =
      typeof editingAgent.description === "string"
        ? ({
            en: editForm.description,
            "en-GB": editForm.description,
            es: editForm.description,
            fr: editForm.description,
            de: editForm.description,
            it: editForm.description,
            pt: editForm.description,
            ja: editForm.description,
          } as DigitalAssociate["description"])
        : ({
            ...editingAgent.description,
            en: editForm.description,
            "en-GB": editForm.description,
          } as DigitalAssociate["description"]);
    const updatedAgent: DigitalAssociate = {
      ...editingAgent,
      name: editForm.name,
      role: updatedRole,
      department: editForm.department,
      hourlyRate: editForm.hourlyRate,
      description: updatedDesc,
    };
    await agentService.saveAgent(updatedAgent);
    setCandidates((prev) => prev.map((c) => (c.id === updatedAgent.id ? updatedAgent : c)));
    setEditingAgent(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAgent) return;
    await agentService.deleteAgent(deletingAgent.id);
    setCandidates((prev) => prev.filter((c) => c.id !== deletingAgent.id));
    setDeletingAgent(null);
  };

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const localizedRole = tl(c.role).toLowerCase();
      const localizedExpertise = tl(c.expertise).map((e) => e.toLowerCase());
      const query = searchTerm.toLowerCase();

      const matchesSearch =
        c.name.toLowerCase().includes(query) ||
        localizedRole.includes(query) ||
        localizedExpertise.some((e) => e.includes(query));

      const matchesDept = selectedDept === "All Departments" || c.department === selectedDept;
      return matchesSearch && matchesDept;
    });
  }, [searchTerm, selectedDept, language, tl, candidates]);

  const toggleCompare = (id: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const handleAnalyzeJD = async () => {
    if (!jdText.trim()) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);

    const result = await analyzeJobDescription(jdText, candidates);
    setIsAnalyzing(false);

    if (result.matchFound && result.candidateId) {
      setSearchTerm(candidates.find((c) => c.id === result.candidateId)?.name || "");
      setAnalysisResult({
        match: true,
        message: `Match found: ${result.candidateId.toUpperCase()}. Filtering roster...`,
      });
    } else {
      setAnalysisResult({
        match: false,
        message: "Capability Gap Detected. Redirecting to Custom Build...",
      });
      setTimeout(() => {
        navigate("/custom-build");
      }, 2000);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-12">
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2 tracking-tight">
            Pagenti Digital Roster
          </h1>
          <p className="text-gray-500">Instant Capacity. Zero Latency.</p>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
          <button
            onClick={() => setViewMode("grid")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${viewMode === "grid" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
          >
            <LayoutGrid size={14} /> Grid
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${viewMode === "list" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
          >
            <ListIcon size={14} /> List
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <aside className="w-full lg:w-72 flex-shrink-0 space-y-8 sticky top-24">
          {/* Workforce Analysis Engine Widget */}
          <div className="bg-indigo-950 rounded-[2rem] p-6 text-white overflow-hidden relative shadow-lg border border-indigo-900/50">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="text-amber-400" size={16} fill="currentColor" />
                <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest font-mono">
                  Workforce Analysis Engine
                </p>
              </div>

              <h4 className="text-lg font-bold mb-2 tracking-tight">Got a Job Description?</h4>
              <p className="text-xs text-indigo-300 mb-4 leading-relaxed">
                Paste it here. We'll identify the perfect Digital Associate or build a custom one.
              </p>

              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="Paste requirements..."
                className="w-full bg-indigo-900/50 border border-indigo-500/30 rounded-xl p-3 text-xs text-white placeholder:text-indigo-400 outline-none focus:ring-1 focus:ring-amber-400 mb-3 h-24 resize-none"
              />

              {analysisResult && (
                <div
                  className={`text-xs font-bold p-2 mb-3 rounded-lg border ${analysisResult.match ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-red-500/20 text-red-300 border-red-500/30"}`}
                >
                  {analysisResult.message}
                </div>
              )}

              <button
                onClick={handleAnalyzeJD}
                disabled={isAnalyzing}
                className="w-full bg-white text-indigo-950 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-xl block text-center disabled:opacity-50 disabled:cursor-wait"
              >
                {isAnalyzing ? "Scanning Roster..." : "Analyze Workload"}
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-[2rem] p-6 shadow-sm">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6 font-mono">
              {t("filterFunction")}
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedDept("All Departments")}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-between group ${selectedDept === "All Departments" ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}
              >
                {t("allTalent")}
                <ChevronRight size={14} />
              </button>
              {Object.keys(DEPARTMENT_COLORS).map((dept) => (
                <button
                  key={dept}
                  onClick={() => setSelectedDept(dept)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-between group ${selectedDept === dept ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}
                >
                  <span className="truncate">{t(DEPARTMENT_COLORS[dept].key)}</span>
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex-grow">
          <div className="bg-white border border-gray-100 rounded-[2rem] p-4 mb-8 flex flex-col sm:flex-row gap-4 shadow-sm items-center">
            <div className="relative flex-grow w-full">
              <Search
                className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-400"
                size={18}
              />
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-14 pr-6 py-4 bg-gray-50 border border-transparent rounded-2xl text-base text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-200 transition-all font-medium"
              />
            </div>
          </div>

          {filteredCandidates.length > 0 ? (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
                  : "flex flex-col gap-6"
              }
            >
              {filteredCandidates.map((c) => (
                <CandidateCard
                  key={c.id}
                  candidate={c}
                  showCheckbox={true}
                  isSelected={selectedForCompare.includes(c.id)}
                  onSelect={toggleCompare}
                  viewMode={viewMode}
                  onEdit={handleEditOpen}
                  onDelete={setDeletingAgent}
                />
              ))}
            </div>
          ) : (
            <div className="py-32 text-center bg-white border border-dashed border-gray-200 rounded-[3rem]">
              <h3 className="text-3xl font-bold text-gray-900 tracking-tight">
                No matching associates found
              </h3>
            </div>
          )}
        </div>
      </div>

      {/* Edit Agent Modal */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            onClick={() => setEditingAgent(null)}
          />
          <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Edit Agent</h2>
              <button
                onClick={() => setEditingAgent(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Role
                </label>
                <input
                  type="text"
                  value={editForm.role}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Department
                </label>
                <select
                  value={editForm.department}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, department: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Hourly Rate
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.hourlyRate}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      hourlyRate: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Description
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setEditingAgent(null)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            onClick={() => setDeletingAgent(null)}
          />
          <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={28} className="text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Delete Agent</h2>
              <p className="text-sm text-gray-500">
                Are you sure you want to delete{" "}
                <span className="font-bold text-gray-900">{deletingAgent.name}</span>? This action
                cannot be undone.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeletingAgent(null)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-all"
              >
                Delete Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
