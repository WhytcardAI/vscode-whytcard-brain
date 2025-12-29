import * as vscode from "vscode";
import { z } from "zod";
import { getBrainService, inferDomain, type Doc, type Template } from "../services/brainService";
import { type TemplateTreeItem } from "./templatesTreeProvider";
import { type BrainTreeItem, type DocCategory } from "./treeProviders";

const DOC_MIME = "application/vnd.whytcard-brain.doc";
const TEMPLATE_MIME = "application/vnd.whytcard-brain.template";

const idsArraySchema = z.array(z.coerce.number().int().positive()).min(1);

type TemplateDragPayload = { ids: number[] };

const docsTreeDragPayloadSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("doc"), ids: idsArraySchema }),
  z.object({
    kind: z.literal("topic"),
    items: z
      .array(
        z.object({
          library: z.string().trim().min(1),
          topic: z.string().trim().min(1),
        }),
      )
      .min(1),
  }),
  z.object({
    kind: z.literal("library"),
    libraries: z.array(z.string().trim().min(1)).min(1),
  }),
]);

type DocsTreeDragPayload = z.infer<typeof docsTreeDragPayloadSchema>;

function getEffectiveDomain(doc: Pick<Doc, "library" | "domain">): string {
  const raw = (doc.domain || "").trim();
  if (!raw || raw === "general") {
    return inferDomain(doc.library);
  }
  return raw;
}

function safeJsonParse(payload: string): unknown {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
}

function safeJsonParsePossiblyNested(payload: string): unknown {
  const first = safeJsonParse(payload);
  if (typeof first === "string") {
    return safeJsonParse(first);
  }
  return first;
}

function extractIdsFromRawString(raw: string): number[] | null {
  const parsed = safeJsonParsePossiblyNested(raw);

  // Common structured payloads
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;

    if ("ids" in obj) {
      const ids = idsArraySchema.safeParse(obj.ids);
      return ids.success ? ids.data : null;
    }

    if ("id" in obj) {
      const single = z.coerce.number().int().positive().safeParse(obj.id);
      return single.success ? [single.data] : null;
    }
  }

  // If the payload is just an array
  if (Array.isArray(parsed)) {
    const ids = idsArraySchema.safeParse(parsed);
    return ids.success ? ids.data : null;
  }

  // Fallback: treat raw as CSV-ish list of numbers ("1,2,3" or "1 2 3")
  const trimmed = (raw || "").trim();
  if (trimmed.length > 0) {
    const parts = trimmed.split(/[\s,;]+/g).filter(Boolean);
    if (parts.length > 0) {
      const ids = idsArraySchema.safeParse(parts);
      return ids.success ? ids.data : null;
    }
  }

  return null;
}

function extractDocsTreePayloadFromRawString(raw: string): DocsTreeDragPayload | null {
  const parsed = safeJsonParsePossiblyNested(raw);
  const res = docsTreeDragPayloadSchema.safeParse(parsed);
  if (res.success) {
    return res.data;
  }

  // Backward-compatible fallback: accept legacy { ids: [...] }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    if ("ids" in obj) {
      const ids = idsArraySchema.safeParse(obj.ids);
      if (ids.success) {
        return { kind: "doc", ids: ids.data };
      }
    }
  }

  return null;
}

export class DocsDragAndDropController implements vscode.TreeDragAndDropController<BrainTreeItem> {
  public readonly dragMimeTypes: readonly string[] = [DOC_MIME];
  public readonly dropMimeTypes: readonly string[] = [DOC_MIME];

  public constructor(
    private readonly opts: {
      category: DocCategory;
      refresh: () => void;
    },
  ) {}

