# 📄 RAG PDF Q/A - Mini-Projet NLP

Application web de Question/Réponse sur documents PDF utilisant le système RAG (Retrieval Augmented Generation) avec Ollama et JavaScript.

##  Description

Ce projet implémente un chatbot intelligent capable de répondre à des questions sur le contenu d'un document PDF. Il utilise la technique RAG qui combine :
- **Retrieval** : Recherche sémantique dans le document via des embeddings vectoriels
- **Augmented** : Enrichissement du contexte avec les passages pertinents
- **Generation** : Génération de réponses par un modèle de langage (LLM)

##  Fonctionnalités

-  **Upload de PDF** : Importez vos documents PDF
-  **Indexation automatique** : Le texte est extrait, découpé en chunks et vectorisé
-  **Questions/Réponses** : Posez des questions en langage naturel
-  **Recherche sémantique** : Trouve les passages pertinents via similarité cosinus
-  **Génération intelligente** : Réponses contextualisées par Llama 3.2
-  **Interface minimaliste** : Design épuré et responsive

##  Technologies

### Backend
- **Node.js** v24+ (support natif de `fetch`)
- **Express** 5.2.1 - Framework web
- **Multer** 2.0.2 - Upload de fichiers
- **pdf-parse** 2.4.5 - Extraction de texte PDF

### IA & NLP
- **Ollama** - Serveur LLM local
  - `llama3.2` - Génération de réponses
  - `nomic-embed-text` - Embeddings vectoriels (768 dimensions)

### Frontend
- HTML5, CSS3, JavaScript vanilla
- Fetch API pour les requêtes AJAX

##  Prérequis

1. **Node.js** : Version 24.13.0 ou supérieure
   ```bash
   node --version
   ```

