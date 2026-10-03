import { zodResolver } from "@hookform/resolvers/zod";
import { CreateHouseInputSchema, type CreateHouseInput } from "@sesb/contracts";
import { useForm } from "react-hook-form";
import { ApiClientError } from "../../lib/api.js";

type Props = {
  initial?: Partial<CreateHouseInput>;
  submitLabel: string;
  hideMeter?: boolean;
  onSubmit: (values: CreateHouseInput) => Promise<void>;
};

export function HouseForm({ initial, submitLabel, hideMeter, onSubmit }: Props) {
  const form = useForm<CreateHouseInput>({
    resolver: zodResolver(CreateHouseInputSchema),
    defaultValues: { name: "", address: "", notes: "", meterLabel: "", ...initial },
  });
  const submit = form.handleSubmit(async (values) => {
    try { await onSubmit(values); }
    catch (error) {
      if (error instanceof ApiClientError) {
        Object.entries(error.fields ?? {}).forEach(([name, message]) => form.setError(name as keyof CreateHouseInput, { message }));
        form.setError("root", { message: error.message });
      } else form.setError("root", { message: "Unable to save the house" });
    }
  });
  return <form className="form-card" onSubmit={submit}>
    {form.formState.errors.root && <div className="alert" role="alert">{form.formState.errors.root.message}</div>}
    <label>House name<input autoFocus {...form.register("name")} placeholder="e.g. Family home" />{form.formState.errors.name && <small className="field-error">{form.formState.errors.name.message}</small>}</label>
    <label>Address <span className="optional">Optional</span><textarea {...form.register("address")} rows={2} /></label>
    <label>Notes <span className="optional">Optional</span><textarea {...form.register("notes")} rows={3} /></label>
    {!hideMeter && <label>Meter label<input {...form.register("meterLabel")} placeholder="e.g. SESB-01" />{form.formState.errors.meterLabel && <small className="field-error">{form.formState.errors.meterLabel.message}</small>}</label>}
    <button className="button full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving…" : submitLabel}</button>
  </form>;
}
