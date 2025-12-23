# 🔧 Dépannage - WhytCard Brain

## Problèmes courants

### ❌ L'extension ne s'installe pas

**Vérifier la version de l'éditeur:**

```bash
code --version    # VS Code >= 1.89.0
cursor --version  # Cursor >= 0.45
```

**Solution:** Mettre à jour votre éditeur.

---

### ❌ MCP ne fonctionne pas (Cursor/Windsurf)

**1. Vérifier l'emplacement du fichier config:**

| Éditeur  | Windows                                           | Mac/Linux                             |
| -------- | ------------------------------------------------- | ------------------------------------- |
| Cursor   | `%USERPROFILE%\.cursor\mcp.json`                  | `~/.cursor/mcp.json`                  |
| Windsurf | `%USERPROFILE%\.codeium\windsurf\mcp_config.json` | `~/.codeium/windsurf/mcp_config.json` |

**2. Vérifier que Node.js est installé:**

```bash
node --version  # Doit afficher v18+
npx --version
```

**3. Tester le serveur MCP manuellement:**

```bash
npx -y @anthropic-ai/mcp-server-whytcard-brain@latest
```

**4. Si npx ne fonctionne pas, utiliser le chemin absolu:**

Éditer `mcp_config.json`:

```json
{
  "mcpServers": {
    "whytcard-brain": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js",
        "-y",
        "@anthropic-ai/mcp-server-whytcard-brain@latest"
      ]
    }
  }
}
```

---

### ❌ Les règles ne s'appliquent pas

**1. Ouvrir un workspace (pas un fichier seul)**

L'extension ne crée les règles que dans un workspace ouvert.

**2. Vérifier les fichiers créés:**

- VS Code: `.github/copilot-instructions.md`
- Cursor: `.cursor/rules/brain.mdc`
- Windsurf: `.windsurf/rules/brain.md`

**3. Forcer la recréation:**

```
Ctrl+Shift+P → "Developer: Reload Window"
```

---

### ❌ L'IA n'utilise pas Brain

**1. Vérifier que les outils sont disponibles:**

Dans le chat, tapez: `@brain` ou mentionnez `brainConsult`

**2. Vérifier les settings:**

```
Settings → "whytcard-brain.strictMode" → "moderate" ou "strict"
```

**3. Vérifier les logs:**

```
Ctrl+Shift+U → Output → "WhytCard Brain"
```

---

### ❌ Erreur "Cannot find module 'vscode'"

C'est normal si vous essayez de lancer le serveur MCP directement. Le serveur MCP utilise un fichier différent (`mcp-server.cjs`).

---

### ❌ Base de données introuvable

**Chemin par défaut de brain.db:**

| Éditeur  | Windows                                                                  |
| -------- | ------------------------------------------------------------------------ |
| VS Code  | `%APPDATA%\Code\User\globalStorage\whytcard.whytcard-brain\brain.db`     |
| Cursor   | `%APPDATA%\Cursor\User\globalStorage\whytcard.whytcard-brain\brain.db`   |
| Windsurf | `%APPDATA%\Windsurf\User\globalStorage\whytcard.whytcard-brain\brain.db` |

**Forcer un chemin personnalisé:**

Dans `mcp_config.json`:

```json
"env": {
  "BRAIN_DB_PATH": "C:/chemin/vers/brain.db"
}
```

---

## Logs et Debug

### Activer les logs détaillés

1. Ouvrir Settings
2. Chercher "whytcard-brain"
3. Activer le mode debug si disponible

### Voir les logs MCP

```bash
# Lancer le serveur en mode debug
BRAIN_DEBUG=1 npx -y @anthropic-ai/mcp-server-whytcard-brain@latest
```

---

## Réinitialisation complète

```bash
# 1. Désinstaller l'extension
code --uninstall-extension whytcard.whytcard-brain

# 2. Supprimer les fichiers de config
rm ~/.cursor/mcp.json
rm ~/.codeium/windsurf/mcp_config.json

# 3. Réinstaller
./install-mac-linux.sh  # ou install-windows.bat
```

---

## Support

Si le problème persiste:

1. Ouvrir une issue sur GitHub avec les logs
2. Inclure: version éditeur, OS, message d'erreur complet
