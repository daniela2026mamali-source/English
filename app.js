/* ==========================================================
   واژه‌یار — app.js
   ========================================================== */
'use strict';

/* ---------------------------------------------------------
   ۱) ابزارهای کمکی
   --------------------------------------------------------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const faNum = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalize = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

let toastTimer;
function toast(msg, type = 'info') {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = type; }, 2200);
}

/* ---------------------------------------------------------
   ۲) ذخیره‌سازی
   --------------------------------------------------------- */
const WORDS_KEY    = 'vazheyar.words.v1';
const SETTINGS_KEY = 'vazheyar.settings.v1';

let words = [];
let settings = {
  fcDir: 'en-fa',
  quizType: 'en2fa',
  quizCount: 10,
  speechRate: 0.9
};

function loadData() {
  try {
    const raw = localStorage.getItem(WORDS_KEY);
    words = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(words)) words = [];
  } catch (e) { words = []; }

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) settings = Object.assign(settings, JSON.parse(raw));
  } catch (e) { /* ignore */ }
}

function saveWords() {
  try {
    localStorage.setItem(WORDS_KEY, JSON.stringify(words));
  } catch (e) {
    toast('خطا در ذخیره‌سازی', 'error');
  }
  updateWordCount();
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
}

function updateWordCount() {
  const el = $('#wordCount');
  if (el) el.textContent = `${faNum(words.length)} واژه`;
}

/* ---------------------------------------------------------
   ۳) تلفظ
   --------------------------------------------------------- */
function speak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = Number(settings.speechRate) || 0.9;
    window.speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}

/* ---------------------------------------------------------
   ۴) ناوبری بین نماها
   --------------------------------------------------------- */
let currentView = 'home';

