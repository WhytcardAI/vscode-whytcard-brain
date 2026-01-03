# Audit – WhytCard Brain (objectif : autonomie totale)

Basé sur l’analyse **du code local du repo** (notamment `src/extension.ts`, `src/services/brainService.ts`, `src/tools/brainTools.ts`, `src/mcp-server.ts`, `src/views/webviewPanel.ts`, `src/views/settingsView.ts`, `scripts/*`, `docs/*`, `.github/*`, `.windsurf/*`, `.cursor/*`) et sur la doc interne `docs/MCP_ANALYSIS.md`.

## 0) Définition de “l’autonomie totale” pour ce projet

Dans le sens que tu demandes (“sans intervention humaine”), j’interprète l’objectif comme :

- **Zéro action manuelle** pour l’utilisateur au quotidien.
- **Zéro confirmation/validation UI** lors des opérations de base (sauvegarde doc, création de règles, etc.).
- **Auto-réparation** (auto-heal) dès qu’un élément requis disparaît (rules files, config MCP, etc.).
- **Garde-fous techniques** (pas seulement des “instructions”) : la policy doit être **enforcée par le code**.

> Note : une autonomie totale doit rester compatible avec les limites imposées par l’éditeur (permissions, Workspace Trust, policies Copilot/LM Tools). Certaines confirmations peuvent être imposées par la plateforme.

---

## 1) Points positifs (déjà alignés avec l’autonomie)

### 1.1 Activation et orchestration

- **Activation `onStartupFinished`** : l’extension est disponible tôt, sans action utilisateur.
- **Enregistrement des LM tools après connexion DB** : évite d’avoir des tools “cassés” au démarrage.

### 1.2 Base locale et portable

- **Stockage local** via `sql.js` (WASM) :
  - pas de dépendance native SQLite
  - portable sur Windows/macOS/Linux
  - cohérent pour l’IA (knowledge base locale)

### 1.3 Synchronisation multi-instance

- L’extension tente de se synchroniser avec d’autres instances (watch + reload + refresh périodique).

### 1.4 “Auto-setup” des règles (très orienté autonomie)

- Génération/mise à jour automatique de :
  - `.github/copilot-instructions.md`
  - `.cursor/rules/brain.mdc`
  - `.windsurf/rules/brain.md`
  - `AGENTS.md`
- Watchers pour **auto-heal** si fichiers modifiés/supprimés.

### 1.5 MCP Server robuste côté policy

- Côté MCP (`src/mcp-server.ts`) :
  - enforcement consult (`enforceConsult`) + TTL
  - strict mode + require sources possible
  - tests e2e de policy (`scripts/test-brain-policy.js`)

### 1.6 UI settings Webview saine

- `src/views/settingsView.ts` applique un **CSP strict** et réécrit les assets proprement.

---

## 2) Points négatifs (freins à l’autonomie totale)

### 2.1 Autonomie “incomplète” côté VS Code LM tools (policy non-enforcée)

- `src/tools/brainTools.ts` ne bloque pas techniquement `storeDoc/storePitfall/...` si `consult` n’a pas été appelé.
- En pratique, c’est **l’instruction file** qui force le comportement.
- Problème : l’IA peut “oublier” ou contourner → autonomie non garantie.

### 2.2 Confirmations possibles côté tools (anti-autonomie)

- Certains tools utilisent `prepareInvocation.confirmationMessages` (ex: sauvegarde doc/bug) : selon l’hôte IA, cela peut déclencher une **confirmation manuelle**.
- Pour une autonomie totale, ces confirmations doivent être **désactivables** (voire supprimées) ou basculées en mode “always”.

### 2.3 Concurrence/écrasement possible du fichier `brain.db`

- Extension VS Code et MCP server écrivent `brain.db` via export complet (`sql.js export()` puis `writeFileSync`).
- En cas d’écritures concurrentes, il existe un risque de **lost update** (écrasement silencieux).
- Pour l’autonomie, c’est critique : un système autonome doit être **résilient** aux conflits.

### 2.4 Sécurité Webview (bloquant potentiel)

- `src/views/webviewPanel.ts` rend `doc.content` via une pseudo-conversion markdown → HTML.
- Le contenu n’est pas “sanitizé” de manière robuste.
- Risque : si la DB contient du contenu injecté, le webview peut devenir un vecteur de **XSS**.
- Ce n’est pas directement “anti-autonomie”, mais c’est un risque qui peut forcer des restrictions et casser l’expérience.

### 2.5 Workspace Trust (écart doc/code)

- `SECURITY.md` indique des garde-fous Workspace Trust.
- Mais l’auto-écriture de fichiers dans le workspace (rules, AGENTS) ne semble pas conditionnée à `vscode.workspace.isTrusted`.
- En entreprise/secure environments, ça peut provoquer des blocages ou des policies internes → donc nuire à l’autonomie.

### 2.6 Dette de duplication (VS Code vs MCP)

- La logique est dupliquée (formatage réponses, schémas d’inputs, logique métier).
- Conséquence : évolution lente + risques d’incohérence.
- Pour un produit autonome, la cohérence “multi-hosts” est essentielle.

