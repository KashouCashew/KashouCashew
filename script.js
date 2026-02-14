const METRIC_CONFIG = [
  { key: 'money', label: 'Money ($B)', color: '#5dd9ff' },
  { key: 'population', label: 'Population (M)', color: '#74f0a7' },
  { key: 'jobs', label: 'Jobs (M)', color: '#ffd166' },
  { key: 'prices', label: 'Price Index', color: '#ff8fab' },
  { key: 'production', label: 'Production Index', color: '#b2f7ef' },
  { key: 'demand', label: 'Demand Index', color: '#cdb4db' },
];

const regionSeeds = {
  'North America': { money: 27, population: 600, jobs: 300, prices: 112, production: 118, demand: 110 },
  'South America': { money: 7, population: 430, jobs: 180, prices: 97, production: 92, demand: 95 },
  Europe: { money: 22, population: 740, jobs: 330, prices: 109, production: 108, demand: 106 },
  Africa: { money: 4, population: 1400, jobs: 430, prices: 84, production: 80, demand: 86 },
  Asia: { money: 30, population: 4700, jobs: 2300, prices: 105, production: 125, demand: 121 },
  Oceania: { money: 2, population: 45, jobs: 23, prices: 103, production: 99, demand: 98 },
};

const defaultControls = {
  taxRate: 20,
  wageLevel: 100,
  productionInvestment: 40,
};

const state = {
  day: 0,
  selectedRegion: null,
  regions: Object.fromEntries(
    Object.entries(regionSeeds).map(([name, metrics]) => [
      name,
      {
        controls: { ...defaultControls },
        metrics: { ...metrics },
        history: METRIC_CONFIG.reduce((acc, { key }) => ({ ...acc, [key]: [metrics[key]] }), {}),
      },
    ])
  ),
};

const sidebar = document.getElementById('sidebar');
const regionName = document.getElementById('region-name');
const simDate = document.getElementById('sim-date');
const metricsGrid = document.getElementById('metrics-grid');
const closeSidebar = document.getElementById('close-sidebar');
const chart = document.getElementById('trend-chart');
const chartCtx = chart?.getContext('2d');
const trendLegend = document.getElementById('trend-legend');

const controlsEls = {
  taxRate: document.getElementById('tax-rate'),
  wageLevel: document.getElementById('wage-level'),
  productionInvestment: document.getElementById('production-investment'),
};

const controlValueEls = {
  taxRate: document.getElementById('tax-rate-value'),
  wageLevel: document.getElementById('wage-level-value'),
  productionInvestment: document.getElementById('production-investment-value'),
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatMetric(key, value) {
  if (key === 'money') return value.toFixed(2);
  if (key === 'population' || key === 'jobs') return value.toFixed(1);
  return value.toFixed(2);
}

function setActiveTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((button) => {
    const isActive = button.dataset.tab === tab;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  document.querySelectorAll('.tab-content').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === tab);
  });
}

function renderControls(region) {
  const regionData = state.regions[region];
  if (!regionData) return;

  Object.entries(controlsEls).forEach(([key, element]) => {
    if (!element) return;
    const value = regionData.controls[key];
    element.value = String(value);
    if (controlValueEls[key]) {
      controlValueEls[key].textContent = Number(value).toFixed(0);
    }
  });
}

function renderMetrics(region) {
  const regionData = state.regions[region];
  if (!regionData || !metricsGrid) return;

  metricsGrid.innerHTML = METRIC_CONFIG.map(
    ({ key, label }) => `<dt>${label}</dt><dd>${formatMetric(key, regionData.metrics[key])}</dd>`
  ).join('');
}