function switchView(name) {
  currentView = name;

  $$('.view').forEach(v => v.classList.toggle('is-active', v.id === 'view-' + name));
  $$('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.view === name));

  if (name === 'home')     { renderWordList(); }
  if (name === 'cards')    { initFlashcards(); }
  if (name === 'quiz')     { resetQuizUI(); }
  if (name === 'settings') { renderStats(); }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------------------------------------------------------
   ۵) فرم افزودن / ویرایش
   --------------------------------------------------------- */
let editingId = null;

function resetForm() {
  editingId = null;
  $('#wordForm').reset();
  $('#formTitle').textContent = 'افزودن واژهٔ جدید';
  $('#submitBtn').textContent = 'ذخیرهٔ واژه';
  $('#cancelEdit').classList.add('hidden');
}

function startEdit(id) {
  const w = words.find(x => x.id === id);
  if (!w) return;
  editingId = id;
  $('#f-en').value   = w.en || '';
  $('#f-fa').value   = w.fa || '';
  $('#f-ex').value   = w.example || '';
  $('#f-exfa').value = w.exampleFa || '';
  $('#formTitle').textContent = 'ویرایش واژه';
  $('#submitBtn').textContent = 'ذخیرهٔ تغییرات';
  $('#cancelEdit').classList.remove('hidden');
  switchView('home');
  $('#wordForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#f-en').focus();
}

function handleFormSubmit(e) {
  e.preventDefault();

  const en      = $('#f-en').value.trim();
  const fa      = $('#f-fa').value.trim();
  const example = $('#f-ex').value.trim();
  const exFa    = $('#f-exfa').value.trim();

  if (!en || !fa) {
    toast('واژهٔ انگلیسی و معنی فارسی الزامی است', 'error');
    return;
  }

  if (editingId) {
    const w = words.find(x => x.id === editingId);
    if (w) {
      Object.assign(w, { en, fa, example, exampleFa: exFa });
      toast('واژه ویرایش شد ✓', 'success');
    }
  } else {
    words.unshift({
      id: uid(),
      en, fa,
      example,
      exampleFa: exFa,
      level: 0,
      correct: 0,
      wrong: 0,
      createdAt: Date.now(),
      lastReview: null
    });
    toast('واژه ذخیره شد ✓', 'success');
  }

  saveWords();
  resetForm();
  renderWordList();
  $('#f-en').focus();
}

function deleteWord(id) {
  const w = words.find(x => x.id === id);
  if (!w) return;
  if (!confirm(`«${w.en}» حذف شود؟`)) return;
  words = words.filter(x => x.id !== id);
  saveWords();
  renderWordList();
  if (editingId === id) resetForm();
  toast('حذف شد', 'info');
}

/* ---------------------------------------------------------
   ۶) رندر لیست واژه‌ها
   --------------------------------------------------------- */
function renderWordList() {
  const box = $('#wordList');
  if (!box) return;

  const q = normalize($('#search')?.value || '');
  const list = q
    ? words.filter(w =>
        normalize(w.en).includes(q) ||
        normalize(w.fa).includes(q) ||
        normalize(w.example).includes(q))
    : words;

  box.innerHTML = '';

  if (!list.length) {
    box.innerHTML = `<div class="empty">${
      words.length
        ? 'چیزی پیدا نشد 🔍'
        : 'هنوز واژه‌ای اضافه نکرده‌اید.<br>از فرم بالا شروع کنید 👆'
    }</div>`;
    return;
  }

  const frag = document.createDocumentFragment();

  list.forEach(w => {
    const lvl = Math.max(0, Math.min(5, w.level || 0));
    const el = document.createElement('div');
    el.className = 'word-item';

    el.innerHTML = `
      <div class="wi-main">
        <div class="wi-head">
          <span class="wi-en" dir="ltr">${esc(w.en)}</span>
          <button type="button" class="icon-btn" data-act="speak" title="تلفظ">🔊</button>
          <span class="lvl" title="سطح یادگیری">${'●'.repeat(lvl)}${'○'.repeat(5 - lvl)}</span>
        </div>
        <div class="wi-fa">${esc(w.fa)}</div>
        ${w.example ? `<div class="wi-ex" dir="ltr">${esc(w.example)}</div>` : ''}
        ${w.exampleFa ? `<div class="wi-exfa">${esc(w.exampleFa)}</div>` : ''}
      </div>
      <div class="wi-actions">
        <button type="button" class="icon-btn" data-act="edit" title="ویرایش">✏️</button>
        <button type="button" class="icon-btn" data-act="del" title="حذف">🗑️</button>
      </div>
    `;

    el.querySelector('[data-act="speak"]').addEventListener('click', () => speak(w.en));
    el.querySelector('[data-act="edit"]').addEventListener('click', () => startEdit(w.id));
    el.querySelector('[data-act="del"]').addEventListener('click', () => deleteWord(w.id));

    frag.appendChild(el);
  });

  box.appendChild(frag);
}

/* ---------------------------------------------------------
   ۷) فلش‌کارت
   --------------------------------------------------------- */
const fc = { queue: [], i: 0, right: 0, wrong: 0 };

function initFlashcards() {
  if (!words.length) {
    fc.queue = [];
    fc.i = 0;
    renderFlashcardEmpty();
    return;
  }

  // مرتب‌سازی: واژه‌های ضعیف‌تر اول
  const shuffled = shuffle(words);
  fc.queue = shuffled
    .map((w, idx) => ({ w, idx }))
    .sort((a, b) => {
      const la = a.w.level || 0, lb = b.w.level || 0;
      if (la !== lb) return la - lb;
      const ra = a.w.lastReview || 0, rb = b.w.lastReview || 0;
      if (ra !== rb) return ra - rb;
      return a.idx - b.idx;
    })
    .map(o => o.w);

  fc.i = 0;
  fc.right = 0;
  fc.wrong = 0;
  renderFlashcard();
}

function renderFlashcardEmpty() {
  const card = $('#flashcard');
  card.classList.remove('is-flipped');
  $('#fcFrontChip').textContent = '—';
  $('#fcBackChip').textContent = '—';
  $('#fcFront').textContent = 'واژه‌ای وجود ندارد';
  $('#fcBack').textContent = '';
  $('#fcExample').innerHTML = '<div class="ex-fa">ابتدا از بخش «واژه‌ها» لغت اضافه کنید.</div>';
  $('#fcCounter').textContent = '۰ / ۰';
  $('#fcProgress').style.width = '0%';
  $('#fcSpeak').classList.add('hidden');
  $('#fcRight').disabled = true;
  $('#fcWrong').disabled = true;
}

function renderFlashcard() {
  const card = $('#flashcard');
  card.classList.remove('is-flipped');

  if (!words.length) { renderFlashcardEmpty(); return; }

  $('#fcRight').disabled = false;
  $('#fcWrong').disabled = false;

  if (fc.i >= fc.queue.length) {
    $('#fcFrontChip').textContent = 'پایان';
    $('#fcBackChip').textContent = '—';
    $('#fcFront').textContent = '🎉 دور تمام شد!';
    $('#fcBack').textContent = '';
    $('#fcExample').innerHTML =
      `<div class="ex-fa">درست: ${faNum(fc.right)} — نادرست: ${faNum(fc.wrong)}</div>`;
    $('#fcCounter').textContent = `${faNum(fc.queue.length)} / ${faNum(fc.queue.length)}`;
    $('#fcProgress').style.width = '100%';
    $('#fcSpeak').classList.add('hidden');
    $('#fcRight').disabled = true;
    $('#fcWrong').disabled = true;
    return;
  }

  const w = fc.queue[fc.i];
  const enFirst = settings.fcDir !== 'fa-en';

  $('#fcFrontChip').textContent = enFirst ? 'انگلیسی' : 'فارسی';
  $('#fcBackChip').textContent  = enFirst ? 'فارسی'  : 'انگلیسی';

  const front = $('#fcFront');
  const back  = $('#fcBack');

  front.textContent = enFirst ? w.en : w.fa;
  front.dir = enFirst ? 'ltr' : 'rtl';

  back.textContent = enFirst ? w.fa : w.en;
  back.dir = enFirst ? 'rtl' : 'ltr';

  let exHtml = '';
  if (w.example)   exHtml += `<div class="ex-en" dir="ltr">${esc(w.example)}</div>`;
  if (w.exampleFa) exHtml += `<div class="ex-fa">${esc(w.exampleFa)}</div>`;
  $('#fcExample').innerHTML = exHtml;

  $('#fcSpeak').classList.toggle('hidden', !enFirst);
  $('#fcCounter').textContent = `${faNum(fc.i + 1)} / ${faNum(fc.queue.length)}`;
  $('#fcProgress').style.width = ((fc.i / fc.queue.length) * 100).toFixed(1) + '%';
}

function flipCard() {
  if (!fc.queue.length || fc.i >= fc.queue.length) return;
  $('#flashcard').classList.toggle('is-flipped');
}

function answerFlashcard(known) {
  if (!fc.queue.length || fc.i >= fc.queue.length) return;

  const w = fc.queue[fc.i];

  if (known) {
    w.level = Math.min(5, (w.level || 0) + 1);
    w.correct = (w.correct || 0) + 1;
    fc.right++;
  } else {
    w.level = Math.max(0, (w.level || 0) - 1);
    w.wrong = (w.wrong || 0) + 1;
    fc.wrong++;
  }
  w.lastReview = Date.now();
  saveWords();

  fc.i++;
  renderFlashcard();
}

/* ---------------------------------------------------------
   ۸) موتور آزمون
   --------------------------------------------------------- */
const quiz = {
  questions: [],
  i: 0,
  score: 0,
  answered: false
};

function makeOptions(correct, pool, key) {
  const opts = [correct];
  const others = shuffle(pool.filter(w => w[key] && w[key] !== correct));

  for (const w of others) {
    if (opts.length >= 4) break;
    if (!opts.includes(w[key])) opts.push(w[key]);
  }
  return shuffle(opts);
}

function makeChoice(w, pool, type) {
  const en2fa = type === 'en2fa';
  const answer = en2fa ? w.fa : w.en;
  if (!w.en || !w.fa || !answer) return null;

  return {
    kind: 'choice',
    label: en2fa ? 'معنی فارسی این واژه چیست؟' : 'معادل انگلیسی این واژه چیست؟',
    prompt: en2fa ? w.en : w.fa,
    promptDir: en2fa ? 'ltr' : 'rtl',
    optionsDir: en2fa ? 'rtl' : 'ltr',
    speakText: en2fa ? w.en : null,
    sub: '',
    answer,
    options: makeOptions(answer, pool, en2fa ? 'fa' : 'en'),
    wordId: w.id
  };
}

function makeBlank(w, pool) {
  if (!w.en || !w.example) return null;

  let re;
  try {
    re = new RegExp(`\\b${escapeRegExp(w.en)}\\b`, 'i');
  } catch (e) { return null; }

  if (!re.test(w.example)) return null;

  return {
    kind: 'choice',
    label: 'جای خالی را کامل کنید:',
    prompt: w.example.replace(re, '______'),
    promptDir: 'ltr',
    optionsDir: 'ltr',
    speakText: null,
    sub: w.exampleFa || '',
    answer: w.en,
    options: makeOptions(w.en, pool, 'en'),
    wordId: w.id
  };
}

function makeTyping(w) {
  if (!w.en || !w.fa) return null;
  return {
    kind: 'typing',
    label: 'معادل انگلیسی این واژه را بنویسید:',
    prompt: w.fa,
    promptDir: 'rtl',
    optionsDir: 'ltr',
    speakText: null,
    sub: '',
    answer: w.en,
    options: [],
    wordId: w.id
  };
}

function buildQuestions(type, count) {
  const pool = shuffle(words);
  const limit = count > 0 ? count : pool.length;
  const qs = [];

  for (const w of pool) {
    if (qs.length >= limit) break;

    let q = null;
    if (type === 'blank')       q = makeBlank(w, pool) || makeChoice(w, pool, 'en2fa');
    else if (type === 'typing') q = makeTyping(w);
    else                        q = makeChoice(w, pool, type);

    if (q) qs.push(q);
  }
  return qs;
}

function resetQuizUI() {
  $('#quizSetup').classList.remove('hidden');
  $('#quizPlay').classList.add('hidden');
  $('#quizResult').classList.add('hidden');
}

function startQuiz() {
  if (words.length < 2) {
    toast('حداقل ۲ واژه برای آزمون لازم است', 'error');
    return;
  }

  const qs = buildQuestions(settings.quizType, settings.quizCount);
  if (!qs.length) {
    toast('سؤالی ساخته نشد. واژه‌های بیشتری اضافه کنید.', 'error');
    return;
  }

  quiz.questions = qs;
  quiz.i = 0;
  quiz.score = 0;
  quiz.answered = false;

  $('#quizSetup').classList.add('hidden');
  $('#quizResult').classList.add('hidden');
  $('#quizPlay').classList.remove('hidden');

  renderQuestion();
}

function renderQuestion() {
  const q = quiz.questions[quiz.i];
  quiz.answered = false;

  $('#quizFeedback').textContent = '';
  $('#quizFeedback').className = 'feedback';
  $('#quizNext').classList.add('hidden');

  $('#quizProgressText').textContent =
    `سؤال ${faNum(quiz.i + 1)} از ${faNum(quiz.questions.length)}`;
  $('#quizScore').textContent = `امتیاز: ${faNum(quiz.score)}`;
  $('#quizProgress').style.width = ((quiz.i / quiz.questions.length) * 100).toFixed(1) + '%';

  $('#quizPromptLabel').textContent = q.label;

  const promptEl = $('#quizPrompt');
  promptEl.textContent = q.prompt;
  promptEl.dir = q.promptDir || 'auto';
  promptEl.classList.toggle('ltr', q.promptDir === 'ltr');

  $('#quizSub').textContent = q.sub || '';

  const optionsBox = $('#quizOptions');
  optionsBox.innerHTML = '';

  const typingRow = $('#quizTypingRow');

  if (q.kind === 'typing') {
    typingRow.classList.remove('hidden');
    const inp = $('#quizTypingInput');
    inp.value = '';
    inp.disabled = false;
    setTimeout(() => inp.focus(), 120);
  } else {
    typingRow.classList.add('hidden');

    q.options.forEach(opt => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'option';
      b.textContent = opt;
      b.dir = q.optionsDir || 'auto';
      b.addEventListener('click', () => answerChoice(b, opt, q));
      optionsBox.appendChild(b);
    });
  }
}

