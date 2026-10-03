import { zodResolver } from "@hookform/resolvers/zod";
import { CreateReadingInputSchema } from "@sesb/contracts";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiClientError } from "../../lib/api.js";
import { fromKuchingInput, kuchingInputParts } from "../../lib/datetime.js";

const formSchema = z.object({
  valueKwh: CreateReadingInputSchema.shape.valueKwh,
  backdate: z.boolean(),
  date: z.string(),
  time: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

export function ReadingForm({ onSave }: { onSave: (input: { valueKwh: string; captureTimestamp: string }) => Promise<void> }) {
  const current = kuchingInputParts();
  const [saved, setSaved] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { valueKwh: "", backdate: false, ...current } });
  const backdate = form.watch("backdate");
  const submit = form.handleSubmit(async (values) => {
    setSaved(false);
    const now = new Date();
    const captureTimestamp = values.backdate ? fromKuchingInput(values.date, values.time) : now.toISOString();
    if (new Date(captureTimestamp) > now) {
      form.setError("date", { message: "Choose the current time or a past date and time" });
      return;
    }
    try {
      await onSave({ valueKwh: values.valueKwh, captureTimestamp });
      form.reset({ valueKwh: "", backdate: false, ...kuchingInputParts() });
      setSaved(true);
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.fields?.valueKwh) form.setError("valueKwh", { message: error.fields.valueKwh });
        if (error.fields?.captureTimestamp) form.setError("date", { message: error.fields.captureTimestamp });
        form.setError("root", { message: error.message });
      } else form.setError("root", { message: "Unable to save the reading" });
    }
  });
  return <form className="form-card reading-form" onSubmit={submit}>
    <div className="form-title"><div><p className="eyebrow">Meter entry</p><h2>Add reading</h2></div><span className="unit-pill">kWh</span></div>
    {saved && <div className="success" role="status">Reading saved</div>}
    {form.formState.errors.root && <div className="alert" role="alert">{form.formState.errors.root.message}</div>}
    <label>Meter reading (kWh)<input aria-label="Meter reading (kWh)" inputMode="decimal" {...form.register("valueKwh")} placeholder="00000.0" />{form.formState.errors.valueKwh && <small className="field-error">{form.formState.errors.valueKwh.message}</small>}</label>
    <label className="check-row"><input aria-label="Backdate reading" type="checkbox" {...form.register("backdate")} /><span><strong>Backdate reading</strong><small>Choose when this reading was captured</small></span></label>
    {backdate && <div className="date-grid">
      <label>Reading date<input aria-label="Reading date" type="date" max={current.date} {...form.register("date")} />{form.formState.errors.date && <small className="field-error">{form.formState.errors.date.message}</small>}</label>
      <label>Reading time<input aria-label="Reading time" type="time" {...form.register("time")} /></label>
    </div>}
    <button className="button full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving reading…" : "Save reading"}</button>
  </form>;
}
