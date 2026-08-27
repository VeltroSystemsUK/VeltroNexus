import { queryClient } from "@/lib/queryClient";

export async function storeProspectFile(
  prospectId: number,
  file: File,
  category: string,
): Promise<void> {
  const formData = new FormData();
  formData.append("category", category);
  formData.append("file", file);
  const response = await fetch(`/api/prospects/${prospectId}/documents`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(error.error || "Upload failed");
  }
  await queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/documents`] });
  await queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/due-diligence`] });
}
