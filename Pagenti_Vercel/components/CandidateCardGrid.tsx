import React from "react";
import { Link } from "react-router-dom";
import { DigitalAssociate } from "../types";
import { useI18n } from "../I18nContext";
import { Zap, ShieldCheck, Pencil, Trash2 } from "lucide-react";
import { DEPARTMENT_COLORS } from "../constants";

interface Props {
  candidate: DigitalAssociate;
  isSelected?: boolean;
  onEdit?: (candidate: DigitalAssociate) => void;
  onDelete?: (candidate: DigitalAssociate) => void;
}

export const CandidateCardGrid: React.FC<Props> = ({ candidate, isSelected, onEdit, onDelete }) => {
  const { formatPrice, t, tl } = useI18n();
  const deptStyle =
    DEPARTMENT_COLORS[candidate.department] || DEPARTMENT_COLORS["Legal & Compliance"];
  const localizedRole = tl(candidate.role);
  const localizedDesc = tl(candidate.description);

  return (
    <div
      className={`group bg-white border rounded-3xl overflow-hidden hover:shadow-2xl transition-all duration-500 flex flex-col h-full relative ${isSelected ? "border-indigo-600 ring-2 ring-indigo-50" : "border-gray-100 hover:border-indigo-400"}`}
    >
      <Link to={`/candidate/${candidate.id}`} className="flex flex-col h-full">
        <div className={`relative h-64 overflow-hidden bg-gray-900 digital-portrait`}>
          <div className={`absolute inset-0 z-10 ${deptStyle.tint}`}></div>
          <img
            src={candidate.avatar}
            alt={candidate.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
          />
          {candidate.aresCertification?.status === "certified" && (
            <div className="absolute top-4 left-4 z-20 bg-indigo-600 text-white px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-xl border border-indigo-400/30 backdrop-blur-md">
              <ShieldCheck size={14} className="text-indigo-200" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Ares Certified
              </span>
            </div>
          )}
        </div>
        <div className="p-8 flex-grow flex flex-col">
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{candidate.name}</h3>
            <p
              className={`text-[10px] font-bold ${deptStyle.text} uppercase tracking-[0.2em] mb-2`}
            >
              {t(deptStyle.key)}
            </p>
            <p className="text-base font-semibold text-gray-900 tracking-tight">{localizedRole}</p>
          </div>
          <p className="text-sm text-gray-500 line-clamp-2 mb-8 leading-relaxed font-medium">
            {localizedDesc}
          </p>
          <div className="mt-auto flex items-center justify-between pt-6 border-t border-gray-100">
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 font-bold uppercase mb-0.5">Recruit From</span>
              <span className="text-lg font-bold text-gray-900">
                {formatPrice(candidate.hourlyRate)}/hr
              </span>
            </div>
            <div className="text-indigo-600 flex items-center gap-2 font-bold text-sm bg-indigo-50 px-4 py-2 rounded-full hover:bg-indigo-600 hover:text-white transition-all">
              {t("recruit")} <Zap size={14} fill="currentColor" />
            </div>
          </div>
        </div>
      </Link>

      {/* Edit / Delete Actions */}
      {(onEdit || onDelete) && (
        <div className="absolute top-4 right-4 z-20 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {onEdit && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(candidate);
              }}
              className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-gray-200 flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-all shadow-sm"
              title="Edit agent"
            >
              <Pencil size={13} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(candidate);
              }}
              className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-gray-200 flex items-center justify-center text-gray-500 hover:text-red-600 hover:border-red-300 transition-all shadow-sm"
              title="Delete agent"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
