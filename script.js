
/**************************************************
 * NEWS HUB 2.0
 * GitHub Frontend Controller
 **************************************************/

// Google Apps Script 웹 앱 배포 주소
const API_URL =
  'https://script.google.com/macros/s/AKfycbxkjybpfhJGw-B5_j8zDFEX01jFJdwGyFvhRysE9TnXk9unXlMeexk9ivSGUlXqY25U/exec';

// 설정
const CONFIG = {
  AUTO_REFRESH: 5 * 60 * 1000,
  REQUEST_TIMEOUT: 30000
};

const categories = [
  '전체',
  '정치',
  '경제',
  '사회',
  '세계',
  'IT/과학',
  '문화',
  '스포츠'
];

let currentCategory = '전체';
let currentKeyword = '';

let newsLoading = false;
let keywordLoading = false;

let callbackNumber = 0;
let autoRefreshTimer = null;

/**************************************************
 * JSONP API 통신
 **************************************************/

function apiRequest(action, params = {}) {
  return new Promise(function(resolve, reject) {
    if (
      !API_URL ||
      API_URL.includes('여기에_Apps_Script')
    ) {
      reject(new Error('Apps Script API 주소를 설정해 주세요.'));
      return;
    }

    const callbackName =
      'newsHubCallback_' + (++callbackNumber);

    const script = document.createElement('script');

    let timeout;

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    window[callbackName] = function(data) {
      cleanup();
      resolve(data);
    };

    const query = new URLSearchParams({
      action: action,
      callback: callbackName,
      ...params
    });

    script.src = API_URL + '?' + query.toString();

    script.onerror = function() {
      cleanup();
      reject(new Error('서버 연결에 실패했습니다.'));
    };

    timeout = setTimeout(function() {
      cleanup();
      reject(new Error('서버 응답 시간이 초과되었습니다.'));
    }, CONFIG.REQUEST_TIMEOUT);

    document.head.appendChild(script);
  });
}

/**************************************************
 * 초기 실행
 **************************************************/

document.addEventListener('DOMContentLoaded', function() {
  initialize();
});

function initialize() {
  renderCategories();

  document.getElementById('searchBtn')
    .addEventListener('click', searchNews);

  document.getElementById('searchInput')
    .addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        searchNews();
      }
    });

  document.getElementById('refreshBtn')
    .addEventListener('click', refreshAll);

  document.getElementById('keywordRefresh')
    .addEventListener('click', function() {
      loadKeywords(true);
    });

  loadNews();
  loadKeywords();

  startAutoRefresh();
}

/**************************************************
 * 카테고리
 **************************************************/

function renderCategories() {
  const area = document.getElementById('categories');

  area.replaceChildren();

  categories.forEach(function(category) {
    const button = document.createElement('button');

    button.className =
      'category' +
      (category === currentCategory ? ' active' : '');

    button.textContent = category;

    button.addEventListener('click', function() {
      currentCategory = category;

      renderCategories();
      loadNews();
    });

    area.appendChild(button);
  });
}

/**************************************************
 * 뉴스 검색
 **************************************************/

function searchNews() {
  currentKeyword =
    document.getElementById('searchInput').value.trim();

  loadNews();
}

async function loadNews(force = false) {
  if (newsLoading) return;

  newsLoading = true;

  const list = document.getElementById('newsList');
  const errorArea = document.getElementById('errorArea');

  errorArea.hidden = true;

  list.innerHTML =
    '<div class="placeholder">뉴스를 불러오는 중입니다...</div>';

  try {
    const result = await apiRequest('news', {
      keyword: currentKeyword,
      category: currentCategory,
      force: String(force)
    });

    if (!result.success) {
      throw new Error(result.error || '뉴스 수집 실패');
    }

    renderNews(result);

  } catch (error) {
    showNewsError(error.message);

  } finally {
    newsLoading = false;
  }
}

/**************************************************
 * 뉴스 출력
 **************************************************/

