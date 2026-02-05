// ============================================
// RAG.JS - Logique complète du système RAG
// ============================================
// Ce fichier contient toutes les fonctions pour :
// 1. Communiquer avec l'API Ollama (embeddings + chat)
// 2. Découper du texte en morceaux (chunking)
// 3. Calculer la similarité entre vecteurs
// 4. Indexer un PDF (extraction + vectorisation)
// 5. Répondre aux questions (retrieval + génération)

// Importer les modules Node.js nécessaires
const fs = require('fs');           // Pour lire/écrire des fichiers
const path = require('path');       // Pour manipuler les chemins de fichiers
const { PDFParse } = require('pdf-parse'); // Pour extraire le texte d'un PDF

// ============================================
// PARTIE 1 : API OLLAMA
// ============================================

/**
 * Transforme du texte en vecteur numérique (embeddings)
 * via l'API Ollama
 */
async function ollamaEmbeddings({ model, text }) {
  // Appeler l'API Ollama (endpoint embeddings)
  const response = await fetch('http://localhost:11434/api/embeddings', {
    method: 'POST',  // Méthode HTTP POST
    headers: { 'content-type': 'application/json' },  // Type de contenu JSON
    body: JSON.stringify({  // Convertir l'objet en chaîne JSON
      model: model,         // Nom du modèle (ex: "nomic-embed-text")
      prompt: text          // Texte à vectoriser
    })
  });

  // Parser la réponse JSON (convertir en vrai objet JavaScript ({ ... }) au lieu d’une chaîne de texte.)
  const data = await response.json();

  // Retourner le vecteur d'embeddings
  // Exemple: [0.12, 0.89, -0.34, ..., 0.77] (768 dimensions)
  return data.embedding;
}

/**
 * Génère une réponse via le LLM Ollama (chat)
 */
async function ollamaChat({ model, system, user }) {
  // Appeler l'API Ollama (endpoint chat)
  const response = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: model,          // Nom du modèle (ex: "llama3.2")
      stream: false,         // Pas de streaming (réponse complète d'un coup)
      messages: [            // Tableau de messages (conversation)
        { role: 'system', content: system },  // Prompt système (instructions)
        { role: 'user', content: user }       // Prompt utilisateur (question)
      ]
    })
  });


  // Parser la réponse JSON
  const data = await response.json();
  
  // Extraire le contenu de la réponse
  // Structure: { message: { content: "réponse du LLM" } }
  const content = data?.message?.content;

  // Vérifier que le contenu est une chaîne de caractères valide
  if (typeof content !== 'string') {
    throw new Error('Réponse Ollama chat invalide');
  }

  // Retourner la réponse nettoyée (sans espaces superflus)
  return content.trim();
}

// ============================================
// PARTIE 2 : TRAITEMENT DU TEXTE
// ============================================

/**
 * Découpe un texte long en morceaux (chunks) avec chevauchement
 * 
 * Pourquoi le chunking ?
 * - Les LLM ont une limite de tokens (contexte)
 * - On ne peut pas envoyer tout un PDF d'un coup
 * - Le chevauchement (overlap) garde le contexte entre chunks
 */
function chunkText(text, chunkSize = 1200, overlap = 200) {
  // Nettoyer le texte :
  const cleaned = String(text || '')      // Convertir en string (au cas où)
    .replace(/\r/g, '')                   // Supprimer les retours chariot Windows
    .replace(/[ \t]+/g, ' ')              // Remplacer espaces multiples par 1 seul
    .replace(/\n{3,}/g, '\n\n')           // Remplacer 3+ sauts de ligne par 2
    .trim();                              // Supprimer espaces début/fin

  // Tableau qui va contenir tous les chunks
  const chunks = [];
  
  // Position de départ dans le texte
  let i = 0;

  // Boucle : découper jusqu'à la fin du texte
  while (i < cleaned.length) {
    // Calculer la position de fin du chunk
    // Math.min = prendre le minimum entre (i + chunkSize) et la fin du texte
    const end = Math.min(i + chunkSize, cleaned.length);
    
    // Extraire le chunk
    const chunk = cleaned.slice(i, end).trim();
    
    // Ajouter le chunk seulement s'il n'est pas vide
    if (chunk) {
      chunks.push(chunk);
    }
    
    // Si on est à la fin du texte, sortir de la boucle
    if (end === cleaned.length) break;
    
    // Avancer la position en tenant compte de l'overlap
    // Math.max pour éviter de reculer (si overlap > chunkSize)
    i = Math.max(0, end - overlap);
  }

  // Retourner le tableau de chunks
  return chunks;
}

