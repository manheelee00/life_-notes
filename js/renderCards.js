// Step 1: 실제 마크다운 파일 fetch 및 카드/모달 렌더링
// blog/ 폴더 내 마크다운 파일명 목록 (실제 구현 시 서버에서 동적으로 받아올 수 있음)
const postsList = [
  "20240601_pancreas.md",
  "20240602_life.md",
  "20240603_js.md"
];

// 마크다운에서 YAML frontmatter 파싱 함수
function parseFrontmatter(md) {
  const match = md.match(/^---\n([\s\S]*?)---/);
  if (!match) return null;
  const lines = match[1].split(/\n/);
  const meta = {};
  lines.forEach(line => {
    const [key, ...rest] = line.split(":");
    if (key && rest.length) {
      let value = rest.join(":").trim();
      if (key.trim() === 'tags') {
        // tags: ["a", "b"] 또는 tags: a, b
        if (value.startsWith("[") && value.endsWith("]")) {
          value = JSON.parse(value.replace(/'/g, '"'));
        } else {
          value = value.split(',').map(t => t.trim().replace(/^"|"$/g, ""));
        }
      } else {
        value = value.replace(/^"|"$/g, "");
      }
      meta[key.trim()] = value;
    }
  });
  return meta;
}

// 모든 마크다운 파일을 fetch해서 메타데이터 추출
async function loadPosts() {
  const metas = [];
  for (const file of postsList) {
    try {
      const res = await fetch(`blog/${file}`);
      const md = await res.text();
      const meta = parseFrontmatter(md);
      if (meta) {
        meta.file = file;
        meta._raw = md; // 본문도 저장(모달용)
        metas.push(meta);
      }
    } catch (e) {
      // 파일이 없거나 fetch 실패 시 무시
    }
  }
  return metas;
}

// 카테고리 버튼 렌더링
function renderCategoryBtns(categories) {
  const categoryBtnsDiv = document.getElementById('category-btns');
  let currentCategory = "전체";
  categoryBtnsDiv.innerHTML = '';
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'category-btn' + (cat === "전체" ? ' active' : '');
    btn.textContent = cat;
    btn.onclick = () => {
      currentCategory = cat;
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCards(window._postMetas, currentCategory);
    };
    categoryBtnsDiv.appendChild(btn);
  });
}

// 카드 렌더링 함수
function renderCards(postMetas, currentCategory = "전체") {
  const cardList = document.getElementById('card-list');
  cardList.innerHTML = '';
  const filtered = currentCategory === "전체" ? postMetas : postMetas.filter(meta => meta.category === currentCategory);
  filtered.forEach((meta, idx) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.style.animationDelay = (idx * 0.08) + 's';
    card.setAttribute('tabindex', '0');
    card.setAttribute('data-file', meta.file);
    card.innerHTML = `
      <img src="${meta.thumbnail}" alt="썸네일" class="card-thumb">
      <span class="card-category">${meta.category}</span>
      <h2 class="card-title glow-text">${meta.title}</h2>
      <p class="card-desc">${meta.description}</p>
      <button class="card-btn" data-file="${meta.file}">자세히 보기</button>
    `;
    cardList.appendChild(card);
  });
}

// 모달 열기/닫기 함수
function openModal(html) {
  const modal = document.getElementById('modal');
  document.getElementById('modal-body').innerHTML = html;
  modal.style.display = 'block';
  document.body.classList.add('modal-open');
}
function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.body.classList.remove('modal-open');
}
document.getElementById('modal-close').onclick = closeModal;
document.querySelector('.modal-dim').onclick = closeModal;

// 카드/버튼 클릭 시 모달로 본문 표시
// (이벤트 위임)
document.getElementById('card-list').addEventListener('click', async function(e) {
  const btn = e.target.closest('.card-btn');
  if (btn) {
    const file = btn.dataset.file;
    const meta = window._postMetas.find(m => m.file === file);
    if (meta) {
      // frontmatter 제거 후 본문만 추출
      const content = meta._raw.replace(/^---[\s\S]*?---/, '').trim();
      openModal(marked.parse(content));
    }
  }
});

// 초기 실행: 모든 마크다운 fetch 후 렌더링
(async function() {
  const postMetas = await loadPosts();
  window._postMetas = postMetas; // 전역 저장(필터 등 재사용)
  // 카테고리 목록 추출
  const categories = ["전체", ...Array.from(new Set(postMetas.map(meta => meta.category)))];
  renderCategoryBtns(categories);
  renderCards(postMetas);
})();

// Step 2: 검색, 태그, 페이지네이션 기능 추가