  public handleDrag(
    source: readonly BrainTreeItem[],
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ): void {
    // Docs
    if (source.every((s) => s?.contextValue === "doc" && typeof s.entryId === "number")) {
      const ids = source
        .filter((s) => typeof s.entryId === "number")
        .map((s) => s.entryId as number);

      if (ids.length === 0) {
        return;
      }

      const payload: DocsTreeDragPayload = { kind: "doc", ids };
      dataTransfer.set(DOC_MIME, new vscode.DataTransferItem(JSON.stringify(payload)));
      return;
    }

    // Topics
    if (source.every((s) => s?.contextValue === "topic" && !!s.libraryName && !!s.topicName)) {
      const items = source
        .filter((s) => !!s.libraryName && !!s.topicName)
        .map((s) => ({ library: s.libraryName as string, topic: s.topicName as string }));

      if (items.length === 0) {
        return;
      }

      const payload: DocsTreeDragPayload = { kind: "topic", items };
      dataTransfer.set(DOC_MIME, new vscode.DataTransferItem(JSON.stringify(payload)));
      return;
    }

    // Libraries
    if (source.every((s) => s?.contextValue === "library" && !!s.libraryName)) {
      const libraries = source.filter((s) => !!s.libraryName).map((s) => s.libraryName as string);

      if (libraries.length === 0) {
        return;
      }

      const payload: DocsTreeDragPayload = { kind: "library", libraries };
      dataTransfer.set(DOC_MIME, new vscode.DataTransferItem(JSON.stringify(payload)));
      return;
    }
  }

  public async handleDrop(
    target: BrainTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken,
  ): Promise<void> {
    if (token.isCancellationRequested) {
      return;
    }

    const item = dataTransfer.get(DOC_MIME);
    if (!item) {
      return;
    }

    const raw = await item.asString();
    const payload = extractDocsTreePayloadFromRawString(raw);
    if (!payload) {
      const mimeTypes = Array.from(dataTransfer).map(([mime]) => mime);
      console.warn("WhytCard Brain DnD: invalid doc payload", { raw, mimeTypes });
      vscode.window.showWarningMessage(
        "Drag'n'drop: données non reconnues. Réessaie en déplaçant un doc à l'intérieur de la même vue.",
      );
      return;
    }

    const destination = await this.resolveDestination(target);
    if (!destination) {
      return;
    }

    const service = getBrainService();

    let moved = 0;
    let skipped = 0;
    let failed = 0;

    const applyDocMove = (
      docId: number,
      doc: Doc,
      base: Partial<Omit<Doc, "id" | "created_at">>,
    ): void => {
      const updates: Partial<Omit<Doc, "id" | "created_at">> = { ...base };

      // Category: keep view's category (DnD is intra-view)
      const currentCategory = (doc.category || "documentation") as DocCategory;
      if (currentCategory !== this.opts.category) {
        updates.category = this.opts.category;
      }

      if (destination.library !== undefined && destination.library !== doc.library) {
        updates.library = destination.library;
      }

      if (destination.topic !== undefined && destination.topic !== doc.topic) {
        updates.topic = destination.topic;
      }

      if (destination.domain !== undefined) {
        const nextLibrary = updates.library ?? doc.library;
        const nextDomainEffective = getEffectiveDomain({
          library: nextLibrary,
          domain: destination.domain,
        });

        const currentEffective = getEffectiveDomain({ library: doc.library, domain: doc.domain });
        // If domain drop doesn't change where it appears in the tree, don't write.
        if (
          nextDomainEffective !== currentEffective ||
          destination.domain !== (doc.domain || null)
        ) {
          updates.domain = destination.domain;
        }
      }

      // No actual change => don't report as failure
      if (Object.keys(updates).length === 0) {
        skipped += 1;
        return;
      }

      const ok = service.updateDoc(docId, updates);
      if (ok) {
        moved += 1;
      } else {
        failed += 1;
      }
    };

    if (payload.kind === "doc") {
      for (const id of payload.ids) {
        if (token.isCancellationRequested) {
          break;
        }

        const doc = service.getDocById(id);
        if (!doc) {
          failed += 1;
          continue;
        }

        applyDocMove(id, doc, {});
      }
    }

    if (payload.kind === "topic") {
      const allDocs = service
        .getAllDocs()
        .filter((d) => (d.category || "documentation") === this.opts.category);

      for (const t of payload.items) {
        if (token.isCancellationRequested) {
          break;
        }

        const topicDocs = allDocs.filter((d) => d.library === t.library && d.topic === t.topic);
        for (const doc of topicDocs) {
          if (token.isCancellationRequested) {
            break;
          }
          const id = doc.id;
          if (typeof id !== "number") {
            failed += 1;
            continue;
          }

          // If dropping a topic onto a topic/doc, we also merge (topic rename)
          const base: Partial<Omit<Doc, "id" | "created_at">> = {};
          if (destination.library !== undefined && destination.library !== doc.library) {
            base.library = destination.library;
          }
          if (destination.topic !== undefined && destination.topic !== doc.topic) {
            base.topic = destination.topic;
          }
          if (destination.domain !== undefined) {
            base.domain = destination.domain;
          }

          applyDocMove(id, doc, base);
        }
      }
    }

    if (payload.kind === "library") {
      const allDocs = service
        .getAllDocs()
        .filter((d) => (d.category || "documentation") === this.opts.category);

      for (const lib of payload.libraries) {
        if (token.isCancellationRequested) {
          break;
        }

        const libDocs = allDocs.filter((d) => d.library === lib);
        for (const doc of libDocs) {
          if (token.isCancellationRequested) {
            break;
          }
          const id = doc.id;
          if (typeof id !== "number") {
            failed += 1;
            continue;
          }

          const base: Partial<Omit<Doc, "id" | "created_at">> = {};
          if (destination.library !== undefined && destination.library !== doc.library) {
            base.library = destination.library;
          }
          if (destination.topic !== undefined && destination.topic !== doc.topic) {
            base.topic = destination.topic;
          }
          if (destination.domain !== undefined) {
            base.domain = destination.domain;
          }

          applyDocMove(id, doc, base);
        }
      }
    }

    if (moved > 0) {
      this.opts.refresh();
    }

    if (failed > 0) {
      vscode.window.showWarningMessage(
        `Déplacement terminé: ${moved} ok, ${skipped} inchangé, ${failed} échec(s).`,
      );
      return;
    }

    if (moved > 0) {
      vscode.window.showInformationMessage(`Déplacé: ${moved} doc(s).`);
    }
  }