/**
 * Calcule la similarité cosinus entre 2 vecteurs
 * 
 * C'est quoi la similarité cosinus ?
 * - Mesure l'angle entre 2 vecteurs
 * - Valeur entre -1 et 1 (1 = identiques, 0 = orthogonaux, -1 = opposés)
 * - Pour les embeddings, généralement entre 0 et 1
 * 
 * Formule : cos(θ) = (A · B) / (||A|| × ||B||)
 *   A · B = produit scalaire (dot product)
 *   ||A|| = norme (longueur) du vecteur A
 */
function cosineSimilarity(a, b) {
  // Variables pour les calculs
  let dot = 0;   // Produit scalaire (A · B)
  let na = 0;    // Norme de A au carré (||A||²)
  let nb = 0;    // Norme de B au carré (||B||²)

  // Prendre la longueur du plus petit vecteur
  // (au cas où les 2 vecteurs n'ont pas la même taille)
  const len = Math.min(a.length, b.length);
  
  // Parcourir les vecteurs
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];    // Produit scalaire : somme de (a[i] × b[i])
    na += a[i] * a[i];     // Norme A² : somme de (a[i]²)
    nb += b[i] * b[i];     // Norme B² : somme de (b[i]²)
  }

  // Calculer le dénominateur : ||A|| × ||B||
  // Math.sqrt pour obtenir la racine carrée (norme = √(somme des carrés))
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  
  // Si dénominateur = 0, retourner 0 (éviter division par zéro)
  // Sinon, retourner cos(θ) = dot / denom
  return denom ? dot / denom : 0;
}

// ============================================
// PARTIE 3 : INDEXATION (PDF → Vector Store)
// ============================================

/**
 * Indexe un PDF : extraction → chunking → embeddings → sauvegarde JSON
 * 
 * Pipeline complet :
 * 1. Lire le PDF
 * 2. Extraire le texte
 * 3. Découper en chunks
 * 4. Calculer l'embedding de chaque chunk
 * 5. Sauvegarder dans un fichier JSON
 */
async function indexPdfToJson({
  pdfPath,                              // Chemin du PDF à indexer
  outPath,                              // Chemin de sortie (index.json)
  sourceName = 'C:\\Users\\ImenBOUSSETTA\\Desktop\\miniprojectnlp\\Sujet_Imen Boussetta.pdf',          // Nom du document (pour les métadonnées)
  chunkSize = 1200,                     // Taille d'un chunk (caractères)
  chunkOverlap = 200,                   // Chevauchement entre chunks
  embedModel = 'nomic-embed-text'       // Modèle d'embeddings Ollama
}) {
  
  // 1. LIRE LE PDF
  // Lire le fichier PDF en tant que buffer (données binaires)
  const buffer = fs.readFileSync(pdfPath);
  
  // Parser le PDF avec la classe PDFParse
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  
  // Extraire le texte brut du PDF
  const texte = parsed.text;

  // 2. DÉCOUPER EN CHUNKS
  const chunks = chunkText(texte, chunkSize, chunkOverlap);

  // 3. CALCULER LES EMBEDDINGS
  // Tableau qui va contenir tous les chunks + leurs embeddings
  const items = [];

  // Boucle sur chaque chunk
  for (let i = 0; i < chunks.length; i++) {
    const text = chunks[i];  // Texte du chunk actuel
    
    // Calculer l'embedding via Ollama (appel API)
    const embedding = await ollamaEmbeddings({ 
      model: embedModel, 
      text: text 
    });

    // Ajouter le chunk + son embedding dans le tableau
    items.push({
      id: `${sourceName}::chunk_${i + 1}`,  // Identifiant unique
      source: sourceName,                    // Nom du document source
      chunk: i + 1,                          // Numéro du chunk
      text: text,                            // Texte du chunk
      embedding: embedding                   // Vecteur d'embeddings
    });
  }

  // 4. CRÉER L'OBJET JSON FINAL
  const payload = {
    createdAt: new Date().toISOString(),  // Date de création (format ISO)
    source: sourceName,                    // Nom du document
    embedModel: embedModel,                // Modèle d'embeddings utilisé
    chunkSize: chunkSize,                  // Taille des chunks
    chunkOverlap: chunkOverlap,            // Chevauchement
    count: items.length,                   // Nombre de chunks
    items: items                           // Tableau de tous les chunks + embeddings
  };

  // 5. SAUVEGARDER DANS UN FICHIER JSON
  // Créer le dossier parent s'il n'existe pas
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  
  // Écrire le fichier JSON (avec indentation pour lisibilité)
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');

  // Retourner les statistiques d'indexation
  return { 
    chunks: items.length,   // Nombre de chunks créés
    embedModel: embedModel, // Modèle utilisé
    source: sourceName      // Nom du document
  };
}