---

## 3) Propositions d’amélioration (orientées autonomie totale)

## 3.A – Priorité P0 (indispensable pour autonomie réelle)

### A1) Enforcement technique “consult obligatoire” côté VS Code (comme MCP)

Objectif : obtenir une garantie technique que le workflow est respecté.

- Implémenter une policy similaire à `enforceConsult()` pour les LM tools de `brainTools.ts` :
  - stocker un `lastConsultAt` + métriques (docs trouvés, docs avec URL)
  - bloquer `storeDoc`, `storePitfall`, `templateSave`, etc. si consult non fait ou non satisfaisant
  - TTL configurable (aligné sur `BRAIN_CONSULT_TTL_MS`)

Résultat : autonomie plus forte, moins dépendante du prompt.

### A2) Mode “no-human-confirmation”

Objectif : éliminer les confirmations interactionnelles.

- Ajouter un setting `whytcard-brain.autonomyMode` (ex: `off | standard | total`).
- En mode `total` :
  - supprimer/éviter les `confirmationMessages` dans `prepareInvocation`
  - éviter les `showWarningMessage` modaux bloquants pour les opérations automatiques (ou les rendre non-modaux / logs)
  - passer `autoSave` à `always` (déjà présent côté config) et l’appliquer réellement dans la logique “agent”

### A3) Sécuriser la concurrence d’écritures DB

Objectif : éviter la perte de données sans intervention.

Options (du plus simple au plus robuste) :

- **Option 1 (rapide)** : verrou fichier (`brain.db.lock`) + retry/backoff.
- **Option 2 (optimistic)** : vérifier `mtime` entre load et save → si changé, reload + rejouer la mutation.
- **Option 3 (architecture)** : un seul writer (service local), les autres clients passent par IPC (plus lourd).

### A4) Sécuriser `BrainWebviewPanel`

Objectif : éviter qu’un incident de contenu casse l’autonomie (et évite risques).

- Ajouter CSP au webview panel (comme settings view).
- Remplacer `_markdown()` par :
  - soit rendu texte brut safe
  - soit parsing markdown + sanitization stricte.

---

## 3.B – Priorité P1 (fortement recommandé)

### B1) Workspace Trust gating

Objectif : être conforme, éviter blocages.

- Si `!vscode.workspace.isTrusted` :
  - ne pas écrire dans le workspace
  - désactiver watchers de rules
  - afficher 1 message informatif non bloquant

### B2) Réduction de duplication VS Code/MCP via “Shared Core”

Objectif : éviter divergence et accélérer les évolutions.

- Extraire dans `src/core/` (ou `src/shared/`) :
  - formatage des réponses (consult/search/templates)
  - logique validation “no hedge language”
  - schémas Zod/TS générés depuis une source unique

### B3) Auto-configuration MCP 100% silencieuse (quand possible)

Objectif : ne plus demander à l’utilisateur de “configurer MCP”.

- Détecter environnement (déjà fait) et :
  - écrire la config MCP automatiquement si supporté
  - utiliser `alwaysAllow` par défaut
  - éviter popups, privilégier logs + status view

> Attention : selon les environnements, écrire dans `~/.cursor` ou `~/.codeium` peut être sensible. Prévoir un flag “autonomy total” explicite.

---

## 3.C – Priorité P2 (qualité de vie / durcissement)

### C1) Santé système et auto-repair DB

- Ajouter une routine de healthcheck : intégrité schema, présence wasm, droits d’écriture.
- Si erreur : fallback + recréation contrôlée (ou backup/restore) sans intervention.

### C2) Télémétrie locale (sans réseau)

- Enregistrer localement les erreurs/récupérations (déjà partiellement via `trackError`) pour permettre diagnostic autonome.

### C3) Tests supplémentaires

- Tests unitaires sur la logique commune (formatage consult/validate)
- Tests de concurrence simulée sur DB (process VS Code vs MCP)

---

## 4) Roadmap proposée (orientée autonomie totale)

### Phase 1 (P0) – “Autonomie garantie”

- Enforcement consult côté VS Code
- Mode `autonomyMode=total`
- Fix sécurité webviewPanel
- Stratégie anti-lost-update DB (au minimum optimistic)

### Phase 2 (P1) – “Autonomie durable”

- Workspace Trust gating
- Shared core VSCode/MCP
- Auto-config MCP silencieux (optionnel)

### Phase 3 (P2) – “Autonomie industrielle”

- Healthcheck/repair DB
- Tests de non-régression multi-hosts

---

## 5) Points à clarifier (pour coller exactement à ton intention)

Pour “autonomie totale”, tu veux plutôt :

- **Mode agressif** : l’extension modifie le workspace (rules, settings, configs) sans jamais demander.
- **Mode enterprise** : autonomie maximale, mais **sans toucher au workspace** (tout dans globalStorage / homeDir).

Si tu me confirmes lequel tu vises, je peux te proposer la configuration cible + les changements de code exacts.
