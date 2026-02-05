const indexForm = document.getElementById('indexForm');
const askForm = document.getElementById('askForm');
const indexStatus = document.getElementById('indexStatus');
const answer = document.getElementById('answer');
const sources = document.getElementById('sources');
const questionInput = document.getElementById('question');

// Indexer un PDF
indexForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  indexStatus.textContent = 'Indexation en cours...';
  answer.textContent = '';
  sources.textContent = '';

  const formData = new FormData(indexForm);

  try {
    const res = await fetch('/api/index', { method: 'POST', body: formData });
    
    if (!res.ok) {
      const text = await res.text();
      indexStatus.textContent = `Erreur: ${res.status} - ${text}`;
      return;
    }

    const data = await res.json();
    indexStatus.textContent = `✓ ${data.stats.chunks} chunks indexés`;
  } catch (err) {
    indexStatus.textContent = `Erreur: ${err.message}`;
  }
});

// Poser une question
askForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const question = questionInput.value.trim();
  if (!question) return;

  answer.textContent = 'Réponse en cours...';
  sources.textContent = '';

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    if (!res.ok) {
      const text = await res.text();
      answer.textContent = `Erreur: ${res.status} - ${text}`;
      return;
    }

    const data = await res.json();
    answer.textContent = data.answer;
    sources.textContent = `Sources:\n${JSON.stringify(data.sources, null, 2)}`;
  } catch (err) {
    answer.textContent = `Erreur: ${err.message}`;
  }
});
