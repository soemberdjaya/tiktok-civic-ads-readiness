import type { Docs } from './docs.en';

/** Indonesian copy for the Rules page. */
export const docs: Docs = {
  title: 'Aturan',
  lead: 'Rubrik, skor, validator, prompt, dan sumber yang dipakai saat audit.',
  stats: { sources: 'sumber', clauses: 'klausul', keys: 'kunci', quotes: 'kutipan', summaries: 'ringkasan' },
  toc: 'Isi',
  copy: 'Salin',
  copied: 'Disalin',
  copyLink: 'Salin tautan',
  file: 'berkas',
  sections: {
    pipeline: 'Pipeline',
    rubric: 'Rubrik',
    scoring: 'Skor',
    validation: 'Validator',
    schema: 'Skema output',
    prompt: 'Prompt',
    lexicon: 'Leksikon',
    sources: 'Sumber',
    contributing: 'Kontribusi',
  },
  pipeline: {
    steps: [
      { name: 'prepare', file: 'src/prepare/media.ts', body: 'Gambar ≤ 1.568 px. Video 1 fps, 768 px. Subtitle opsional.' },
      { name: 'prompt', file: 'src/prompt/build.ts', body: 'Prinsip + rubrik + klausul per mode.' },
      { name: 'provider', file: 'src/providers/*.ts', body: 'JSON schema → mode JSON → teks.' },
      { name: 'validate', file: 'src/validate/findings.ts', body: 'zod, lokasi, klausul. Maks. 1 coba ulang.' },
      { name: 'lexicon', file: 'src/validate/lexicon.ts', body: 'Tambah K1 yang terlewat, tolak saran samaran.' },
      { name: 'score', file: 'src/scoring/score.ts', body: 'Dihitung kode. Hasil disimpan, tidak diubah.' },
    ],
  },
  rubric: {
    cols: { key: 'Kunci', category: 'Kategori', weight: 'Bobot', trigger: 'Arti', clauses: 'Klausul' },
    category: { policy: 'kebijakan', landing: 'landing', law: 'hukum' },
  },
  scoring: {
    rules: ['F: satu kali per kunci, keyakinan tertinggi.', 'K < 0,6: Tinggi, tidak memblokir.', 'L: tidak memengaruhi skor.'],
    bands: 'Status',
    condition: 'Syarat',
  },
  validation: {
    cols: { check: 'Cek', reject: 'Ditolak bila', retry: 'Ulang' },
    rows: [
      { check: 'Output', reject: 'Bukan JSON { findings: [...] }', retry: true },
      { check: 'Temuan', reject: 'Tidak lolos schema zod', retry: true },
      { check: 'Kunci', reject: 'Tidak ada di rubrik', retry: false },
      { check: 'Klausul', reject: 'Tidak ada di pustaka / tidak berlaku untuk kunci', retry: false },
      { check: 'Teks', reject: 'Kutipan tidak ada persis di input', retry: true },
      { check: 'Gambar', reject: 'Slide di luar jumlah, kotak di luar 0–1', retry: true },
      { check: 'Video', reject: 'Waktu di luar durasi', retry: true },
      { check: 'Saran', reject: 'Menyamarkan nama (G*rindra, P4rtai, P.D.I.) → diganti hapus', retry: false },
    ],
  },
  lexicon: {
    normalization: 'Normalisasi',
    normRules: ['4→a 3→e 1→i 0→o 5→s 7→t @→a $→s', 'buang * # . _ - \' ` ~ ^ di dalam kata', 'Levenshtein ≤ 1 untuk kata ≥ 5 huruf', 'singkatan hanya bila kapital'],
    cols: { label: 'Entri', names: 'Nama', acronyms: 'Singkatan' },
  },
  sources: {
    filterPlaceholder: 'Saring: K3, petisi, landing…',
    jurisdiction: { tiktok: 'TikTok', id: 'Indonesia' },
    meta: { id: 'id', updated: 'sumber', bundled: 'dibundel', watch: 'pantau', hash: 'sha256' },
    showYaml: 'YAML',
    hideYaml: 'Tutup',
    noMatch: 'Tidak ada yang cocok.',
    notWatched: '—',
  },
  contributing: {
    template: 'rules/tiktok/contoh.yaml',
    commands: 'Perintah',
  },
};
