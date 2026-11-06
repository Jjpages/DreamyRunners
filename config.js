window.SUPABASE_URL = 'https://hunnjhkdipnguzrmtnxp.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_sGkcfHf4xm9R1TfRwF6BKg_TStjl8k5';
window.SUPABASE_BUCKET = 'CUBO';

(function () {
  const url = window.SUPABASE_URL;
  const key = window.SUPABASE_ANON_KEY;

  if (!url || !key || typeof window.supabase === 'undefined') {
    return;
  }

  const supabase = window.supabase.createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  window.DR_SUPABASE = supabase;

  const mapFromDB = (row) => ({
    id: String(row.id ?? ''),
    titulo: row.Titulo ?? row.titulo ?? '',
    fecha: row.Fecha ?? row.fecha ?? '',
    hora: row.Hora ?? row.hora ?? '06:00',
    punto: row.Punto ?? row.punto ?? '',
    dist: row.dist ?? null,
    dif: row.dif ?? '',
    desn: row.desn ?? null,
    dur: row.dur ?? '',
    emin: row.emin ?? null,
    emax: row.emax ?? null,
    masc: row.masc ?? '',
    desc: row.Descripcion ?? row.descripcion ?? '',
    foto: row.Imagen_url ?? row.foto ?? ''
  });

  async function cargarEventos() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('Eventos')
      .select('*')
      .order('Fecha', { ascending: true });

    if (error) {
      console.warn('Supabase eventos error:', error.message);
      return;
    }

    if (!Array.isArray(data) || !data.length) {
      console.info('No hay eventos en Supabase; se deja el contenido local.');
      return;
    }

    const mapped = data.map(mapFromDB);
    if (typeof eventos !== 'undefined') {
      eventos = mapped;
      if (typeof refresh === 'function') {
        refresh();
      }
    } else {
      window.__dreamyEventosRemotos = mapped;
    }
  }

  async function subirImagen(file) {
    if (!file) return '';
    const name = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    const { data, error } = await supabase.storage.from(window.SUPABASE_BUCKET).upload(name, file, {
      cacheControl: '3600',
      upsert: true
    });
    if (error) {
      throw error;
    }
    const { data: publicData } = supabase.storage.from(window.SUPABASE_BUCKET).getPublicUrl(data.path);
    return publicData.publicUrl;
  }

  async function guardarEventoDesdeFormulario(e) {
    e.preventDefault();
    const form = e.target;
    const fileInput = form.querySelector('#ev-foto');
    const file = fileInput && fileInput.files && fileInput.files[0];

    let imagenUrl = '';
    if (file) {
      imagenUrl = await subirImagen(file);
    }

    const id = form.querySelector('#ev-id')?.value || null;
    const payload = {
      Titulo: form.querySelector('#ev-titulo')?.value?.trim() || '',
      Fecha: form.querySelector('#ev-fecha')?.value || '',
      Hora: form.querySelector('#ev-hora')?.value || '06:00',
      Punto: form.querySelector('#ev-punto')?.value?.trim() || '',
      Descripcion: form.querySelector('#ev-desc')?.value?.trim() || '',
      Imagen_url: imagenUrl || form.querySelector('#ev-prev img')?.getAttribute('src') || '',
      dist: form.querySelector('#ev-dist')?.value || null,
      dif: form.querySelector('#ev-dif')?.value || '',
      desn: form.querySelector('#ev-desn')?.value || null,
      dur: form.querySelector('#ev-dur')?.value || '',
      emin: form.querySelector('#ev-emin')?.value || null,
      emax: form.querySelector('#ev-emax')?.value || null,
      masc: form.querySelector('#ev-masc')?.value || ''
    };

    if (id) {
      payload.id = Number(id);
    }

    const { data, error } = await supabase
      .from('Eventos')
      .upsert(payload, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('Supabase upsert error:', error);
      aviso?.('No se pudo guardar el evento en Supabase.');
      return;
    }

    if (data && data[0]) {
      const mapped = mapFromDB(data[0]);
      if (typeof eventos !== 'undefined') {
        const index = eventos.findIndex((ev) => String(ev.id) === String(mapped.id));
        if (index >= 0) eventos[index] = mapped;
        else eventos.push(mapped);
      }
    }

    if (typeof refresh === 'function') refresh();
    const modal = document.getElementById('modal');
    if (modal) modal.hidden = true;
  }

  async function loginSupabase(e) {
    e.preventDefault();
    const form = e.target;
    const email = form.querySelector('#adm-user')?.value?.trim();
    const password = form.querySelector('#adm-pass')?.value;

    if (!email || !password) {
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const err = document.getElementById('login-err');
      if (err) {
        err.hidden = false;
        err.textContent = 'Usuario o clave incorrectos.';
      }
      return;
    }

    const user = data?.user;
    if (user) {
      sessionStorage.setItem('adm', '1');
      sessionStorage.setItem('adm-user', user.email || email);
      const evt = new Event('adm-auth-success');
      window.dispatchEvent(evt);
      if (typeof refresh === 'function') refresh();
    }
  }

  async function logoutSupabase() {
    await supabase.auth.signOut();
    sessionStorage.removeItem('adm');
    sessionStorage.removeItem('adm-user');
    const box = document.getElementById('login-box');
    const panel = document.getElementById('admin-box');
    if (box) box.hidden = false;
    if (panel) panel.hidden = true;
  }

  function registerSupabaseHooks() {
    const formLogin = document.getElementById('form-login');
    if (formLogin) {
      formLogin.addEventListener('submit', loginSupabase, { once: false });
    }

    const btnSalir = document.getElementById('btn-salir');
    if (btnSalir) {
      btnSalir.addEventListener('click', logoutSupabase);
    }

    const formEvento = document.getElementById('form-evento');
    if (formEvento) {
      formEvento.addEventListener('submit', guardarEventoDesdeFormulario);
    }

    const adminBox = document.getElementById('admin-box');
    if (adminBox) {
      const original = adminBox.dataset.__supabaseHooked;
      if (!original) {
        adminBox.dataset.__supabaseHooked = '1';
        window.addEventListener('adm-auth-success', () => {
          if (typeof refresh === 'function') refresh();
        });
      }
    }
  }

  window.addEventListener('load', async () => {
    registerSupabaseHooks();
    await cargarEventos();
  });
})();