function answerChoice(btn, value, q) {
  if (quiz.answered) return;
  quiz.answered = true;

  const correct = normalize(value) === normalize(q.answer);

  $$('#quizOptions .option').forEach(b => {
    b.disabled = true;
    if (normalize(b.textContent) === normalize(q.answer)) b.classList.add('correct');
  });

  if (!correct) btn.classList.add('wrong');

  finishAnswer(correct, q);
}

function submitTyping() {
  if (quiz.answered) return;

  const inp = $('#quizTypingInput');
  const val = inp.value.trim();
  if (!val) { inp.focus(); return; }

  const q = quiz.questions[quiz.i];
  quiz.answered = true;
  inp.disabled = true;

  const correct = normalize(val) === normalize(q.answer);
  finishAnswer(correct, q);
}

function finishAnswer(correct, q) {
  const w = words.find(x => x.id === q.wordId);

  if (w) {
    if (correct) {
      w.correct = (w.correct || 0) + 1;
      w.level = Math.min(5, (w.level || 0) + 1);
    } else {
      w.wrong = (w.wrong || 0) + 1;
      w.level = Math.max(0, (w.level || 0) - 1);
    }
    w.lastReview = Date.now();
    saveWords();
  }

  if (correct) quiz.score++;
  $('#quizScore').textContent = `امتیاز: ${faNum(quiz.score)}`;

  const fb = $('#quizFeedback');
  if (correct) {
    fb.textContent = '✅ درست بود!';
    fb.className = 'feedback ok';
  } else {
    fb.textContent = `❌ پاسخ درست: ${q.answer}`;
    fb.className = 'feedback bad';
  }

  const nextBtn = $('#quizNext');
  nextBtn.textContent = (quiz.i === quiz.questions.length - 1) ? 'دیدن نتیجه' : 'سؤال بعدی';
  nextBtn.classList.remove('hidden');
}