  private async resolveDestination(target: BrainTreeItem | undefined): Promise<{
    domain?: string;
    library?: string;
    topic?: string;
  } | null> {
    if (!target) {
      vscode.window.showInformationMessage(
        "Dépose sur un Domaine / Library / Topic (pas sur le vide).",
      );
      return null;
    }

    if (target.contextValue === "domain") {
      if (!target.domainName) {
        vscode.window.showErrorMessage("DnD: domaine cible invalide.");
        return null;
      }
      return { domain: target.domainName };
    }

    if (target.contextValue === "library") {
      if (!target.libraryName) {
        vscode.window.showErrorMessage("DnD: library cible invalide.");
        return null;
      }
      return {
        domain: target.domainName,
        library: target.libraryName,
      };
    }

    if (target.contextValue === "topic") {
      if (!target.libraryName || !target.topicName) {
        vscode.window.showErrorMessage("DnD: topic cible invalide.");
        return null;
      }
      return {
        domain: target.domainName,
        library: target.libraryName,
        topic: target.topicName,
      };
    }

    if (target.contextValue === "doc") {
      const service = getBrainService();
      const doc = target.entryData ?? (target.entryId ? service.getDocById(target.entryId) : null);
      if (!doc) {
        vscode.window.showErrorMessage("DnD: doc cible introuvable.");
        return null;
      }

      return {
        domain: getEffectiveDomain({ library: doc.library, domain: doc.domain }),
        library: doc.library,
        topic: doc.topic,
      };
    }

    vscode.window.showInformationMessage("Dépose sur un Domaine / Library / Topic uniquement.");
    return null;
  }
}