// ============================================
// PARTIE 4 : QUESTION/RÉPONSE (Retrieval + Generation)
// ============================================

/**
 * Répond à une question en utilisant le RAG
 * 
 * Pipeline :
 * 1. Charger l'index (chunks + embeddings)
 * 2. Transformer la question en embedding
 * 3. Trouver les chunks les plus similaires (retrieval)
 * 4. Construire un prompt avec le contexte
 * 5. Générer la réponse via le LLM
 */
async function answerQuestion({
  indexPath,                          // Chemin du fichier index.json
  question,                           // Question de l'utilisateur
  topK = 5,                           // Nombre de chunks à récupérer
  chatModel = 'llama3.2',             // Modèle LLM pour la génération
  embedModel = 'nomic-embed-text'     // Modèle pour vectoriser la question
}) {
  
  // 1. CHARGER L'INDEX
  // Vérifier que le fichier existe
  if (!fs.existsSync(indexPath)) {
    throw new Error("Index introuvable. Fais d'abord l'indexation du PDF.");
  }

  // Lire le fichier JSON
  const raw = fs.readFileSync(indexPath, 'utf-8');
  
  // Parser le JSON
  const db = JSON.parse(raw);
  
  // Extraire le tableau des chunks
  const items = db?.items || [];
  
  // Vérifier que l'index n'est pas vide
  if (!items.length) {
    throw new Error('Index vide.');
  }

  // 2. VECTORISER LA QUESTION
  // Transformer la question en embedding (même modèle que l'indexation)
  const questionEmbedding = await ollamaEmbeddings({ 
    model: embedModel, 
    text: question 
  });

  // 3. RETRIEVAL (trouver les chunks les plus pertinents)
  // Calculer la similarité entre la question et TOUS les chunks
  const scored = items
    .map((item) => ({
      item: item,  // Le chunk complet (text + embedding + métadonnées)
      score: cosineSimilarity(questionEmbedding, item.embedding)  // Score de similarité
    }))
    .sort((a, b) => b.score - a.score)  // Trier par score décroissant (meilleurs en premier)
    .slice(0, topK);                    // Garder seulement les top-K

  // 4. CONSTRUIRE LE CONTEXTE
  // Concaténer les textes des top-K chunks
  const context = scored
    .map((s, idx) => `[#${idx + 1} | ${s.item.id}]\n${s.item.text}`)  // Format: [#1 | chunk_5] texte...
    .join('\n\n');  // Séparer par 2 sauts de ligne

  // 5. CONSTRUIRE LE PROMPT SYSTÈME
  // Instructions pour le LLM
  const systemPrompt = [
    'Tu es un assistant NLP.',
    'Tu réponds UNIQUEMENT à partir du CONTEXTE fourni ci-dessous.',
    "Si l'information n'est pas dans le contexte, dis clairement : 'Je ne trouve pas cette information dans le document.'",
    "À la fin de ta réponse, ajoute une section 'Sources' qui liste les IDs des chunks utilisés."
  ].join(' ');  // Joindre en une seule phrase

  // 6. CONSTRUIRE LE PROMPT UTILISATEUR
  const userPrompt = `CONTEXTE:\n${context}\n\nQUESTION:\n${question}\n\nRéponse:`;

  // 7. GÉNÉRER LA RÉPONSE
  // Appeler le LLM avec le contexte + la question
  const answer = await ollamaChat({ 
    model: chatModel, 
    system: systemPrompt, 
    user: userPrompt 
  });

  // 8. RETOURNER LA RÉPONSE + LES SOURCES
  return {
    answer: answer,  // Réponse générée par le LLM
    sources: scored.map((s) => ({  // Liste des chunks utilisés
      id: s.item.id,              // ID du chunk (ex: "document.pdf::chunk_5")
      score: Number(s.score.toFixed(4))  // Score de similarité (arrondi à 4 décimales)
    }))
  };
}

// ============================================
// EXPORTS (pour utiliser dans server.js)
// ============================================

module.exports = {
  indexPdfToJson,     // Fonction pour indexer un PDF
  answerQuestion      // Fonction pour répondre aux questions
};