function nextQuestion() {
  quiz.i++;
  if (quiz.i >= quiz.questions.length) {
    showQuizResult();
  } else {
    renderQuestion();
  }
}

function showQuizResult() {
  $('#quizPlay').classList.add('hidden');
  $('#quizResult').classList.remove('hidden');

  const total = quiz.questions.length;
  const pct = Math.round((quiz.score / total) * 100);

  let emoji = '💪', title = 'باز هم تمرین کن';
  if (pct >= 90)      { emoji = '🏆'; title = 'فوق‌العاده!'; }
  else if (pct >= 70) { emoji = '🎉'; title = 'عالی بود!'; }
  else if (pct >= 50) { emoji = '👍'; title = 'خوب بود'; }

  $('#resultEmoji').textContent = emoji;
  $('#resultTitle').textContent = title;
  $('#resultScore').textContent = `${faNum(quiz.score)} از ${faNum(total)} — ${faNum(pct)}٪`;
  $('#resultDetail').textContent =
    pct >= 70 ? 'واژه‌های این آزمون به سطح بالاتری منتقل شدند.'
              : 'واژه‌های اشتباه دوباره در فلش‌کارت‌ها زودتر ظاهر می‌شوند.';
}

/* ---------------------------------------------------------
   ۹) آمار
   --------------------------------------------------------- */