2. **Ollama** : [Installer Ollama](https://ollama.ai)
   ```bash
   # Télécharger les modèles nécessaires
   ollama pull llama3.2
   ollama pull nomic-embed-text
   
   # Vérifier l'installation
   ollama list
   ```

##  Installation

1. **Cloner ou télécharger le projet**
   ```bash
   cd miniprojectnlp
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Démarrer Ollama** (si ce n'est pas déjà fait)
   ```bash
   ollama serve
   ```

4. **Lancer le serveur**
   ```bash
   npm start
   ```

5. **Ouvrir dans le navigateur**
   ```
   http://localhost:3000
   ```

##  Utilisation

### 1. Indexer un PDF

1. Cliquez sur **"Choisir un fichier"**
2. Sélectionnez votre PDF
3. Cliquez sur **"Indexer"**
4. Attendez le message de confirmation : `✓ X chunks indexés`

### 2. Poser des questions

1. Tapez votre question dans le champ de texte
2. Cliquez sur **"Demander"**
3. La réponse s'affiche avec les sources utilisées

### Exemple

**Question** : `Quels sont les objectifs de ce projet ?`

**Réponse** : Le système analyse le PDF, trouve les passages pertinents et génère une réponse contextualisée.

##  Structure du projet

```
miniprojectnlp/
├── server.js           # Serveur Express (API REST)
├── rag.js             # Logique RAG (embeddings, chunking, Q/A)
├── package.json       # Dépendances et scripts
├── README.md          # Documentation du projet
├── data/              # Données générées
│   ├── index.json     # Index vectoriel (chunks + embeddings)
│   └── uploads/       # PDFs uploadés
└── public/            # Frontend
    ├── index.html     # Interface utilisateur
    ├── style.css      # Styles minimalistes
    └── app.js         # Logique frontend (fetch API)
```

##  Architecture RAG

### Pipeline d'indexation

```
PDF → Extraction texte → Chunking → Embeddings → Sauvegarde JSON
```

1. **Extraction** : `pdf-parse` lit le PDF et extrait le texte
2. **Chunking** : Découpage en morceaux de 1200 caractères (overlap de 200)
3. **Embeddings** : Vectorisation via `nomic-embed-text` (768 dimensions)
4. **Stockage** : Sauvegarde dans `data/index.json`

### Pipeline Question/Réponse

```
Question → Embedding → Recherche similarité → Top-K chunks → LLM → Réponse
```

1. **Vectorisation** : La question est transformée en embedding
2. **Retrieval** : Calcul de similarité cosinus avec tous les chunks
3. **Top-K** : Sélection des 5 chunks les plus pertinents
4. **Génération** : `llama3.2` génère la réponse à partir du contexte

##  Calcul de similarité

La similarité cosinus mesure l'angle entre deux vecteurs :

```javascript
cosθ = (A · B) / (||A|| × ||B||)
```

- **1.0** : Vecteurs identiques (très pertinent)
- **0.0** : Vecteurs orthogonaux (non pertinent)
- **-1.0** : Vecteurs opposés

##  API Routes

### `GET /api/health`
Vérification de l'état du serveur

**Réponse** :
```json
{
  "ok": true,
  "message": "Serveur RAG opérationnel"
}
```

### `POST /api/index`
Indexation d'un PDF

**Body** : `FormData` avec fichier PDF (clé: `pdf`)

**Réponse** :
```json
{
  "ok": true,
  "indexPath": "data/index.json",
  "stats": {
    "chunks": 42,
    "embedModel": "nomic-embed-text",
    "source": "document.pdf"
  }
}
```

### `POST /api/ask`
Question sur le PDF indexé

**Body** :
```json
{
  "question": "Quels sont les objectifs ?"
}
```

**Réponse** :
```json
{
  "answer": "Les objectifs sont...",
  "sources": [
    {
      "id": "document.pdf::chunk_5",
      "score": 0.89,
      "text": "..."
    }
  ]
}
```

##  Configuration

### Paramètres RAG (dans `rag.js`)

```javascript
// Chunking
chunkSize: 1200        // Taille d'un chunk (caractères)
chunkOverlap: 200      // Chevauchement entre chunks

// Retrieval
topK: 5                // Nombre de chunks à récupérer

// Modèles
embedModel: 'nomic-embed-text'  // Modèle d'embeddings
chatModel: 'llama3.2'            // Modèle de génération
```

### Port du serveur

Par défaut : `3000`

Pour changer :
```bash
PORT=8080 npm start
```

##  Dépannage

### Ollama n'est pas accessible
```bash
# Vérifier qu'Ollama tourne
curl http://localhost:11434/api/tags

# Redémarrer Ollama si nécessaire
ollama serve
```

### Erreur "pdfParse is not a function"
- Assurez-vous d'avoir la bonne version de `pdf-parse`
- Redémarrez le serveur après modification

### Le PDF n'est pas indexé
- Vérifiez que le fichier est bien un PDF
- Consultez les logs du serveur pour les erreurs détaillées

### Réponses de mauvaise qualité
- Augmentez `topK` pour plus de contexte
- Ajustez `chunkSize` et `chunkOverlap`
- Essayez un modèle LLM plus performant

##  Concepts NLP

### Embeddings
Représentation vectorielle du texte qui capture le sens sémantique. Des textes similaires auront des vecteurs proches.

### Chunking
Découpage du texte en morceaux gérables par le LLM. L'overlap évite de perdre le contexte aux frontières.

### RAG vs Fine-tuning
- **RAG** : Pas besoin de réentraîner, ajout dynamique de connaissances
- **Fine-tuning** : Réentraînement coûteux, connaissances figées

### Vector Store
Base de données contenant les chunks avec leurs embeddings pour une recherche rapide.

##  Ressources

- [Ollama Documentation](https://ollama.ai/docs)
- [RAG Explained](https://arxiv.org/abs/2005.11401)
- [Langchain RAG Tutorial](https://python.langchain.com/docs/use_cases/question_answering/)
- [Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)

##  Auteur

**Imen Boussetta**

Projet développé dans le cadre d'une formation en Intelligence Artificielle (LLM, LangChain, RAG, Agents).

##  Licence

Ce projet est à usage éducatif.


