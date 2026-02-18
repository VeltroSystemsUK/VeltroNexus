import React from "react";
import { Link } from "react-router-dom";
import { DigitalAssociate } from "../types";
import { useI18n } from "../I18nContext";
import { Terminal, Zap, CheckCircle2, Timer, ShieldCheck, Pencil, Trash2 } from "lucide-react";
import {
  DEPARTMENT_COLORS,
  HUMAN_HOURLY_RATE,
  HUMAN_HOURS_PER_MONTH,
  DIGITAL_HOURS_PER_MONTH,
} from "../constants";

interface Props {
  candidate: DigitalAssociate;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  showCheckbox?: boolean;
  onEdit?: (candidate: DigitalAssociate) => void;
  onDelete?: (candidate: DigitalAssociate) => void;
}

export const CandidateCardList: React.FC<Props> = ({
  candidate,
  isSelected,
  onSelect,
  showCheckbox,
  onEdit,
  onDelete,
}) => {
  const { formatPrice, t, tl, convertPrice, currencySymbol } = useI18n();

  const humanMonthlyCost = HUMAN_HOURLY_RATE * HUMAN_HOURS_PER_MONTH;
  const digitalMonthlyCost = candidate.hourlyRate * DIGITAL_HOURS_PER_MONTH;
  const capitalReclaimed = humanMonthlyCost - digitalMonthlyCost;

  const tempHourlyRate = candidate.hourlyRate * 10;
  const deptStyle =
    DEPARTMENT_COLORS[candidate.department] || DEPARTMENT_COLORS["Legal & Compliance"];
  const localizedRole = tl(candidate.role);
  const localizedDesc = tl(candidate.description);
  const localizedExpertise = tl(candidate.expertise);

  return (
    <div
      className={`group glass-card rounded-[2rem] overflow-hidden transition-all duration-300 relative ${isSelected ? "border-indigo-600 ring-4 ring-indigo-50 bg-white/90 scale-[1.02]" : "hover:border-indigo-300"}`}
    >
      {/* Checkbox Button - Moved OUTSIDE the Link for valid HTML */}
      {showCheckbox && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelect?.(candidate.id);
          }}
          className={`absolute top-4 left-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all z-20 ${isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white/50 border-white/80"}`}
          aria-label={isSelected ? "Deselect candidate" : "Select candidate"}
        >
          {isSelected && <CheckCircle2 size={14} />}
        </button>
      )}

      <Link
        to={`/candidate/${candidate.id}`}
        className="flex flex-col md:flex-row items-stretch min-h-[180px]"
      >
        <div
          className={`md:w-56 h-48 md:h-auto relative overflow-hidden flex-shrink-0 bg-gray-900 digital-portrait`}
        >
          <div className={`absolute inset-0 z-10 ${deptStyle.tint}`}></div>
          <img
            src={candidate.avatar}
            alt={candidate.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          {candidate.aresCertification?.status === "certified" && (
            <div className="absolute top-4 right-4 z-20 bg-indigo-600 text-white px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-xl border border-indigo-400/30 backdrop-blur-md">
              <ShieldCheck size={14} className="text-indigo-200" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Ares Certified
              </span>
            </div>
          )}
        </div>

        <div className="flex-grow p-6 flex flex-col justify-between">
          <div className="flex flex-col lg:flex-row justify-between gap-4">
            <div className="max-w-xl">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-xl font-bold text-gray-900">{candidate.name}</h3>
                <span
                  className={`text-[9px] font-bold ${deptStyle.text} ${deptStyle.light} px-2 py-0.5 rounded uppercase tracking-widest border ${deptStyle.border}`}
                >
                  ID: {candidate.id.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`text-[10px] font-bold ${deptStyle.text} uppercase tracking-widest`}
                >
                  {t(deptStyle.key)}
                </span>
                <span className="text-gray-300">•</span>
                <span className="text-sm font-semibold text-gray-700">{localizedRole}</span>
              </div>
              <p className="text-sm text-gray-500 line-clamp-2 mb-4 font-medium">{localizedDesc}</p>
              <div className="flex flex-wrap gap-2">
                {localizedExpertise.map((skill, i) => (
                  <span
                    key={i}
                    className={`text-[10px] font-bold ${deptStyle.text} uppercase tracking-tight`}
                  >
                    #{skill.replace(/\s+/g, "")}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-between lg:items-end text-right min-w-[200px]">
              <div className="flex flex-wrap lg:justify-end gap-1.5 mb-4">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Recruit From
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    {formatPrice(candidate.hourlyRate)}/hr
                  </span>
                </div>
                <div className="h-8 w-[1px] bg-gray-100 mx-2"></div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-amber-500 uppercase mb-1 flex items-center gap-1">
                    <Timer size={10} /> Temp Task
                  </span>
                  <span className="text-lg font-bold text-amber-600">
                    {formatPrice(tempHourlyRate)}/hr
                  </span>
                </div>
              </div>
              <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                {t("reclaim")} {currencySymbol}
                {Math.floor(convertPrice(capitalReclaimed)).toLocaleString()}/mo
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Terminal size={12} className={deptStyle.text} />
              <span className="text-[9px] font-mono font-bold text-gray-300 uppercase tracking-widest">
                Live Flow
              </span>
            </div>
            <div className="flex-grow h-4 overflow-hidden text-[10px] font-mono text-gray-400">
              <div className="animate-scroll-up space-y-1">
                <div>» {t("activeSearch")}...</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit(candidate);
                  }}
                  className="flex items-center gap-1.5 text-gray-400 hover:text-indigo-600 font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-all"
                  title="Edit agent"
                >
                  <Pencil size={12} /> Edit
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(candidate);
                  }}
                  className="flex items-center gap-1.5 text-gray-400 hover:text-red-600 font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all"
                  title="Delete agent"
                >
                  <Trash2 size={12} /> Delete
                </button>
              )}
              <div className="text-indigo-600 flex items-center gap-2 font-bold text-xs bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-600 hover:text-white transition-all">
                {t("recruit")} <Zap size={12} fill="currentColor" />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};