// 상태 변수
let _postMetas = [];
let _currentCategory = "전체";
let _currentTag = null;
let _searchKeyword = "";
let _currentPage = 1;
const PAGE_SIZE = 6;

// 태그 목록 추출
function getAllTags(postMetas) {
  const tags = new Set();
  postMetas.forEach(meta => {
    if (Array.isArray(meta.tags)) meta.tags.forEach(t => tags.add(t));
  });
  return Array.from(tags);
}

// 카테고리 버튼 렌더링
function renderCategoryBtns(categories) {
  const categoryBtnsDiv = document.getElementById('category-btns');
  categoryBtnsDiv.innerHTML = '';
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'category-btn' + (cat === _currentCategory ? ' active' : '');
    btn.textContent = cat;
    btn.onclick = () => {
      _currentCategory = cat;
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _currentPage = 1;
      renderCards();
    };
    categoryBtnsDiv.appendChild(btn);
  });
}

// 태그 버튼 렌더링 (category와 독립)
function renderTagBtns(tags) {
  const tagBtnsDiv = document.getElementById('tag-btns');
  tagBtnsDiv.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.className = 'tag-btn' + (!_currentTag ? ' active' : '');
  allBtn.textContent = '전체';
  allBtn.onclick = () => {
    _currentTag = null;
    document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
    allBtn.classList.add('active');
    _currentPage = 1;
    renderCards();
  };
  tagBtnsDiv.appendChild(allBtn);
  tags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'tag-btn' + (tag === _currentTag ? ' active' : '');
    btn.textContent = tag;
    btn.onclick = () => {
      _currentTag = tag;
      document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _currentPage = 1;
      renderCards();
    };
    tagBtnsDiv.appendChild(btn);
  });
}

// 검색 입력 이벤트
const searchInput = document.getElementById('search-input');
searchInput.addEventListener('input', function(e) {
  _searchKeyword = e.target.value.trim().toLowerCase();
  _currentPage = 1;
  renderCards();
});

