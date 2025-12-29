import * as vscode from 'vscode';
import { getBrainService } from '../services/brainService';

export class BrainDocumentProvider implements vscode.TextDocumentContentProvider {
  // Event emitter for content changes
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  provideTextDocumentContent(uri: vscode.Uri): string {
    const service = getBrainService();
    const pathParts = uri.path.split('/');
    // uri.path starts with /, so parts[0] is empty, parts[1] is type, parts[2] is id
    const type = pathParts[1];
    const id = parseInt(pathParts[2], 10);

    if (isNaN(id)) {
      return 'Invalid ID';
    }

    if (type === 'doc') {
      const doc = service.getDocById(id);
      if (doc) {
        return `# ${doc.title}\n\n**Library:** ${doc.library}\n**Topic:** ${doc.topic}\n\n---\n\n${
          doc.content
        }\n\n---\nSource: ${doc.url || 'Local Brain'}`;
      }
    } else if (type === 'pitfall') {
      const pitfall = service.getPitfallById(id);
      if (pitfall) {
        let content = `# Pitfall: ${pitfall.symptom}\n\n**Library:** ${
          pitfall.library || 'Unknown'
        }\n\n## Symptom\n${pitfall.symptom}\n\n`;
        if (pitfall.error) {
          content += `## Error\n\`\`\`\n${pitfall.error}\n\`\`\`\n\n`;
        }
        content += `## Solution\n${pitfall.solution}\n\n`;
        if (pitfall.code) {
          content += `## Code Fix\n\`\`\`typescript\n${pitfall.code}\n\`\`\`\n`;
        }
        return content;
      }
    }

    return 'Document not found in Brain.';
  }
}
