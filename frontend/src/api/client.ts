import axios from "axios";

import type { LabelDoc } from "@/types/labelSchema";

const api = axios.create({ baseURL: "/api" });

export async function listDocuments(): Promise<LabelDoc[]> {
  const res = await api.get<LabelDoc[]>("/documents");
  return res.data;
}

export async function getDocument(id: string): Promise<LabelDoc> {
  const res = await api.get<LabelDoc>(`/documents/${id}`);
  return res.data;
}

export async function saveDocument(doc: LabelDoc): Promise<LabelDoc> {
  const res = await api.put<LabelDoc>(`/documents/${doc.id}`, doc);
  return res.data;
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/documents/${id}`);
}

export async function compileLabel(doc: LabelDoc, quantity = 1): Promise<string> {
  const res = await api.post<{ zpl: string }>("/compile", doc, { params: { quantity } });
  return res.data.zpl;
}

export interface PrinterQueue {
  name: string;
  device_uri: string;
}

export async function listPrinters(): Promise<{ queues: PrinterQueue[]; default_queue_name: string | null }> {
  const res = await api.get("/printers");
  return res.data;
}

export interface PrintJobResult {
  job_id: string;
  queue_name: string;
  zpl: string;
}

export async function submitPrintJob(label: LabelDoc, queueName?: string, quantity = 1): Promise<PrintJobResult> {
  const res = await api.post<PrintJobResult>("/print_jobs", { label, queue_name: queueName, quantity });
  return res.data;
}

export async function getPrintJobStatus(jobId: string): Promise<{ job_id: string; status: string }> {
  const res = await api.get(`/print_jobs/${encodeURIComponent(jobId)}`);
  return res.data;
}
