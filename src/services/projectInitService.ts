import * as vscode from "vscode";
import { getBrainService } from "./brainService";

interface ProjectStack {
  frameworks: string[];
  libraries: string[];
  language: string;
}

export class ProjectInitService {
  /**
   * Scans the workspace to detect the tech stack
   */
  public async detectStack(): Promise<ProjectStack> {
    const stack: ProjectStack = {
      frameworks: [],
      libraries: [],
      language: "javascript",
    };

    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return stack;
    }

    // Check for package.json
    const packageJsonFiles = await vscode.workspace.findFiles(
      "**/package.json",
      "**/node_modules/**",
      2,
    );

    for (const uri of packageJsonFiles) {
      try {
        const content = await vscode.workspace.fs.readFile(uri);
        const json = JSON.parse(Buffer.from(content).toString("utf8"));
        const deps = { ...json.dependencies, ...json.devDependencies };

        // Language detection
        if (deps.typescript) stack.language = "typescript";

        // Frameworks
        if (deps.next) stack.frameworks.push("Next.js");
        if (deps.react) stack.frameworks.push("React");
        if (deps.vue) stack.frameworks.push("Vue");
        if (deps.svelte) stack.frameworks.push("Svelte");
        if (deps["react-native"] || deps.expo) stack.frameworks.push("React Native");
        if (deps.flutter) stack.frameworks.push("Flutter"); // unlikely in package.json but possible in hybrid

        // Libs
        if (deps.tailwindcss) stack.libraries.push("Tailwind CSS");
        if (deps.prisma) stack.libraries.push("Prisma");
        if (deps.zod) stack.libraries.push("Zod");
        if (deps["tanstack-query"] || deps["react-query"]) stack.libraries.push("TanStack Query");
        if (deps.redux || deps["@reduxjs/toolkit"]) stack.libraries.push("Redux");
        if (deps.zustand) stack.libraries.push("Zustand");
        if (deps.graphql) stack.libraries.push("GraphQL");
        if (deps.supabase) stack.libraries.push("Supabase");
        if (deps.firebase) stack.libraries.push("Firebase");
      } catch (e) {
        console.warn("Error reading package.json:", e);
      }
    }

    // Deduplicate
    stack.frameworks = [...new Set(stack.frameworks)];
    stack.libraries = [...new Set(stack.libraries)];

    return stack;
  }

  /**
   * Generates a bootstrap plan for the agent
   */
  public async generateInitPlan(): Promise<string> {
    const stack = await this.detectStack();
    const service = getBrainService();

    // Save initial context
    service.upsertDoc({
      library: "Project",
      topic: "Tech Stack",
      title: "Detected Tech Stack",
      content: `Detected stack:\n- Language: ${stack.language}\n- Frameworks: ${stack.frameworks.join(", ")}\n- Libraries: ${stack.libraries.join(", ")}`,
      category: "project",
      source: "auto-init",
    });

    let plan = `## 🚀 Project Initialization Plan\n\n`;
    plan += `I have detected the following stack: **${stack.frameworks.join(", ")}** using **${stack.libraries.join(", ")}** (${stack.language}).\n\n`;

    plan += `### 1. Documentation Ingestion (MCP)\n`;
    plan += `Please execute the following actions to build the Brain:\n\n`;

    const itemsToSearch = [...stack.frameworks, ...stack.libraries];

    if (itemsToSearch.length === 0) {
      plan += `- No major frameworks detected. Please search for general best practices for this project type.\n`;
    } else {
      for (const item of itemsToSearch) {
        plan += `- [ ] Search official docs for **"${item} best practices"** and **"${item} common pitfalls"** (use MCP tools).\n`;
        plan += `  - Save findings via \`#tool:brainSave\` (category='documentation').\n`;
      }
    }

    plan += `\n### 2. Context Setup\n`;
    plan += `- [ ] Analyze the project structure (use \`ls\` or similar if needed) and summarize the architecture.\n`;
    plan += `- [ ] Save the architecture summary via \`#tool:brainSave\` (category='project', title='Project Architecture').\n`;

    plan += `\n### 3. Instructions\n`;
    plan += `- [ ] Based on the stack, generate a set of coding rules (e.g., "Use functional components", "Use strict typing").\n`;
    plan += `- [ ] Save these rules via \`#tool:brainSave\` (category='instruction').\n`;

    return plan;
  }
}