function renderStats() {
  const box = $('#statsBox');
  if (!box) return;

  const total   = words.length;
  const learned = words.filter(w => (w.level || 0) >= 4).length;
  const learning = words.filter(w => (w.level || 0) > 0 && (w.level || 0) < 4).length;
  const fresh   = words.filter(w => (w.level || 0) === 0).length;

  const totalCorrect = words.reduce((s, w) => s + (w.correct || 0), 0);
  const totalWrong   = words.reduce((s, w) => s + (w.wrong || 0), 0);
  const acc = (totalCorrect + totalWrong) > 0
    ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100)
    : 0;

  box.innerHTML = `
    <div class="stat"><b>${faNum(total)}</b><span>کل واژه‌ها</span></div>
    <div class="stat"><b>${faNum(learned)}</b><span>یاد گرفته</span></div>
    <div class="stat"><b>${faNum(learning)}</b><span>در حال یادگیری</span></div>
    <div class="stat"><b>${faNum(fresh)}</b><span>جدید</span></div>
    <div class="stat"><b>${faNum(acc)}٪</b><span>دقت پاسخ‌ها</span></div>
    <div class="stat"><b>${faNum(totalCorrect)}</b><span>پاسخ درست</span></div>
  `;
}

/* ---------------------------------------------------------
   ۱۰) ورود / خروج داده
   --------------------------------------------------------- */