export class TemplatesDragAndDropController implements vscode.TreeDragAndDropController<TemplateTreeItem> {
  public readonly dragMimeTypes: readonly string[] = [TEMPLATE_MIME];
  public readonly dropMimeTypes: readonly string[] = [TEMPLATE_MIME];

  public constructor(
    private readonly opts: {
      refresh: () => void;
    },
  ) {}

  public handleDrag(
    source: readonly TemplateTreeItem[],
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ): void {
    const ids = source
      .filter((s) => s?.contextValue === "template" && typeof s.templateId === "number")
      .map((s) => s.templateId as number);

    if (ids.length === 0) {
      return;
    }

    const payload: TemplateDragPayload = { ids };
    dataTransfer.set(TEMPLATE_MIME, new vscode.DataTransferItem(JSON.stringify(payload)));
  }

  public async handleDrop(
    target: TemplateTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken,
  ): Promise<void> {
    if (token.isCancellationRequested) {
      return;
    }

    const item = dataTransfer.get(TEMPLATE_MIME);
    if (!item) {
      return;
    }

    const raw = await item.asString();
    const ids = extractIdsFromRawString(raw);
    if (!ids || ids.length === 0) {
      const mimeTypes = Array.from(dataTransfer).map(([mime]) => mime);
      console.warn("WhytCard Brain DnD: invalid template payload", { raw, mimeTypes });
      vscode.window.showWarningMessage(
        "Drag'n'drop: données non reconnues. Réessaie en déplaçant un template à l'intérieur de la même vue.",
      );
      return;
    }

    const destination = this.resolveDestination(target);
    if (!destination) {
      return;
    }

    const service = getBrainService();

    let moved = 0;
    let skipped = 0;
    let failed = 0;

    for (const id of ids) {
      if (token.isCancellationRequested) {
        break;
      }

      const template = service.getTemplateById(id);
      if (!template) {
        failed += 1;
        continue;
      }

      const updates: Partial<Template> = {};

      if (
        destination.framework !== undefined &&
        destination.framework !== (template.framework || "general")
      ) {
        updates.framework = destination.framework;
      }

      if (destination.type !== undefined && destination.type !== template.type) {
        updates.type = destination.type;
      }

      if (Object.keys(updates).length === 0) {
        skipped += 1;
        continue;
      }

      const ok = service.updateTemplate(id, updates);
      if (ok) {
        moved += 1;
      } else {
        failed += 1;
      }
    }

    if (moved > 0) {
      this.opts.refresh();
    }

    if (failed > 0) {
      vscode.window.showWarningMessage(
        `Déplacement terminé: ${moved} ok, ${skipped} inchangé, ${failed} échec(s).`,
      );
      return;
    }

    if (moved > 0) {
      vscode.window.showInformationMessage(`Déplacé: ${moved} template(s).`);
    }
  }

  private resolveDestination(
    target: TemplateTreeItem | undefined,
  ): { framework?: string; type?: Template["type"] } | null {
    if (!target) {
      vscode.window.showInformationMessage("Dépose sur Framework / Type (pas sur le vide). ");
      return null;
    }

    if (target.contextValue === "framework") {
      if (!target.framework) {
        vscode.window.showErrorMessage("DnD: framework cible invalide.");
        return null;
      }
      return { framework: target.framework };
    }

    if (target.contextValue === "type") {
      if (!target.framework || !target.templateType) {
        vscode.window.showErrorMessage("DnD: type cible invalide.");
        return null;
      }
      return { framework: target.framework, type: target.templateType };
    }

    if (target.contextValue === "template") {
      if (!target.framework || !target.templateType) {
        // Fallback: try infer from data (should not happen)
        return null;
      }
      return { framework: target.framework, type: target.templateType };
    }

    vscode.window.showInformationMessage("Dépose sur Framework / Type uniquement.");
    return null;
  }
}
