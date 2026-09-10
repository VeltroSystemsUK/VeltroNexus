import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { BulletList } from "@/components/BulletField";

export type SavedCompanyProfile = {
  businessProfile?: string;
  keyPeople?: { name: string; role?: string }[];
  sourceCommentary?: string;
  sources?: { url: string; title?: string }[];
};

export function profileFromResearch(research: unknown): SavedCompanyProfile | null {
  if (!research || typeof research !== "object") return null;
  const rec = research as SavedCompanyProfile;
  if (!String(rec.businessProfile || "").trim()) return null;
  return rec;
}

export function AiCompanyProfileCard({
  profile,
  headerAction,
}: {
  profile: SavedCompanyProfile;
  headerAction?: ReactNode;
}) {
  return (
    <Card data-testid="card-ai-company-profile">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          AI company profile
        </CardTitle>
        {headerAction}
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="text-sm bg-muted/30 p-4 rounded-lg border"
          data-testid="text-ai-company-profile"
        >
          <BulletList text={profile.businessProfile} />
        </div>
      </CardContent>
    </Card>
  );
}
