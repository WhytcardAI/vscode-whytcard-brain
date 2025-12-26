import { normalizeForSearch } from "../core/brainDbCore";

export interface DeduplicateDocInput {
  id?: number;
  library: string;
  topic: string;
  title: string;
  content: string;
  version?: string;
  url?: string;
  category?: string;
  created_at?: string;
}

export type DeduplicateDocsStats = {
  candidateGroups: number;
  safeGroups: number;
  conflictGroups: number;
  totalCandidateDocs: number;
  totalSafeDeletions: number;
};

export type DeduplicateDocsPlan = {
  report: string;
  deleteIds: number[];
  stats: DeduplicateDocsStats;
};

type DedupKey = string;

function makeMetaKey(d: DeduplicateDocInput): DedupKey {
  const libraryKey = normalizeForSearch(d.library || "");
  const topicKey = (d.topic || "").trim().toLowerCase();
  const titleKey = (d.title || "").trim().toLowerCase();
  const categoryKey = ((d.category || "documentation") as string).trim().toLowerCase();
  return `meta::${categoryKey}::${libraryKey}::${topicKey}::${titleKey}`;
}

function makeUrlKey(d: DeduplicateDocInput): DedupKey | null {
  const url = typeof d.url === "string" ? d.url.trim() : "";
  if (!url) {
    return null;
  }
  return `url::${url}`;
}

function makeSafeSignature(d: DeduplicateDocInput): string {
  const urlKey = typeof d.url === "string" ? d.url.trim() : "";
  const categoryKey = ((d.category || "documentation") as string).trim().toLowerCase();
  const libraryKey = normalizeForSearch(d.library || "");
  const topicKey = (d.topic || "").trim();
  const titleKey = (d.title || "").trim();
  const versionKey = (d.version || "").trim();
  const contentKey = d.content || "";
  return `${categoryKey}::${libraryKey}::${topicKey}::${titleKey}::${versionKey}::${urlKey}::${contentKey}`;
}

function sortNewestFirst(a: DeduplicateDocInput, b: DeduplicateDocInput): number {
  const ta = a.created_at ? Date.parse(a.created_at) : Number.NaN;
  const tb = b.created_at ? Date.parse(b.created_at) : Number.NaN;
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) {
    return tb - ta;
  }
  if (!Number.isNaN(ta) && Number.isNaN(tb)) return -1;
  if (Number.isNaN(ta) && !Number.isNaN(tb)) return 1;
  return (b.id || 0) - (a.id || 0);
}

export function buildDeduplicateDocsPlan(docs: DeduplicateDocInput[]): DeduplicateDocsPlan {
  const groups = new Map<DedupKey, DeduplicateDocInput[]>();
  for (const d of docs) {
    const key = makeUrlKey(d) || makeMetaKey(d);
    const arr = groups.get(key);
    if (arr) {
      arr.push(d);
    } else {
      groups.set(key, [d]);
    }
  }

  const candidateGroups = [...groups.values()].filter((g) => g.length > 1);

  const lines: string[] = [];
  lines.push(`# Brain - Deduplicate Docs (dry-run)`);
  lines.push("");
  lines.push(`Groupes candidats: ${candidateGroups.length}`);
  lines.push("");

  let totalCandidateDocs = 0;
  let safeGroups = 0;
  let conflictGroups = 0;
  let totalSafeDeletions = 0;
  const deleteIds: number[] = [];

  for (const group of candidateGroups) {
    totalCandidateDocs += group.length;

    const bySignature = new Map<string, DeduplicateDocInput[]>();
    for (const d of group) {
      const sig = makeSafeSignature(d);
      const arr = bySignature.get(sig);
      if (arr) {
        arr.push(d);
      } else {
        bySignature.set(sig, [d]);
      }
    }

    const safeClusters = [...bySignature.values()].filter((cluster) => cluster.length > 1);
    const hasConflict = bySignature.size > 1;

    if (safeClusters.length === 0) {
      conflictGroups += 1;

      const headerKey =
        makeUrlKey(group[0]) !== null
          ? `URL: ${(group[0].url || "").trim()}`
          : `META: ${makeMetaKey(group[0])}`;
      lines.push(`## Groupe (${group.length} docs) - ${headerKey}`);
      lines.push(`- Conflit: aucune suppression automatique (variantes detectees).`);

      const sorted = [...group].sort(sortNewestFirst);
      for (const d of sorted) {
        lines.push(
          `  - Variant: id=${d.id ?? "?"} created_at=${d.created_at ?? "?"} title=${JSON.stringify(d.title)}`,
        );
      }
      lines.push("");
      continue;
    }

    safeGroups += 1;

    const headerKey =
      makeUrlKey(group[0]) !== null
        ? `URL: ${(group[0].url || "").trim()}`
        : `META: ${makeMetaKey(group[0])}`;
    lines.push(`## Groupe (${group.length} docs) - ${headerKey}`);

    if (hasConflict) {
      lines.push(
        `- Conflit: ce groupe contient plusieurs variantes (metadata/content differents).`,
      );
    }

    for (const cluster of safeClusters) {
      const sorted = [...cluster].sort(sortNewestFirst);
      const keep = sorted[0];
      const del = sorted.slice(1);
      totalSafeDeletions += del.length;

      lines.push(
        `- Keep: id=${keep.id ?? "?"} created_at=${keep.created_at ?? "?"} title=${JSON.stringify(
          keep.title,
        )}`,
      );
      for (const d of del) {
        lines.push(
          `  - Delete: id=${d.id ?? "?"} created_at=${d.created_at ?? "?"} title=${JSON.stringify(d.title)}`,
        );
        if (typeof d.id === "number") {
          deleteIds.push(d.id);
        }
      }
    }

    lines.push("");
  }

  lines.push(`Docs impliquees: ${totalCandidateDocs}`);
  lines.push(`Groupes avec doublons supprimables: ${safeGroups}`);
  lines.push(`Groupes en conflit (non modifies): ${conflictGroups}`);
  lines.push(`Total a supprimer (doublons strictement identiques): ${totalSafeDeletions}`);

  return {
    report: lines.join("\n"),
    deleteIds,
    stats: {
      candidateGroups: candidateGroups.length,
      safeGroups,
      conflictGroups,
      totalCandidateDocs,
      totalSafeDeletions,
    },
  };
}
