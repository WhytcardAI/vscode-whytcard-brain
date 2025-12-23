# 🧠 WhytCard Brain - Release v1.1.2

> **Base de connaissances locale pour assistants IA** - Fonctionne avec VS Code, Cursor et Windsurf

---

## ⚠️ Prérequis

- **Node.js 18+** : [nodejs.org](https://nodejs.org/) (nécessaire pour MCP)
- **VS Code 1.89+**, **Cursor 0.45+** ou **Windsurf**

Vérifier Node.js :

```bash
node --version  # Doit afficher v18.x.x ou supérieur
```

---

## 📦 Contenu du dossier

```
release/
├── whytcard-brain-1.1.2.vsix    # Extension VS Code/Cursor/Windsurf
├── mcp_config.json              # Config MCP (utilise npx)
├── install-windows.bat          # Installation automatique Windows
├── install-mac-linux.sh         # Installation automatique Mac/Linux
├── TROUBLESHOOTING.md           # Guide de dépannage
└── README.md                    # Ce fichier
```

---

## 🚀 Installation Rapide

### Option 1: Script automatique (recommandé)

**Windows:** Double-cliquez sur `install-windows.bat`

**Mac/Linux:**

```bash
chmod +x install-mac-linux.sh
./install-mac-linux.sh
```

Le script va:

1. ✅ Détecter vos éditeurs installés
2. ✅ Installer l'extension VSIX
3. ✅ Configurer MCP pour Cursor/Windsurf
4. ✅ Vous guider pour les prochaines étapes

### Option 2: Installation manuelle

#### Étape 1: Installer l'extension

**VS Code:**

```bash
code --install-extension whytcard-brain-1.1.2.vsix
```

**Cursor:**

```bash
cursor --install-extension whytcard-brain-1.1.2.vsix
```

**Windsurf:**

```bash
windsurf --install-extension whytcard-brain-1.1.2.vsix
```

#### Étape 2: Configurer MCP (Cursor/Windsurf uniquement)

> ⚠️ **VS Code n'a pas besoin de cette étape** - l'extension fonctionne directement avec Copilot.

Copier `mcp_config.json` vers:

| Éditeur      | Windows                                           | Mac/Linux                             |
| ------------ | ------------------------------------------------- | ------------------------------------- |
| **Cursor**   | `%USERPROFILE%\.cursor\mcp.json`                  | `~/.cursor/mcp.json`                  |
| **Windsurf** | `%USERPROFILE%\.codeium\windsurf\mcp_config.json` | `~/.codeium/windsurf/mcp_config.json` |

> 💡 **Note:** Si le dossier n'existe pas, créez-le.

---

## ⚙️ Configuration

### Settings VS Code/Cursor/Windsurf

Ouvrir Settings → chercher "**Brain**":

| Setting            | Options                      | Description              |
| ------------------ | ---------------------------- | ------------------------ |
| `strictMode`       | off / moderate / strict      | Niveau d'exigence        |
| `autoSave`         | off / ask / always           | Sauvegarde auto des docs |
| `instructionStyle` | minimal / standard / verbose | Longueur des règles      |
| `language`         | auto / en / fr               | Langue des instructions  |

### Variables d'environnement MCP

Dans `mcp_config.json`, vous pouvez ajuster:

| Variable                       | Défaut        | Description                                      |
| ------------------------------ | ------------- | ------------------------------------------------ |
| `BRAIN_DB_PATH`                | (vide = auto) | Chemin vers brain.db                             |
| `BRAIN_REQUIRE_CONSULT`        | `1`           | L'IA doit appeler brainConsult avant de répondre |
| `BRAIN_STRICT_MODE`            | `0`           | Mode strict (0=désactivé, 1=activé)              |
| `BRAIN_STRICT_REQUIRE_SOURCES` | `0`           | Exiger URLs sources (0=non, 1=oui)               |

> 💡 **Conseil:** Commencez avec les valeurs par défaut, puis activez le mode strict une fois familiarisé.

---

## 📁 Fichiers auto-générés

L'extension crée automatiquement ces fichiers dans votre workspace:

| Éditeur         | Fichier                           |
| --------------- | --------------------------------- |
| VS Code/Copilot | `.github/copilot-instructions.md` |
| Cursor          | `.cursor/rules/brain.mdc`         |
| Windsurf        | `.windsurf/rules/brain.md`        |

Ces fichiers forcent l'IA à:

1. ✅ Consulter Brain avant de répondre
2. ✅ Ne jamais halluciner
3. ✅ Sauvegarder les nouvelles connaissances
4. ✅ Citer ses sources

---

## 🎯 Utilisation

**Vous n'avez rien à faire !** Demandez simplement à votre IA:

```
"Comment faire X avec React?"
```

L'IA va automatiquement:

1. Appeler `brainConsult` pour vérifier les docs locales
2. Chercher la doc officielle si nécessaire
3. Sauvegarder les infos utiles avec `brainSave`
4. Citer ses sources dans la réponse

---

## 🔧 Dépannage

### L'extension ne s'installe pas

```bash
# Vérifier la version de VS Code/Cursor
code --version  # Doit être >= 1.89.0
```

### MCP ne fonctionne pas (Cursor/Windsurf)

1. Vérifier que `mcp_config.json` est au bon endroit
2. Redémarrer l'éditeur
3. Vérifier les logs: `Ctrl+Shift+U` → Output → "WhytCard Brain"

### Les règles ne s'appliquent pas

1. Ouvrir un workspace (pas juste un fichier)
2. Vérifier que les fichiers de règles existent
3. Commande: `Brain: Show Installed Rules`

---

## 📞 Support

- **GitHub Issues**: [github.com/WhytcardAI/vscode-whytcard-brain/issues](https://github.com/WhytcardAI/vscode-whytcard-brain/issues)
- **Documentation**: [github.com/WhytcardAI/vscode-whytcard-brain](https://github.com/WhytcardAI/vscode-whytcard-brain)

---

**Version:** 1.1.2  
**Date:** 2024-12-23  
**Licence:** MIT
