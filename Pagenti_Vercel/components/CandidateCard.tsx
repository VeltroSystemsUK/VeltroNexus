import React from "react";
import { DigitalAssociate } from "../types";
import { CandidateCardGrid } from "./CandidateCardGrid";
import { CandidateCardList } from "./CandidateCardList";

interface Props {
  candidate: DigitalAssociate;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  showCheckbox?: boolean;
  viewMode?: "grid" | "list";
  onEdit?: (candidate: DigitalAssociate) => void;
  onDelete?: (candidate: DigitalAssociate) => void;
}

export const CandidateCard: React.FC<Props> = ({
  candidate,
  isSelected,
  onSelect,
  showCheckbox,
  viewMode = "grid",
  onEdit,
  onDelete,
}) => {
  if (viewMode === "list") {
    return (
      <CandidateCardList
        candidate={candidate}
        isSelected={isSelected}
        onSelect={onSelect}
        showCheckbox={showCheckbox}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
  }

  return (
    <CandidateCardGrid
      candidate={candidate}
      isSelected={isSelected}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
};
