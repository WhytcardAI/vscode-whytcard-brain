# Rapport d'Analyse : WhytCard Brain & Serveur MCP

## 1. Vue d'Ensemble et Architecture

Le système `whytcard-brain` repose sur une architecture hybride permettant de servir simultanément l'écosystème VS Code natif (via GitHub Copilot) et les éditeurs "Agentic" modernes (Windsurf, Cursor) via le protocole MCP (Model Context Protocol).

### Diagramme d'Architecture

```mermaid
graph TD
    subgraph "Stockage Local"
        DB[("SQLite (brain.db)\n(WASM)")]
    end

    subgraph "Extension VS Code"
        Ext[Extension Entry\n(extension.ts)]
        VSCodeTools["VS Code LM Tools\n(brainTools.ts)"]
        Chat["Chat Participant\n(@brain)"]
        Service["Brain Service\n(brainService.ts)"]

        Ext --> Service
        VSCodeTools --> Service
        Chat --> Service
        Service --> DB
    end

    subgraph "Serveur MCP (Standalone)"
        MCP[MCP Server\n(mcp-server.ts)]
        MCPLogic["Logic Duplication\n(Interne mcp-server)"]

        MCP --> MCPLogic
        MCPLogic --> DB
    end

    subgraph "Clients"
        Copilot["GitHub Copilot"]
        Windsurf["Windsurf Cascade"]
        Cursor["Cursor"]
    end

    Copilot -->|"vscode.lm"| VSCodeTools
    Windsurf -->|"stdio"| MCP
    Cursor -->|"stdio"| MCP
```

## 2. Analyse Fonctionnelle des Outils

Tous les outils exposés par le serveur MCP ont été testés et validés :

| Outil            | Statut | Observation                                                                                                |
| ---------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| `brainConsult`   | ✅ OK  | Charge correctement instructions + contexte + recherche. C'est la pierre angulaire du système.             |
| `brainSearch`    | ✅ OK  | Recherche vectorielle/keyword fonctionnelle.                                                               |
| `brainSave`      | ✅ OK  | Enregistre la doc. En mode strict, exige une URL source (validé).                                          |
| `brainBug`       | ✅ OK  | Enregistre symptômes et solutions. Utile pour l'apprentissage continu.                                     |
| `brainValidate`  | ✅ OK  | Vérifie la présence de sources et l'absence de langage spéculatif. Très efficace pour le contrôle qualité. |
| `brainTemplate*` | ✅ OK  | Suite complète (Save, Search, Apply) fonctionnelle.                                                        |
| `brainSession`   | ✅ OK  | Journalisation des sessions opérationnelle.                                                                |

**Note sur `list_resources`** : Le serveur ne supporte pas encore les "Ressources" MCP (accès direct aux fichiers/données passives), il fonctionne uniquement en mode "Outils" (fonctions exécutables). C'est un comportement attendu mais qui pourrait être étendu.

## 3. Analyse du Code et Comparaison (Extension vs MCP)

L'analyse comparative des fichiers `src/tools/brainTools.ts` (VS Code) et `src/mcp-server.ts` (MCP) révèle une **dette technique importante liée à la duplication**.

### Points de Convergence

- Partagent le même cœur de base de données (`brainDbCore.ts`).
- Utilisent les mêmes schémas de données (Docs, Pitfalls, Templates).
- Visent les mêmes fonctionnalités finales.

### Points de Divergence (Problématiques)

1.  **Duplication de la Logique de Présentation** :
    - La construction des chaînes Markdown (ex: "## Instructions a suivre...", "### Documentation...") est réécrite entièrement dans les deux fichiers.
    - Si on veut changer le format de réponse de `brainConsult`, il faut modifier 2 fichiers.

2.  **Gestion du "State" et Mode Strict** (Critique) :
    - **Serveur MCP** : Implémente un wrapper `enforceConsult` robuste qui bloque techniquement l'exécution des outils (`brainSave`, `brainBug`, etc.) si `brainConsult` n'a pas été appelé récemment ou si aucune documentation n'a été trouvée. Gère un état de session (`sessionState`).
    - **Extension VS Code** : Ne possède pas ce mécanisme de blocage programmatique dans `brainTools.ts`. Elle compte principalement sur le "System Prompt" de Copilot pour respecter la procédure. Le serveur MCP est donc techniquement plus sûr pour garantir le respect du workflow.

3.  **Typage** :
    - `brainTools.ts` utilise des interfaces TypeScript classiques.
    - `mcp-server.ts` utilise Zod pour la validation runtime des inputs (requis par le SDK MCP), créant une double définition des schémas d'entrée.

4.  **Initialisation DB** :
    - `mcp-server.ts` réimplémente une version simplifiée de `BrainDbService` (classe `BrainDbService` interne au fichier) au lieu d'importer `src/services/brainService.ts`. Cela est probablement dû aux difficultés de bundling/import de modules VS Code dans un processus Node.js autonome (le serveur MCP ne peut pas dépendre de `vscode`).

## 4. Recommandations et Améliorations

### A. Priorité Haute : Réduire la Duplication

Il est impératif d'extraire la logique de "présentation" et la logique métier pure dans des services partagés qui **ne dépendent pas de l'API VS Code**.

**Action proposée :**
Créer un dossier `src/common/` ou `src/logic/` contenant :

- `ConsultLogic.ts` : Prend les données brutes et retourne le Markdown formaté.
- `ValidationLogic.ts` : Contient les règles de `brainValidate` (actuellement dans `mcp-server.ts`).

### B. Gestion des Ressources MCP

Le serveur MCP devrait exposer les documents Brain comme des "Ressources" MCP.

- `brain://doc/{id}` -> Lecture directe du contenu.
- `brain://context` -> Lecture du contexte projet.
  Cela permettrait à l'IA de "lire" directement sans passer par un appel d'outil coûteux pour tout le contexte.

### C. Tests Unifiés

Actuellement, tester le comportement demande de tester manuellement deux entrées.

- Mettre en place des tests unitaires sur la logique extraite (point A) garantirait la cohérence entre VS Code et Windsurf/Cursor.

### D. Architecture "Shared Core"

L'actuel `brainService.ts` mélange parfois logique DB et dépendances VS Code (ex: `vscode.workspace.fs`).

- Il faut scinder `brainService.ts` en :
  1.  `BrainDbCore` (Pur TS/SQL, iso-fonctionnel dans Node et Electron).
  2.  `BrainService` (Couche VS Code + FileSystem Watcher).

Cela permettrait au `mcp-server.ts` d'importer directement le `BrainDbCore` au lieu de le réimplémenter.

## Conclusion

L'extension est robuste et fonctionnelle. Le serveur MCP est une réussite technique qui ouvre l'outil à tout l'écosystème "Agentic". Cependant, pour pérenniser le projet, une refonte de l'architecture interne visant à **découpler le cœur logique des interfaces (VS Code vs MCP)** est fortement recommandée.