// 카드 렌더링 함수 (검색, 카테고리, 태그, 페이지네이션 모두 반영)
function renderCards() {
  const cardList = document.getElementById('card-list');
  cardList.innerHTML = '';
  // 1. 필터링
  let filtered = _postMetas;
  if (_currentCategory !== "전체") {
    filtered = filtered.filter(meta => meta.category === _currentCategory);
  }
  if (_currentTag) {
    filtered = filtered.filter(meta => Array.isArray(meta.tags) && meta.tags.includes(_currentTag));
  }
  if (_searchKeyword) {
    filtered = filtered.filter(meta =>
      (meta.title && meta.title.toLowerCase().includes(_searchKeyword)) ||
      (meta.category && meta.category.toLowerCase().includes(_searchKeyword)) ||
      (meta.description && meta.description.toLowerCase().includes(_searchKeyword))
    );
  }
  // 2. 페이지네이션
  const total = filtered.length;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  if (_currentPage > pageCount) _currentPage = 1;
  const start = (_currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const paged = filtered.slice(start, end);
  // 3. 카드 렌더링
  paged.forEach((meta, idx) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.style.animationDelay = (idx * 0.08) + 's';
    card.setAttribute('tabindex', '0');
    card.setAttribute('data-file', meta.file);
    card.innerHTML = `
      <img src="${meta.thumbnail}" alt="썸네일" class="card-thumb">
      <span class="card-category">${meta.category}</span>
      <h2 class="card-title glow-text">${meta.title}</h2>
      <p class="card-desc">${meta.description}</p>
      <div class="card-tags">${(meta.tags||[]).map(t=>`<span class="tag-btn">#${t}</span>`).join(' ')}</div>
      <button class="card-btn" data-file="${meta.file}">자세히 보기</button>
    `;
    cardList.appendChild(card);
  });
  renderPagination(pageCount);
}

// 페이지네이션 렌더링
function renderPagination(pageCount) {
  const pagination = document.getElementById('pagination');
  pagination.innerHTML = '';
  if (pageCount <= 1) return;
  for (let i = 1; i <= pageCount; i++) {
    const btn = document.createElement('button');
    btn.className = 'pagination-btn' + (i === _currentPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => {
      if (_currentPage !== i) {
        _currentPage = i;
        // 부드러운 스크롤 이동
        document.querySelector('.main').scrollIntoView({behavior:'smooth'});
        renderCards();
      }
    };
    pagination.appendChild(btn);
  }
}

// 카드/버튼 클릭 시 모달로 본문 표시
// (이벤트 위임)
document.getElementById('card-list').addEventListener('click', async function(e) {
  const btn = e.target.closest('.card-btn');
  if (btn) {
    const file = btn.dataset.file;
    const meta = _postMetas.find(m => m.file === file);
    if (meta) {
      const content = meta._raw.replace(/^---[\s\S]*?---/, '').trim();
      openModal(marked.parse(content));
    }
  }
  // 태그 클릭 시 태그 필터 적용
  const tagSpan = e.target.closest('.tag-btn');
  if (tagSpan && !tagSpan.classList.contains('card-btn')) {
    _currentTag = tagSpan.textContent.replace(/^#/, '');
    document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
    // 상단 태그 버튼도 active 처리
    document.querySelectorAll('.tag-btns .tag-btn').forEach(b => {
      if (b.textContent === _currentTag) b.classList.add('active');
    });
    _currentPage = 1;
    renderCards();
  }
});

// 초기 실행: 모든 마크다운 fetch 후 렌더링
(async function() {
  const metas = [];
  for (const file of postsList) {
    try {
      const res = await fetch(`blog/${file}`);
      const md = await res.text();
      const meta = parseFrontmatter(md);
      if (meta) {
        meta.file = file;
        meta._raw = md;
        metas.push(meta);
      }
    } catch (e) {}
  }
  _postMetas = metas;
  const categories = ["전체", ...Array.from(new Set(metas.map(meta => meta.category)))];
  renderCategoryBtns(categories);
  renderTagBtns(getAllTags(metas));
  renderCards();
})();

// =====================
// 🔍 검색어 하이라이팅 함수
// =====================
function markHighlight(text, keyword) {
  if (!keyword) return text;
  // 대소문자 구분 없이 모든 키워드 부분을 <mark>로 감쌈
  const re = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(re, '<mark>$1</mark>');
}

// =====================
// 🏷 다중 태그 필터 (AND)
// =====================
let _currentTags = new Set(); // 여러 태그 선택 가능

// 태그 버튼 렌더링 (toggle, AND)
function renderTagBtns(tags) {
  const tagBtnsDiv = document.getElementById('tag-btns');
  tagBtnsDiv.innerHTML = '';
  tags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'tag-btn' + (_currentTags.has(tag) ? ' active' : '');
    btn.textContent = tag;
    btn.onclick = () => {
      if (_currentTags.has(tag)) {
        _currentTags.delete(tag);
      } else {
        _currentTags.add(tag);
      }
      _currentPage = 1;
      renderCards();
    };
    tagBtnsDiv.appendChild(btn);
  });
}

// =====================
// 📄 무한 스크롤 페이지네이션
// =====================
let _currentPage = 1;
const PAGE_SIZE = 6;
let _infiniteScrollEnabled = true;
let _observer = null;

function setupInfiniteScroll() {
  if (_observer) _observer.disconnect();
  const sentinel = document.createElement('div');
  sentinel.id = 'scroll-sentinel';
  document.getElementById('card-list').appendChild(sentinel);
  _observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && _infiniteScrollEnabled) {
      _currentPage++;
      renderCards(false); // false: append
    }
  }, { threshold: 1 });
  _observer.observe(sentinel);
}

// =====================
// 카드 렌더링 (검색, 카테고리, 다중태그, 무한스크롤)
// =====================
function renderCards(reset = true) {
  const cardList = document.getElementById('card-list');
  if (reset) {
    cardList.innerHTML = '';
    _currentPage = 1;
    _infiniteScrollEnabled = true;
  }
  // 1. 필터링
  let filtered = _postMetas;
  if (_currentCategory !== "전체") {
    filtered = filtered.filter(meta => meta.category === _currentCategory);
  }
  if (_currentTags.size > 0) {
    filtered = filtered.filter(meta => Array.isArray(meta.tags) && [..._currentTags].every(t => meta.tags.includes(t)));
  }
  if (_searchKeyword) {
    filtered = filtered.filter(meta =>
      (meta.title && meta.title.toLowerCase().includes(_searchKeyword)) ||
      (meta.category && meta.category.toLowerCase().includes(_searchKeyword)) ||
      (meta.description && meta.description.toLowerCase().includes(_searchKeyword))
    );
  }
  // 2. 페이지네이션 (무한스크롤)
  const total = filtered.length;
  const start = 0;
  const end = Math.min(_currentPage * PAGE_SIZE, total);
  const paged = filtered.slice(0, end);
  // 3. 카드 렌더링 (append)
  if (reset) cardList.innerHTML = '';
  paged.forEach((meta, idx) => {
    if (cardList.querySelector(`[data-file="${meta.file}"]`)) return; // 이미 렌더된 카드 skip
    const card = document.createElement('article');
    card.className = 'card';
    card.style.animationDelay = ((idx % PAGE_SIZE) * 0.08) + 's';
    card.setAttribute('tabindex', '0');
    card.setAttribute('data-file', meta.file);
    // 하이라이팅 적용
    const title = markHighlight(meta.title, _searchKeyword);
    const category = markHighlight(meta.category, _searchKeyword);
    const desc = markHighlight(meta.description, _searchKeyword);
    card.innerHTML = `
      <img src="${meta.thumbnail}" alt="썸네일" class="card-thumb">
      <span class="card-category">${category}</span>
      <h2 class="card-title glow-text">${title}</h2>
      <p class="card-desc">${desc}</p>
      <div class="card-tags">${(meta.tags||[]).map(t=>`<span class="tag-btn${_currentTags.has(t)?' active':''}">#${t}</span>`).join(' ')}</div>
      <button class="card-btn" data-file="${meta.file}">자세히 보기</button>
    `;
    cardList.appendChild(card);
  });
  // 무한스크롤 sentinel
  if (end < total) {
    setupInfiniteScroll();
  } else {
    _infiniteScrollEnabled = false;
    if (_observer) _observer.disconnect();
    const sentinel = document.getElementById('scroll-sentinel');
    if (sentinel) sentinel.remove();
  }
}

// =====================
// 검색 입력 이벤트 (대소문자 구분 없이)
// =====================
const searchInput = document.getElementById('search-input');
searchInput.addEventListener('input', function(e) {
  _searchKeyword = e.target.value.trim().toLowerCase();
  renderCards();
});

// =====================
// 카테고리 버튼 렌더링 (단일 선택)
// =====================
function renderCategoryBtns(categories) {
  const categoryBtnsDiv = document.getElementById('category-btns');
  categoryBtnsDiv.innerHTML = '';
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'category-btn' + (cat === _currentCategory ? ' active' : '');
    btn.textContent = cat;
    btn.onclick = () => {
      _currentCategory = cat;
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCards();
    };
    categoryBtnsDiv.appendChild(btn);
  });
}

// =====================
// 태그 목록 추출 (중복 제거)
// =====================
function getAllTags(postMetas) {
  const tags = new Set();
  postMetas.forEach(meta => {
    if (Array.isArray(meta.tags)) meta.tags.forEach(t => tags.add(t));
  });
  return Array.from(tags);
}

// =====================
// 모달 열기/닫기 (이전과 동일)
// =====================
function openModal(html) {
  const modal = document.getElementById('modal');
  document.getElementById('modal-body').innerHTML = html;
  modal.style.display = 'block';
  document.body.classList.add('modal-open');
}
function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.body.classList.remove('modal-open');
}
document.getElementById('modal-close').onclick = closeModal;
document.querySelector('.modal-dim').onclick = closeModal;

// =====================
// 카드/버튼/태그 클릭 이벤트 위임
// =====================
document.getElementById('card-list').addEventListener('click', async function(e) {
  // 자세히 보기(모달)
  const btn = e.target.closest('.card-btn');
  if (btn) {
    const file = btn.dataset.file;
    const meta = _postMetas.find(m => m.file === file);
    if (meta) {
      const content = meta._raw.replace(/^---[\s\S]*?---/, '').trim();
      openModal(marked.parse(content));
    }
  }
  // 태그 클릭 (toggle)
  const tagSpan = e.target.closest('.tag-btn');
  if (tagSpan && !tagSpan.classList.contains('card-btn')) {
    const tag = tagSpan.textContent.replace(/^#/, '');
    if (_currentTags.has(tag)) {
      _currentTags.delete(tag);
    } else {
      _currentTags.add(tag);
    }
    renderCards();
  }
});

// =====================
// 초기 실행: 모든 마크다운 fetch 후 렌더링
// =====================
(async function() {
  const metas = [];
  for (const file of postsList) {
    try {
      const res = await fetch(`blog/${file}`);
      const md = await res.text();
      const meta = parseFrontmatter(md);
      if (meta) {
        meta.file = file;
        meta._raw = md;
        metas.push(meta);
      }
    } catch (e) {}
  }
  window._postMetas = _postMetas = metas;
  const categories = ["전체", ...Array.from(new Set(metas.map(meta => meta.category)))];
  renderCategoryBtns(categories);
  renderTagBtns(getAllTags(metas));
  renderCards();
})(); 