(function () {
  'use strict';

  const getClient = () => window.DR_SUPABASE || null;

  function mapComment(row) {
    return {
      id: String(row.id ?? ''),
      caminataId: String(row.caminata_id ?? row.caminataId ?? ''),
      autor: String(row.autor ?? ''),
      texto: String(row.texto ?? ''),
      fecha: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : ''
    };
  }

  async function loadComments() {
    const client = getClient();
    if (!client) return [];
    const { data, error } = await client.from('comentarios').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    const rows = (data || []).map(mapComment);
    window.DR_COMMENTS = rows;
    if (typeof window.renderRelatos === 'function') {
      try { window.renderRelatos(); } catch (error) { console.warn('No se pudo refrescar la vista de comentarios:', error); }
    }
    return rows;
  }

  async function saveComment({ caminataId, autor, texto }) {
    const client = getClient();
    if (!client) throw new Error('La conexión con Supabase aún no está lista.');
    const payload = {
      caminata_id: String(caminataId || '').trim(),
      autor: String(autor || '').trim(),
      texto: String(texto || '').trim()
    };

    if (!payload.caminata_id || !payload.autor || !payload.texto) {
      throw new Error('El nombre y el comentario son obligatorios.');
    }

    const { error } = await client.from('comentarios').insert(payload);
    if (error) throw error;
    await loadComments();
    return true;
  }

  window.DR_SAVE_COMMENT = saveComment;
  window.DR_LOAD_COMMENTS = loadComments;

  window.addEventListener('load', () => {
    const originalRender = window.renderRelatos;
    if (typeof originalRender !== 'function') return;

    window.renderRelatos = function renderRelatosFromSupabase() {
      const box = document.getElementById('relatos');
      if (!box || !Array.isArray(window.DR_COMMENTS) || !window.DR_COMMENTS.length) {
        return originalRender.apply(this, arguments);
      }

      const q = (document.getElementById('buscar')?.value || '').trim().toLowerCase();
      const posts = typeof window.pasadas === 'function' ? window.pasadas() : [];
      const list = posts.filter((post) => {
        const haystack = [post.titulo, fmtMes(post.fecha), window.DR_COMMENTS.filter((r) => String(r.caminataId) === String(post.id)).map((r) => `${r.autor} ${r.texto}`).join(' ')].join(' ').toLowerCase();
        return !q || haystack.includes(q);
      });

      box.innerHTML = list.map((post) => {
        const comments = (window.DR_COMMENTS || []).filter((comment) => String(comment.caminataId) === String(post.id));
        const coms = comments.length
          ? comments.map((comment) => `<div class="com"><strong>${esc(comment.autor)}</strong><span>${esc(comment.texto)}</span></div>`).join('')
          : '<p class="muted" style="margin:0">Aún no hay comentarios en esta caminata.</p>';
        const meta = [fmtMes(post.fecha), km(post) ? esc(km(post)) : ''].filter(Boolean).join(' · ');
        return `<article class="card past" id="post-${esc(post.id)}">
          <img class="cover" src="${esc(post.foto)}" alt="${esc(post.titulo)}" loading="lazy" />
          <div class="body"><h4>${esc(post.titulo)}</h4><div class="meta muted">${meta}</div>
            <div class="coms">${coms}</div>
            <form class="com-form" data-post="${esc(post.id)}">
              <input name="autor" placeholder="Tu nombre" required maxlength="40" value="${esc(localStorage.getItem('senderismo_nombre') || '')}" />
              <div class="emo">${['😀', '😍', '👏', '🔥', '🥾', '⛰️', '💚'].map((emoji) => `<button type="button" class="emo-btn" data-emo="${emoji}" aria-label="Agregar ${emoji}">${emoji}</button>`).join('')}</div>
              <div class="com-row"><input name="texto" placeholder="Escribe un comentario…" required maxlength="300" /><button class="btn small" type="submit">Comentar</button></div>
            </form></div></article>`;
      }).join('') || '<p class="muted">No encontramos publicaciones con esa búsqueda.</p>';

      const emoButtons = box.querySelectorAll('[data-emo]');
      emoButtons.forEach((button) => {
        button.addEventListener('click', () => {
          const form = button.closest('form');
          const input = form?.elements?.texto;
          if (input) {
            input.value += button.dataset.emo;
            input.focus();
          }
        });
      });

      return undefined;
    };

    document.addEventListener('submit', async (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.matches('.com-form')) return;
      event.preventDefault();
      const autor = (form.elements.autor?.value || '').trim();
      const texto = (form.elements.texto?.value || '').trim();
      if (!autor || !texto) return;
      try {
        await saveComment({ caminataId: form.dataset.post, autor, texto });
        try { localStorage.setItem('senderismo_nombre', autor); } catch (error) {}
        form.reset();
        if (typeof window.aviso === 'function') window.aviso('Comentario guardado en Supabase.');
        if (typeof window.renderRelatos === 'function') window.renderRelatos();
      } catch (error) {
        console.error('No se pudo guardar el comentario en Supabase:', error);
        if (typeof window.aviso === 'function') window.aviso(error.message || 'No se pudo guardar el comentario.');
      }
    }, true);

    if (typeof window.DR_LOAD_COMMENTS === 'function') {
      window.DR_LOAD_COMMENTS().catch((error) => console.error('No se pudieron cargar los comentarios de Supabase:', error));
    }
  });
})();
