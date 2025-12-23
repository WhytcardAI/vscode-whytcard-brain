import { getBrainService } from "./brainService";

export class DiagnosticsService {
  /**
   * Analyzes an error message to check if it's a known pitfall.
   * If known, returns the solution.
   * If unknown, prepares a template for storing it.
   */
  public async analyzeError(errorMessage: string): Promise<{
    known: boolean;
    pitfall?: { symptom: string; solution: string };
    suggestion?: { symptom: string; error: string };
  }> {
    const service = getBrainService();
    const pitfalls = service.searchPitfalls(errorMessage);

    if (pitfalls.length > 0) {
      // Return the most relevant match
      const best = pitfalls[0];
      return {
        known: true,
        pitfall: {
          symptom: best.symptom,
          solution: best.solution,
        },
      };
    }

    // Not known, suggest creating a new one
    // We clean up the error message to be a good "symptom" title
    const symptom = this.cleanErrorToSymptom(errorMessage);

    return {
      known: false,
      suggestion: {
        symptom,
        error: errorMessage,
      },
    };
  }

  private cleanErrorToSymptom(error: string): string {
    // Take first line, remove timestamps, file paths, etc.
    let line = error.split("\n")[0];
    line = line.replace(/\[.*?\]/g, ""); // remove [time]
    line = line.replace(/\(.*?:\d+:\d+\)/g, ""); // remove file paths
    if (line.length > 100) {
      line = line.substring(0, 97) + "...";
    }
    return line.trim();
  }
}