function exportData() {
  const payload = {
    app: 'vazheyar',
    version: 1,
    exportedAt: new Date().toISOString(),
    words,
    settings
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vazheyar-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('فایل پشتیبان ساخته شد ✓', 'success');
}

function importData(file) {
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const incoming = Array.isArray(data) ? data : data.words;

      if (!Array.isArray(incoming)) throw new Error('bad format');

      const cleaned = incoming
        .filter(w => w && w.en && w.fa)
        .map(w => ({
          id: w.id || uid(),
          en: String(w.en).trim(),
          fa: String(w.fa).trim(),
          example: String(w.example || '').trim(),
          exampleFa: String(w.exampleFa || '').trim(),
          level: Number(w.level) || 0,
          correct: Number(w.correct) || 0,
          wrong: Number(w.wrong) || 0,
          createdAt: w.createdAt || Date.now(),
          lastReview: w.lastReview || null
        }));

      if (!cleaned.length) throw new Error('empty');

      const replace = confirm(
        `${faNum(cleaned.length)} واژه پیدا شد.\n\n` +
        `«تأیید» = جایگزینی کامل لیست فعلی\n«لغو» = افزودن به لیست فعلی`
      );

      if (replace) {
        words = cleaned;
      } else {
        const existing = new Set(words.map(w => normalize(w.en)));
        const merged = cleaned.filter(w => !existing.has(normalize(w.en)));
        words = words.concat(merged);
      }

      if (data.settings && typeof data.settings === 'object') {
        settings = Object.assign(settings, data.settings);
        saveSettings();
        applySettingsToUI();
      }

      saveWords();
      renderWordList();
      renderStats();
      toast('ورود داده‌ها انجام شد ✓', 'success');
    } catch (e) {
      toast('فایل نامعتبر است ✗', 'error');
    }
  };

  reader.onerror = () => toast('خطا در خواندن فایل', 'error');
  reader.readAsText(file);
}

/* ---------------------------------------------------------
   ۱۱) واژه‌های نمونه
   --------------------------------------------------------- */
const SAMPLE = [
  { en: 'improve', fa: 'بهبود دادن', example: 'Practice every day to improve your English.', exampleFa: 'هر روز تمرین کن تا انگلیسی‌ات بهتر شود.' },
  { en: 'brave',   fa: 'شجاع',      example: 'The brave firefighter saved the child.',    exampleFa: 'آتش‌نشان شجاع کودک را نجات داد.' },
  { en: 'journey', fa: 'سفر',       example: 'Our journey took three days.',              exampleFa: 'سفر ما سه روز طول کشید.' },
  { en: 'decide',  fa: 'تصمیم گرفتن', example: 'I decided to learn a new language.',       exampleFa: 'تصمیم گرفتم یک زبان جدید یاد بگیرم.' },
  { en: 'quiet',   fa: 'ساکت',      example: 'The library is very quiet.',                exampleFa: 'کتابخانه خیلی ساکت است.' }
];

function seedSample() {
  const existing = new Set(words.map(w => normalize(w.en)));
  let added = 0;

  SAMPLE.forEach(s => {
    if (existing.has(normalize(s.en))) return;
    words.unshift({
      id: uid(),
      en: s.en,
      fa: s.fa,
      example: s.example,
      exampleFa: s.exampleFa,
      level: 0, correct: 0, wrong: 0,
      createdAt: Date.now(),
      lastReview: null
    });
    added++;
  });

  saveWords();
  renderWordList();
  renderStats();
  toast(added ? `${faNum(added)} واژه اضافه شد ✓` : 'همه از قبل وجود داشتند', added ? 'success' : 'info');
}

/* ---------------------------------------------------------
   ۱۲) تنظیمات UI
   --------------------------------------------------------- */
function applySettingsToUI() {
  $$('#fcDir button').forEach(b =>
    b.classList.toggle('is-active', b.dataset.dir === settings.fcDir));

  $$('#quizType button').forEach(b =>
    b.classList.toggle('is-active', b.dataset.type === settings.quizType));

  $$('#quizCount button').forEach(b =>
    b.classList.toggle('is-active', Number(b.dataset.count) === Number(settings.quizCount)));

  const rate = $('#speechRate');
  if (rate) {
    rate.value = settings.speechRate;
    $('#rateVal').textContent = faNum(settings.speechRate);
  }
}

/* ---------------------------------------------------------
   ۱۳) راه‌اندازی رویدادها
   --------------------------------------------------------- */
