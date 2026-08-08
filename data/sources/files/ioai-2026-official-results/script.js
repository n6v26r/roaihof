(() => {
  const state = {
    data: null,
    track: 'individual',
    query: '',
    award: ''
  };

  const elements = {
    tabs: [...document.querySelectorAll('.track-tab')],
    individualCount: document.getElementById('individual-count'),
    gaiteCount: document.getElementById('gaite-count'),
    podium: document.getElementById('podium'),
    search: document.getElementById('search-input'),
    award: document.getElementById('award-filter'),
    count: document.getElementById('result-count'),
    head: document.getElementById('table-head'),
    body: document.getElementById('table-body')
  };

  const scoreFormat = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[character]);
  }

  function awardClass(award) {
    const value = award.toLowerCase();
    if (value.includes('gold')) return 'gold';
    if (value.includes('silver')) return 'silver';
    if (value.includes('bronze')) return 'bronze';
    if (value.includes('level 1')) return 'level-1';
    if (value.includes('level 2')) return 'level-2';
    if (value.includes('level 3')) return 'level-3';
    if (value.includes('mention')) return 'mention';
    return 'none';
  }

  function awardMarkup(award) {
    if (!award) return '<span class="award-none">—</span>';
    return '<span class="award-badge award-' + awardClass(award) + '">' + escapeHtml(award) + '</span>';
  }

  function currentRows() {
    return state.data.tracks[state.track].rows;
  }

  function filteredRows() {
    const query = state.query.trim().toLocaleLowerCase();
    return currentRows().filter(row => {
      const matchesQuery = !query || row.name.toLocaleLowerCase().includes(query) || row.country.toLocaleLowerCase().includes(query);
      const matchesAward = !state.award || (state.award === '__none__' ? !row.award : row.award === state.award);
      return matchesQuery && matchesAward;
    });
  }

  function renderPodium() {
    const colors = ['#fbd66a', '#d8e2ed', '#e6a56d'];
    elements.podium.innerHTML = currentRows().slice(0, 3).map((row, index) =>
      '<article class="podium-card" style="--podium-color:' + colors[index] + '">' +
        '<div class="podium-rank">' + row.rank + '</div>' +
        '<div><div class="podium-name" title="' + escapeHtml(row.name) + '">' + escapeHtml(row.name) + '</div>' +
        '<div class="podium-meta"><span>' + escapeHtml(row.country) + '</span><strong>' + scoreFormat.format(row.total) + '</strong></div></div>' +
      '</article>'
    ).join('');
  }

  function renderAwardOptions() {
    const awards = [...new Set(currentRows().map(row => row.award).filter(Boolean))];
    const hasNoAward = currentRows().some(row => !row.award);
    elements.award.innerHTML = '<option value="">All awards</option>' +
      awards.map(award => '<option value="' + escapeHtml(award) + '">' + escapeHtml(award) + '</option>').join('') +
      (hasNoAward ? '<option value="__none__">No award</option>' : '');
    elements.award.value = state.award;
  }

  function renderTableHead() {
    const awardLabel = state.track === 'individual' ? 'Medal' : 'Award';
    elements.head.innerHTML = '<tr>' +
      '<th class="rank-col" scope="col">Rank</th>' +
      '<th class="name-col" scope="col">Name</th>' +
      '<th class="country-col" scope="col">Country or region</th>' +
      state.data.tasks.map(task => '<th class="task-col" scope="col">' + escapeHtml(task) + '</th>').join('') +
      '<th class="total-col" scope="col">Total score</th>' +
      '<th class="award-col" scope="col">' + awardLabel + '</th>' +
    '</tr>';
  }

  function renderTableBody() {
    const rows = filteredRows();
    elements.count.textContent = rows.length === currentRows().length
      ? rows.length + ' contestants'
      : rows.length + ' of ' + currentRows().length + ' contestants';

    if (!rows.length) {
      elements.body.innerHTML = '<tr><td class="empty-cell" colspan="11">No contestants match these filters.</td></tr>';
      return;
    }

    elements.body.innerHTML = rows.map(row =>
      '<tr' + (row.rank <= 3 ? ' class="top-three"' : '') + '>' +
        '<td class="rank-col">' + row.rank + '</td>' +
        '<th class="name-col" scope="row"><span class="name-cell" title="' + escapeHtml(row.name) + '">' + escapeHtml(row.name) + '</span></th>' +
        '<td class="country-col" title="' + escapeHtml(row.country) + '">' + escapeHtml(row.country) + '</td>' +
        row.tasks.map(score => '<td class="task-col">' + scoreFormat.format(score) + '</td>').join('') +
        '<td class="total-col">' + scoreFormat.format(row.total) + '</td>' +
        '<td class="award-col">' + awardMarkup(row.award) + '</td>' +
      '</tr>'
    ).join('');
  }

  function renderAll() {
    renderPodium();
    renderAwardOptions();
    renderTableHead();
    renderTableBody();
  }

  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (!state.data || state.track === tab.dataset.track) return;
      state.track = tab.dataset.track;
      state.award = '';
      elements.tabs.forEach(candidate => {
        const active = candidate === tab;
        candidate.classList.toggle('active', active);
        candidate.setAttribute('aria-selected', String(active));
      });
      renderAll();
    });
  });

  elements.search.addEventListener('input', event => {
    state.query = event.target.value;
    if (state.data) renderTableBody();
  });

  elements.award.addEventListener('change', event => {
    state.award = event.target.value;
    if (state.data) renderTableBody();
  });

  fetch('./results.json', {cache: 'no-cache'})
    .then(response => {
      if (!response.ok) throw new Error('Unable to load standings');
      return response.json();
    })
    .then(data => {
      state.data = data;
      elements.individualCount.textContent = data.tracks.individual.rows.length;
      elements.gaiteCount.textContent = data.tracks.gaite.rows.length;
      renderAll();
    })
    .catch(error => {
      console.error(error);
      elements.body.innerHTML = '<tr><td class="empty-cell" colspan="11">The final standings could not be loaded. Please refresh the page.</td></tr>';
      elements.count.textContent = '';
    });
})();
