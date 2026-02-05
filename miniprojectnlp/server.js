// ============================================
// SERVER.JS - Serveur Express pour l'API RAG
// ============================================
// Ce fichier crée un serveur web qui :
// 1. Permet d'uploader et indexer un PDF
// 2. Permet de poser des questions sur le PDF
// 3. Sert l'interface web (HTML/CSS/JS)

// ============================================
// IMPORTS
// ============================================

// Module Express (framework web)
const express = require('express');

// Module Multer (pour gérer l'upload de fichiers)
const multer = require('multer');

// Modules Node.js natifs
const path = require('path');  // Manipulation de chemins de fichiers
const fs = require('fs');      // Lecture/écriture de fichiers

// Nos fonctions RAG (depuis rag.js)
const { indexPdfToJson, answerQuestion } = require('./rag');

// ============================================
// CONFIGURATION
// ============================================

// Port du serveur (3000 par défaut, ou variable d'environnement)
const PORT = process.env.PORT || 3000;

// Dossier pour stocker les données
const DATA_DIR = path.join(__dirname, 'data');

// Dossier pour stocker les PDFs uploadés
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Chemin du fichier index.json (base vectorielle)
const INDEX_PATH = path.join(DATA_DIR, 'index.json');

// Créer le dossier uploads s'il n'existe pas
// { recursive: true } = créer tous les dossiers parents si nécessaire
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ============================================
// CONFIGURATION MULTER (upload de fichiers)
// ============================================

// Configurer Multer pour sauvegarder les fichiers uploadés dans UPLOADS_DIR
// Avec diskStorage pour garder l'extension du fichier
const storage = multer.diskStorage({
	// Définir le dossier de destination
	destination: (req, file, cb) => {
		cb(null, UPLOADS_DIR);
	},
	// Définir le nom du fichier (garder l'extension)
	filename: (req, file, cb) => {
		// Générer un nom unique : timestamp + nom original
		const uniqueName = Date.now() + '-' + file.originalname;
		cb(null, uniqueName);
	}
});

const upload = multer({ storage: storage });

// ============================================
// CRÉATION DE L'APPLICATION EXPRESS
// ============================================

const app = express();

// ============================================
// MIDDLEWARE
// ============================================

// Middleware pour parser le JSON dans les requêtes POST
// Limite de 2 Mo pour éviter les requêtes trop volumineuses
app.use(express.json({ limit: '2mb' }));

// Middleware pour servir les fichiers statiques (HTML, CSS, JS)
// Tout ce qui est dans le dossier 'public/' sera accessible via le navigateur
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// ROUTES API
// ============================================

/**
 * Route de santé (health check)
 * GET /api/health
 * Permet de vérifier que le serveur fonctionne
 */
app.get('/api/health', (req, res) => {
	res.json({ ok: true, message: 'Serveur RAG opérationnel' });
});

/**
 * Route d'indexation d'un PDF
 * POST /api/index
 * Body: FormData avec un fichier PDF (clé: 'pdf')
 * Retourne: statistiques d'indexation (nombre de chunks, modèle, etc.)
 */
app.post('/api/index', upload.single('pdf'), async (req, res) => {
	try {
		// Vérifier qu'un fichier a bien été uploadé
		// req.file est ajouté par Multer quand un fichier est uploadé
		if (!req.file) return res.status(400).json({ error: 'Aucun fichier PDF uploadé' });

		console.log(`📄 Indexation de: ${req.file.originalname}`);

		// Appeler la fonction d'indexation du rag.js
		const stats = await indexPdfToJson({
			pdfPath: req.file.path,                                // Chemin du PDF uploadé
			outPath: INDEX_PATH,                                   // Où sauvegarder l'index
			sourceName: req.file.originalname || 'document.pdf',   // Nom du document
			chunkSize: 1200,                                       // Taille des chunks
			chunkOverlap: 200,                                     // Chevauchement
			embedModel: process.env.EMBED_MODEL || 'nomic-embed-text' // Modèle d'embeddings
		});

		console.log(`✅ Indexation terminée: ${stats.chunks} chunks créés`);

		// Retourner les statistiques
		res.json({ ok: true, indexPath: 'data/index.json', stats });
	} catch (e) {
		// En cas d'erreur, logger et retourner une erreur 500
		console.error('❌ Erreur indexation:', e.message);
		res.status(500).json({ error: String(e?.message || e) });
	}
});

/**
 * Route de question/réponse
 * POST /api/ask
 * Body: { "question": "Quels sont les objectifs ?" }
 * Retourne: { "answer": "...", "sources": [...] }
 */
app.post('/api/ask', async (req, res) => {
	try {
		// Récupérer la question depuis le body
		const question = String(req.body?.question || '').trim();
		
		// Vérifier que la question n'est pas vide
		if (!question) return res.status(400).json({ error: 'Question vide' });

		console.log(`❓ Question: ${question}`);

		// Appeler la fonction de réponse du rag.js
		const result = await answerQuestion({
			indexPath: INDEX_PATH,                                 // Chemin de l'index
			question: question,                                    // Question de l'utilisateur
			topK: 5,                                               // Nombre de chunks à récupérer
			chatModel: process.env.CHAT_MODEL || 'llama3.2',      // Modèle LLM
			embedModel: process.env.EMBED_MODEL || 'nomic-embed-text' // Modèle embeddings
		});

		console.log(`✅ Réponse générée (${result.sources.length} sources)`);

		// Retourner la réponse + les sources
		res.json({ ok: true, ...result });
	} catch (e) {
		// En cas d'erreur (index manquant, Ollama down, etc.)
		console.error('❌ Erreur réponse:', e.message);
		res.status(500).json({ error: String(e?.message || e) });
	}
});

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================

app.listen(PORT, () => {
	console.log('');
	console.log('🚀 ========================================');
	console.log(`   Serveur RAG démarré !`);
	console.log('🚀 ========================================');
	console.log('');
	console.log(`   📍 Serveur web:    http://localhost:${PORT}`);
	console.log(`   📍 API Health:     http://localhost:${PORT}/api/health`);
	console.log(`   📍 Ollama API:     http://localhost:11434`);
	console.log('');
	console.log('   📦 Modèles requis:');
	console.log('      - ollama pull llama3.2');
	console.log('      - ollama pull nomic-embed-text');
	console.log('');
	console.log('   📂 Dossiers:');
	console.log(`      - Uploads: ${UPLOADS_DIR}`);
	console.log(`      - Index:   ${INDEX_PATH}`);
	console.log('');
	console.log('🚀 ========================================');
	console.log('');
});