function drawTrendGraph(region) {
  if (!chartCtx || !chart || !trendLegend) return;
  const regionData = state.regions[region];
  if (!regionData) return;

  const width = chart.width;
  const height = chart.height;
  chartCtx.clearRect(0, 0, width, height);
  chartCtx.strokeStyle = '#345e8c';
  chartCtx.lineWidth = 1;
  chartCtx.strokeRect(0, 0, width, height);

  const points = 24;
  const padding = 16;
  const selectedKeys = ['money', 'production', 'demand'];
  const selected = METRIC_CONFIG.filter(({ key }) => selectedKeys.includes(key));

  const series = selected.map(({ key, color, label }) => {
    const values = regionData.history[key].slice(-points);
    return { key, label, color, values };
  });

  const allValues = series.flatMap(({ values }) => values);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = Math.max(1, max - min);

  series.forEach(({ values, color }) => {
    chartCtx.beginPath();
    values.forEach((value, index) => {
      const x = padding + (index / (Math.max(values.length - 1, 1))) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      if (index === 0) chartCtx.moveTo(x, y);
      else chartCtx.lineTo(x, y);
    });
    chartCtx.strokeStyle = color;
    chartCtx.lineWidth = 2;
    chartCtx.stroke();
  });

  trendLegend.innerHTML = series
    .map(({ label, color }) => `<li><span style="color:${color}">●</span> ${label}</li>`)
    .join('');
}

function renderSelectedRegion() {
  const region = state.selectedRegion;
  if (!region) return;

  regionName.textContent = region;
  simDate.textContent = `Day ${state.day}`;
  renderMetrics(region);
  renderControls(region);
  drawTrendGraph(region);
}

function evolveRegion(regionData, days) {
  for (let i = 0; i < days; i += 1) {
    const { controls, metrics, history } = regionData;
    const taxEffect = (controls.taxRate - 20) * 0.001;
    const wageEffect = (controls.wageLevel - 100) * 0.0008;
    const investEffect = (controls.productionInvestment - 40) * 0.0012;

    metrics.production = clamp(metrics.production * (1 + investEffect - taxEffect * 0.3), 20, 500);
    metrics.demand = clamp(metrics.demand * (1 + wageEffect * 0.4 - taxEffect * 0.2), 20, 500);
    metrics.prices = clamp(metrics.prices * (1 + (metrics.demand - metrics.production) * 0.0005), 20, 500);
    metrics.jobs = clamp(metrics.jobs * (1 + investEffect * 0.25 + wageEffect * 0.1), 1, 10000);
    metrics.population = clamp(metrics.population * 1.00005, 1, 10000);
    metrics.money = clamp(
      metrics.money * (1 + (metrics.production - metrics.prices) * 0.0004 + taxEffect * 0.5),
      0.1,
      10000
    );

    METRIC_CONFIG.forEach(({ key }) => {
      history[key].push(metrics[key]);
      if (history[key].length > 240) history[key].shift();
    });
  }
}

function advanceTime(days) {
  state.day += days;
  Object.values(state.regions).forEach((regionData) => evolveRegion(regionData, days));
  renderSelectedRegion();
}

function selectRegion(region) {
  state.selectedRegion = region;
  sidebar.classList.add('open');

  document.querySelectorAll('.continent').forEach((element) => {
    element.classList.toggle('selected', element.dataset.region === region);
  });

  renderSelectedRegion();
}

function attachEvents() {
  document.querySelectorAll('.continent').forEach((element) => {
    element.addEventListener('click', () => selectRegion(element.dataset.region));
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectRegion(element.dataset.region);
      }
    });
  });

  document.querySelectorAll('.time-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const days = Number(button.dataset.step || 0);
      if (days > 0) advanceTime(days);
    });
  });

  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  });

  closeSidebar?.addEventListener('click', () => {
    sidebar.classList.remove('open');
  });

  Object.entries(controlsEls).forEach(([key, input]) => {
    input?.addEventListener('input', () => {
      if (!state.selectedRegion) return;
      const regionData = state.regions[state.selectedRegion];
      regionData.controls[key] = Number(input.value);
      if (controlValueEls[key]) controlValueEls[key].textContent = input.value;
    });
  });
}

attachEvents();
setActiveTab('overview');
