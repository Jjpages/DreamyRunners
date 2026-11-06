/* Supabase integration for Dreamy Runners. Only the publishable key belongs here. */
window.SUPABASE_URL = 'https://hunnjhkdipnguzrmtnxp.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_sGkcfHf4xm9R1TfRwF6BKg_TStjl8k5';
window.SUPABASE_BUCKET = 'CUBO';

(function () {
  'use strict';

  const URL = window.SUPABASE_URL;
  const KEY = window.SUPABASE_ANON_KEY;
  const BUCKET = window.SUPABASE_BUCKET;
  const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  let client;
  let loading = false;
  let poll;
  let lastImageUrl = '';

  const byId = (id) => document.getElementById(id);
  const toast = (message) => {
    if (typeof window.aviso === 'function') window.aviso(message);
    else console.info(message);
  };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  function mapEvent(row) {
    return {
      id: String(row.id),
      titulo: row.Titulo || '',
      fecha: row.Fecha || '',
      hora: row.Hora || '06:00',
      punto: row.Punto || '',
      dist: row.dist == null ? null : Number(row.dist),
      dif: row.dif || '',
      desn: row.desn == null ? null : Number(row.desn),
      dur: row.dur || '',
      emin: row.emin == null ? null : Number(row.emin),
      emax: row.emax == null ? null : Number(row.emax),
      masc: row.masc || '',
      desc: row.Descripcion || '',
      foto: row.Imagen_url || ''
    };
  }

  async function loadEvents() {
    if (!client || loading) return;
    loading = true;
    try {
      const { data, error } = await client.from('Eventos').select('*').order('Fecha', { ascending: true });
      if (error) throw error;
      if (typeof eventos !== 'undefined') {
        eventos = (data || []).map(mapEvent);
        if (typeof refresh === 'function') refresh();
      }
      if (isAdmin()) renderAdminEvents();
    } catch (error) {
      console.error('No se pudieron cargar los eventos de Supabase:', error);
      toast('No se pudieron cargar los eventos. Revisa la conexión y las políticas de lectura de Supabase.');
    } finally {
      loading = false;
    }
  }

  function isAdmin() {
    return !!(client && client.auth && client.auth.getSession && sessionStorage.getItem('adm') === '1');
  }

  function showAdmin(user) {
    const login = byId('login-box');
    const panel = byId('admin-box');
    const name = byId('adm-name');
    const admin = !!user;
    if (login) login.hidden = admin;
    if (panel) panel.hidden = !admin;
    if (name && user) name.textContent = user.email || 'Administrador';
    if (admin) renderAdminEvents();
  }

  function renderAdminEvents() {
    const box = byId('adm-eventos');
    if (!box || !isAdmin() || typeof eventos === 'undefined') return;
    const list = [...eventos].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    box.innerHTML = list.map((ev) => `
      <div class="card adm-ev">
        ${ev.foto ? `<img class="adm-th" src="${escapeHtml(ev.foto)}" alt="" />` : ''}
        <div style="flex:1;min-width:200px"><strong>${escapeHtml(ev.titulo)}</strong><br>
          <span class="muted">${escapeHtml(ev.fecha)} · ${escapeHtml(ev.hora)} · ${escapeHtml(ev.punto)}</span>
        </div>
        <div class="adm-btns">
          <button type="button" class="btn small" data-supa-edit="${escapeHtml(ev.id)}">Editar</button>
          <button type="button" class="btn small" data-supa-delete="${escapeHtml(ev.id)}">Eliminar</button>
        </div>
      </div>`).join('') || '<p class="muted">Aún no hay eventos guardados.</p>';
  }

  function openEventForm(eventId) {
    const modal = byId('modal');
    const form = byId('form-evento');
    if (!modal || !form) return;
    form.reset();
    const event = eventId == null ? null : eventos.find((item) => String(item.id) === String(eventId));
    byId('modal-title').textContent = event ? 'Editar evento' : 'Nuevo evento';
    byId('ev-id').value = event ? String(event.id) : '';
    byId('ev-titulo').value = event?.titulo || '';
    byId('ev-fecha').value = event?.fecha || '';
    byId('ev-hora').value = event?.hora || '06:00';
    byId('ev-punto').value = event?.punto || '';
    byId('ev-dist').value = event?.dist ?? '';
    byId('ev-dif').value = event?.dif || '';
    byId('ev-desn').value = event?.desn ?? '';
    byId('ev-dur').value = event?.dur || '';
    byId('ev-emin').value = event?.emin ?? '';
    byId('ev-emax').value = event?.emax ?? '';
    byId('ev-masc').value = event?.masc || '';
    byId('ev-desc').value = event?.desc || '';
    lastImageUrl = event?.foto || '';
    const preview = byId('ev-prev');
    if (preview) preview.innerHTML = lastImageUrl ? `<img src="${escapeHtml(lastImageUrl)}" alt="Vista previa"><span>Imagen actual</span>` : '';
    modal.hidden = false;
  }

  function numericOrNull(value) {
    if (value === '' || value == null) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  async function uploadImage(file) {
    if (!file) return lastImageUrl;
    if (!file.type.startsWith('image/')) throw new Error('El archivo seleccionado no es una imagen.');
    if (file.size > 8 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 8 MB.');
    const { data: authData } = await client.auth.getUser();
    const uid = authData?.user?.id;
    if (!uid) throw new Error('Inicia sesión como administrador antes de subir una imagen.');
    const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100) || 'imagen';
    const path = `${uid}/${Date.now()}-${safeName}`;
    const { data, error } = await client.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    });
    if (error) throw error;
    const { data: publicUrl } = client.storage.from(BUCKET).getPublicUrl(data.path);
    return publicUrl.publicUrl;
  }

  async function saveEvent(form) {
    const submit = form.querySelector('[type="submit"]');
    if (submit) { submit.disabled = true; submit.textContent = 'Guardando…'; }
    try {
      const imageInput = byId('ev-foto');
      const imageUrl = await uploadImage(imageInput?.files?.[0]);
      const payload = {
        Titulo: byId('ev-titulo').value.trim(),
        Fecha: byId('ev-fecha').value,
        Hora: byId('ev-hora').value || '06:00',
        Punto: byId('ev-punto').value.trim(),
        Descripcion: byId('ev-desc').value.trim(),
        Imagen_url: imageUrl || null,
        dist: numericOrNull(byId('ev-dist').value),
        dif: byId('ev-dif').value || null,
        desn: numericOrNull(byId('ev-desn').value),
        dur: byId('ev-dur').value.trim() || null,
        emin: numericOrNull(byId('ev-emin').value),
        emax: numericOrNull(byId('ev-emax').value),
        masc: byId('ev-masc').value || null
      };
      const id = byId('ev-id').value;
      let query = client.from('Eventos');
      if (id) query = query.update(payload).eq('id', Number(id));
      else query = query.insert(payload);
      const { error } = await query;
      if (error) throw error;
      const modal = byId('modal');
      if (modal) modal.hidden = true;
      toast('Evento guardado correctamente.');
      await loadEvents();
    } catch (error) {
      console.error('No se pudo guardar el evento:', error);
      toast(`No se pudo guardar: ${error.message || 'error de Supabase'}`);
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = 'Guardar'; }
    }
  }

  async function deleteEvent(id) {
    const event = eventos.find((item) => String(item.id) === String(id));
    if (!event || !window.confirm(`¿Eliminar el evento “${event.titulo}”? Esta acción no se puede deshacer.`)) return;
    const { error } = await client.from('Eventos').delete().eq('id', Number(id));
    if (error) {
      console.error('No se pudo eliminar el evento:', error);
      toast(`No se pudo eliminar: ${error.message}`);
      return;
    }
    toast('Evento eliminado.');
    await loadEvents();
  }

  async function login(form) {
    const emailInput = byId('adm-user');
    const passwordInput = byId('adm-pass');
    const email = emailInput?.value.trim();
    const password = passwordInput?.value;
    const errorBox = byId('login-err');
    const button = form.querySelector('[type="submit"]');
    if (button) { button.disabled = true; button.textContent = 'Ingresando…'; }
    if (errorBox) errorBox.hidden = true;
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      sessionStorage.setItem('adm', '1');
      sessionStorage.setItem('adm-user', data.user?.email || email);
      showAdmin(data.user);
      await loadEvents();
    } catch (error) {
      console.error('Falló el inicio de sesión:', error);
      if (errorBox) {
        errorBox.textContent = 'No se pudo iniciar sesión. Usa el correo invitado y la contraseña que configuraste en Supabase Auth.';
        errorBox.hidden = false;
      }
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Entrar'; }
    }
  }

  async function logout() {
    await client.auth.signOut();
    sessionStorage.removeItem('adm');
    sessionStorage.removeItem('adm-user');
    showAdmin(null);
  }

  function installHandlers() {
    const userInput = byId('adm-user');
    if (userInput) {
      userInput.type = 'email';
      userInput.placeholder = 'correo del administrador';
      userInput.autocomplete = 'username';
    }
    const demo = document.querySelector('#form-login .muted');
    if (demo) demo.textContent = 'Inicia sesión con el correo y la contraseña configurados en Supabase Auth.';

    // Capture phase prevents the former demo/localStorage admin handlers from running.
    document.addEventListener('submit', (event) => {
      if (event.target.id === 'form-login') {
        event.preventDefault();
        event.stopImmediatePropagation();
        login(event.target);
      } else if (event.target.id === 'form-evento') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.target.reportValidity()) saveEvent(event.target);
      }
    }, true);

    document.addEventListener('click', (event) => {
      const target = event.target.closest('button, input[type="button"]');
      if (!target) return;
      if (target.id === 'btn-salir') {
        event.preventDefault(); event.stopImmediatePropagation(); logout(); return;
      }
      if (target.id === 'btn-nuevo') {
        event.preventDefault(); event.stopImmediatePropagation(); openEventForm(null); return;
      }
      if (target.dataset.supaEdit) {
        event.preventDefault(); event.stopImmediatePropagation(); openEventForm(target.dataset.supaEdit); return;
      }
      if (target.dataset.supaDelete) {
        event.preventDefault(); event.stopImmediatePropagation(); deleteEvent(target.dataset.supaDelete);
      }
    }, true);

    const fileInput = byId('ev-foto');
    if (fileInput) fileInput.addEventListener('change', () => {
      const preview = byId('ev-prev');
      const file = fileInput.files?.[0];
      if (!file || !preview) return;
      const localUrl = URL.createObjectURL(file);
      preview.innerHTML = `<img src="${escapeHtml(localUrl)}" alt="Vista previa">`;
    });
  }

  function startClient() {
    if (client || !window.supabase?.createClient) return;
    client = window.supabase.createClient(URL, KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    window.DR_SUPABASE = client;
    installHandlers();

    client.auth.getSession().then(({ data }) => {
      const user = data?.session?.user || null;
      if (user) {
        sessionStorage.setItem('adm', '1');
        sessionStorage.setItem('adm-user', user.email || 'Administrador');
      } else {
        sessionStorage.removeItem('adm');
        sessionStorage.removeItem('adm-user');
      }
      showAdmin(user);
    });
    client.auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null;
      if (!user) {
        sessionStorage.removeItem('adm');
        sessionStorage.removeItem('adm-user');
      } else {
        sessionStorage.setItem('adm', '1');
        sessionStorage.setItem('adm-user', user.email || 'Administrador');
      }
      showAdmin(user);
    });

    loadEvents();
    poll = window.setInterval(loadEvents, 30000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) loadEvents();
    });
  }

  function loadSdk() {
    if (window.supabase?.createClient) return startClient();
    if (document.querySelector('script[data-dreamy-supabase-sdk]')) return;
    const script = document.createElement('script');
    script.src = CDN;
    script.async = true;
    script.dataset.dreamySupabaseSdk = 'true';
    script.onload = startClient;
    script.onerror = () => console.error('No se pudo cargar Supabase JS desde jsDelivr.');
    document.head.appendChild(script);
  }

  if (!URL || !KEY) {
    console.error('Falta configurar la URL o la clave pública de Supabase.');
    return;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadSdk, { once: true });
  else loadSdk();
})();