function bindEvents() {

  /* --- تب‌ها --- */
  $$('.tab').forEach(t => t.addEventListener('click', () => switchView(t.dataset.view)));

  /* --- فرم --- */
  $('#wordForm').addEventListener('submit', handleFormSubmit);
  $('#cancelEdit').addEventListener('click', () => { resetForm(); toast('لغو شد', 'info'); });
  $('#search').addEventListener('input', renderWordList);

  /* --- فلش‌کارت --- */
  $('#flashcard').addEventListener('click', flipCard);

  $('#fcSpeak').addEventListener('click', e => {
    e.stopPropagation();
    const w = fc.queue[fc.i];
    if (w) speak(w.en);
  });

  $('#fcRight').addEventListener('click', () => answerFlashcard(true));
  $('#fcWrong').addEventListener('click', () => answerFlashcard(false));
  $('#fcRestart').addEventListener('click', () => { initFlashcards(); toast('دور جدید شروع شد', 'info'); });

  $$('#fcDir button').forEach(b => {
    b.addEventListener('click', () => {
      settings.fcDir = b.dataset.dir;
      saveSettings();
      applySettingsToUI();
      renderFlashcard();
    });
  });

  /* --- آزمون --- */
  $$('#quizType button').forEach(b => {
    b.addEventListener('click', () => {
      settings.quizType = b.dataset.type;
      saveSettings();
      applySettingsToUI();
    });
  });

  $$('#quizCount button').forEach(b => {
    b.addEventListener('click', () => {
      settings.quizCount = Number(b.dataset.count);
      saveSettings();
      applySettingsToUI();
    });
  });

  $('#startQuiz').addEventListener('click', startQuiz);
  $('#quizNext').addEventListener('click', nextQuestion);
  $('#quizSubmitTyping').addEventListener('click', submitTyping);

  $('#quizTypingInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); submitTyping(); }
  });

  $('#retryQuiz').addEventListener('click', startQuiz);
  $('#backToSetup').addEventListener('click', resetQuizUI);

  /* --- تنظیمات --- */
  $('#speechRate').addEventListener('input', e => {
    settings.speechRate = Number(e.target.value);
    $('#rateVal').textContent = faNum(settings.speechRate);
    saveSettings();
  });

  $('#testSpeak').addEventListener('click', () => speak('Hello, this is a test.'));

  $('#exportBtn').addEventListener('click', exportData);

  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (f) importData(f);
    e.target.value = '';
  });

  $('#seedBtn').addEventListener('click', seedSample);

  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('همهٔ واژه‌ها و تنظیمات پاک شود؟ این کار برگشت‌پذیر نیست.')) return;
    localStorage.removeItem(WORDS_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    words = [];
    settings = { fcDir: 'en-fa', quizType: 'en2fa', quizCount: 10, speechRate: 0.9 };
    saveWords();
    saveSettings();
    applySettingsToUI();
    renderWordList();
    renderStats();
    initFlashcards();
    toast('همهٔ داده‌ها پاک شد', 'info');
  });

  /* --- کلیدهای میان‌بر فلش‌کارت --- */
  document.addEventListener('keydown', e => {
    if (currentView !== 'cards') return;
    if (e.target.tagName === 'INPUT') return;

    if (e.code === 'Space') { e.preventDefault(); flipCard(); }
    if (e.key === 'ArrowLeft')  answerFlashcard(true);
    if (e.key === 'ArrowRight') answerFlashcard(false);
  });
}

/* ---------------------------------------------------------
   ۱۴) PWA — نصب و Service Worker
   --------------------------------------------------------- */
let deferredPrompt = null;

function setupPWA() {
  if ('serviceWorker' in navigator &&
      (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('SW registration failed:', err);
      });
    });
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = $('#installBtn');
    if (btn) btn.hidden = false;
  });

  const installBtn = $('#installBtn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) {
        toast('از منوی مرورگر «افزودن به صفحهٔ اصلی» را بزنید', 'info');
        return;
      }
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBtn.hidden = true;
    });
  }

  window.addEventListener('appinstalled', () => {
    toast('اپلیکیشن نصب شد 🎉', 'success');
    const btn = $('#installBtn');
    if (btn) btn.hidden = true;
  });
}

/* ---------------------------------------------------------
   ۱۵) شروع
   --------------------------------------------------------- */
function init() {
  loadData();
  bindEvents();
  applySettingsToUI();
  updateWordCount();
  renderWordList();
  renderStats();
  resetQuizUI();
  setupPWA();
}

document.addEventListener('DOMContentLoaded', init);