import { useRoute } from "wouter";
import StrataWorkspace from "./StrataWorkspace";

export default function PackagingPage() {
  const [, params] = useRoute("/prospect/:id/underwriting/packaging");
  const prospectId = params?.id ? parseInt(params.id) : 0;
  return <StrataWorkspace prospectId={prospectId} />;
}