function renderNews(result) {
  const list = document.getElementById('newsList');

  list.replaceChildren();

  document.getElementById('newsCount').textContent =
    result.count || 0;

  document.getElementById('updatedAt').textContent =
    '업데이트 ' + formatTime(result.updatedAt);

  if (!result.news || result.news.length === 0) {
    const empty = document.createElement('div');

    empty.className = 'placeholder';
    empty.textContent =
      '검색 결과가 없습니다. 다른 키워드를 검색해 보세요.';

    list.appendChild(empty);
    return;
  }

  result.news.forEach(function(news) {
    const card = document.createElement('article');
    card.className = 'news-card';

    const meta = document.createElement('div');
    meta.className = 'news-meta';

    const source = document.createElement('span');
    source.className = 'news-source';
    source.textContent = news.source || '뉴스';

    const time = document.createElement('span');
    time.className = 'news-time';
    time.textContent = formatTime(news.publishedAt);

    meta.append(source, time);

    const title = document.createElement('a');

    title.className = 'news-title';
    title.textContent = news.title || '제목 없음';

    if (/^https?:\/\//i.test(news.link || '')) {
      title.href = news.link;
      title.target = '_blank';
      title.rel = 'noopener noreferrer';
    }

    const description = document.createElement('div');

    description.className = 'news-description';
    description.textContent =
      news.description || '기사 원문에서 확인하세요.';

    card.append(meta, title, description);

    list.appendChild(card);
  });
}

/**************************************************
 * 키워드 불러오기
 **************************************************/

async function loadKeywords(force = false) {
  if (keywordLoading) return;

  keywordLoading = true;

  const list = document.getElementById('keywordList');

  if (force) {
    list.innerHTML =
      '<div class="placeholder">키워드 분석 중...</div>';
  }

  try {
    const result = await apiRequest('keywords', {
      force: String(force)
    });

    if (!result.success) {
      throw new Error(result.error || '키워드 분석 실패');
    }

    renderKeywords(result);

  } catch (error) {
    showKeywordError(error.message);

  } finally {
    keywordLoading = false;
  }
}

/**************************************************
 * 키워드 출력
 **************************************************/

function renderKeywords(result) {
  const list = document.getElementById('keywordList');

  list.replaceChildren();

  document.getElementById('keywordInfo').textContent =
    result.articleCount +
    '개 기사의 제목을 분석했습니다. · ' +
    formatTime(result.updatedAt);

  if (!result.keywords || result.keywords.length === 0) {
    const empty = document.createElement('div');

    empty.className = 'placeholder';
    empty.textContent = '분석할 키워드가 충분하지 않습니다.';

    list.appendChild(empty);
    return;
  }

  result.keywords.forEach(function(item, index) {
    const button = document.createElement('button');

    button.className = 'keyword-item';

    const rank = document.createElement('span');
    rank.className = 'keyword-rank';
    rank.textContent = String(index + 1).padStart(2, '0');

    const name = document.createElement('span');
    name.className = 'keyword-name';
    name.textContent = '#' + item.word;

    const count = document.createElement('span');
    count.className = 'keyword-count';
    count.textContent = item.count + '건';

    button.append(rank, name, count);

    button.addEventListener('click', function() {
      selectKeyword(item.word);
    });

    list.appendChild(button);
  });
}

/**************************************************
 * 키워드 클릭 검색
 **************************************************/

function selectKeyword(keyword) {
  currentKeyword = keyword;

  document.getElementById('searchInput').value = keyword;

  loadNews();

  document.querySelector('.news-section').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

/**************************************************
 * 전체 새로고침
 **************************************************/

async function refreshAll() {
  const button = document.getElementById('refreshBtn');

  if (newsLoading || keywordLoading) return;

  button.disabled = true;
  button.textContent = '갱신 중...';

  try {
    const result = await apiRequest('refresh');

    if (!result.success) {
      throw new Error(result.error || '갱신 실패');
    }

    await Promise.all([
      loadNews(false),
      loadKeywords(false)
    ]);

  } catch (error) {
    showNewsError(error.message);

  } finally {
    button.disabled = false;
    button.textContent = '↻ 새로고침';
  }
}

/**************************************************
 * 오류 처리
 **************************************************/

function showNewsError(message) {
  const list = document.getElementById('newsList');

  list.replaceChildren();

  const error = document.createElement('div');
  error.className = 'placeholder';
  error.textContent = message || '뉴스를 불러오지 못했습니다.';

  list.appendChild(error);
}

function showKeywordError(message) {
  const list = document.getElementById('keywordList');

  list.replaceChildren();

  const error = document.createElement('div');
  error.className = 'placeholder';
  error.textContent = message || '키워드를 불러오지 못했습니다.';

  list.appendChild(error);
}

/**************************************************
 * 날짜 표시
 **************************************************/

function formatTime(value) {
  if (!value) return '';

  const date = new Date(value);

  if (isNaN(date.getTime())) return '';

  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**************************************************
 * 자동 업데이트
 **************************************************/

function startAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
  }

  autoRefreshTimer = setInterval(function() {
    if (!document.hidden) {
      loadNews(false);
      loadKeywords(false);
    }
  }, CONFIG.AUTO_REFRESH);
}
