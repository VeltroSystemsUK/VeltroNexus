import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  APPLICATION_SECTIONS,
  DIRECTOR_SECTIONS,
  type ApplicationAnswers,
  type ApplicationDirector,
  type ApplicationFieldDef,
} from "@shared/applicationDataFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type ApplicationPayload = {
  answers: ApplicationAnswers;
  directors: ApplicationDirector[];
  status?: string;
  signed?: boolean;
  signedName?: string;
  sentAt?: string;
  signedAt?: string;
};

function Field({
  field,
  value,
  onChange,
}: {
  field: ApplicationFieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `app-${field.id}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {field.label}
        {field.required ? " *" : ""}
      </Label>
      {field.note ? <p className="text-[11px] text-muted-foreground">{field.note}</p> : null}
      {field.type === "textarea" ? (
        <Textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} data-testid={`app-field-${field.id}`} />
      ) : field.type === "select" ? (
        <select
          id={id}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-testid={`app-field-${field.id}`}
        >
          <option value="">Select…</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : field.type === "yesno" ? (
        <select
          id={id}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-testid={`app-field-${field.id}`}
        >
          <option value="">Select…</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      ) : (
        <Input
          id={id}
          type={field.type === "number" || field.type === "currency" ? "text" : field.type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-testid={`app-field-${field.id}`}
        />
      )}
    </div>
  );
}

export function ApplicationCompanyPanel({ prospectId }: { prospectId: number }) {
  const { data } = useQuery<ApplicationPayload>({
    queryKey: [`/api/prospects/${prospectId}/application`],
  });
  const [answers, setAnswers] = useState<ApplicationAnswers>({});
  const [open, setOpen] = useState<string | null>("company");

  useEffect(() => {
    if (data?.answers) setAnswers(data.answers);
  }, [data?.answers]);

  const save = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/prospects/${prospectId}/application`, "PUT", {
        answers,
        directors: data?.directors || [],
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/application`] }),
  });

  return (
    <Card className="mb-6" data-testid="application-company-panel">
      <CardHeader>
        <CardTitle>Application — business</CardTitle>
        <CardDescription>
          David fills what Nexus already knows. Blanks go to the customer to complete and e-sign.
          {data?.signed ? ` Signed by ${data.signedName}.` : data?.sentAt ? " Sent to the customer." : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {APPLICATION_SECTIONS.map((section) => (
          <details key={section.id} open={open === section.id} onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && setOpen(section.id)}>
            <summary className="cursor-pointer text-sm font-semibold py-2">{section.title}</summary>
            <div className="grid sm:grid-cols-2 gap-3 pb-3">
              {section.fields.map((field) => (
                <div key={field.id} className={field.type === "textarea" ? "sm:col-span-2" : undefined}>
                  <Field
                    field={field}
                    value={answers[field.id] || ""}
                    onChange={(v) => setAnswers((prev) => ({ ...prev, [field.id]: v }))}
                  />
                </div>
              ))}
            </div>
          </details>
        ))}
        <Button type="button" onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-application-company">
          {save.isPending ? "Saving…" : "Save application fields"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ApplicationDirectorPanel({
  prospectId,
  contactId,
  contactName,
}: {
  prospectId: number;
  contactId: number;
  contactName: string;
}) {
  const { data } = useQuery<ApplicationPayload>({
    queryKey: [`/api/prospects/${prospectId}/application`],
  });
  const directorId = `c${contactId}`;
  const [director, setDirector] = useState<ApplicationDirector>({ id: directorId });

  useEffect(() => {
    const found = data?.directors?.find((row) => row.id === directorId || row.fullName === contactName);
    if (found) setDirector({ ...found, id: directorId });
    else setDirector((prev) => ({ ...prev, id: directorId, fullName: prev.fullName || contactName }));
  }, [data?.directors, directorId, contactName]);

  const save = useMutation({
    mutationFn: async () => {
      const others = (data?.directors || []).filter((row) => row.id !== directorId && row.fullName !== contactName);
      await apiRequest(`/api/prospects/${prospectId}/application`, "PUT", {
        answers: data?.answers || {},
        directors: [...others, director],
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/application`] }),
  });

  return (
    <details className="rounded-md border p-3" data-testid={`application-director-${contactId}`}>
      <summary className="cursor-pointer text-sm font-semibold">Application details — {contactName}</summary>
      <div className="space-y-4 pt-3">
        {DIRECTOR_SECTIONS.map((section) => (
          <div key={section.id} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {section.fields.map((field) => (
                <div key={field.id} className={field.type === "textarea" ? "sm:col-span-2" : undefined}>
                  <Field
                    field={field}
                    value={director[field.id] || ""}
                    onChange={(v) => setDirector((prev) => ({ ...prev, [field.id]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        <Button type="button" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save director application fields"}
        </Button>
      </div>
    </details>
  );
}
