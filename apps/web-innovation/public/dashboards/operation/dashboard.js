(() => {
  // Classic script also supports opening the standalone HTML from disk.
  // oxlint-disable-next-line unicorn/prefer-module
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const cyan = '#39e7ff';
  const blue = '#3597ff';
  const amber = '#ffc66c';
  const months = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);
  // All source metrics are monthly values. November and December are unreported.
  // Codes match the corrected indicator workbook. Mock margin values are independent inputs.
  const metrics = {
    profit: ['CW_Q3010300923_ACT_ALL', [680, -240, 920, 1160, 780, 1520, 1980, 2240, 1870, 2168]],
    cost: ['CW_Q3010400434_ACT_ALL', [16_200, 14_800, 17_300, 16_800, 18_100, 19_200, 22_300, 23_700, 20_400, 19_860]],
    capacity: ['CW_Q9000000399_ACT_ALL', [880, 880, 920, 920, 920, 960, 960, 960, 980, 980]],
    electricityIncome: ['CW_Q2000500355_ACT_ALL', [16_950, 15_220, 18_260, 18_080, 19_240, 21_050, 24_760, 26_580, 22_480, 22_360]],
    heatIncome: ['CW_Q2040600085_ACT_ALL', [1180, 1060, 1340, 1290, 1410, 1490, 1580, 1620, 1520, 1460]],
    powerTarget: ['CW_Q2010100004_BUD_ALL', [36_000, 34_000, 38_000, 37_000, 39_000, 42_000, 48_000, 50_000, 44_000, 43_000]],
    powerActual: ['CW_Q2010100004_ACT_ALL', [35_200, 32_600, 38_900, 37_400, 38_600, 43_800, 49_200, 52_100, 44_600, 45_160]],
    coalPower: ['CW_Q2040100016_ACT_COAL', [24_900, 23_100, 27_400, 26_300, 27_100, 30_100, 33_700, 35_200, 31_100, 31_420]],
    gasPower: ['CW_Q2040100016_ACT_GAS', [9200, 8500, 10_400, 10_000, 10_200, 12_200, 13_800, 15_100, 12_000, 12_160]],
    electricityPrice: ['CW_Q9000000295_ACT_ALL', [495, 488, 502, 510, 498, 512, 525, 538, 519, 516]],
    heatTarget: ['CW_Q2040600029_BUD_ALL', [19, 18, 21, 21, 23, 23, 24, 25, 24, 23]],
    heatActual: ['CW_Q2040600029_ACT_ALL', [18.8, 17.2, 21.4, 20.5, 22.3, 23.5, 24.8, 25.4, 24.1, 23.2]],
    heatPrice: ['CW_Q2000500453_ACT_ALL', [62.8, 61.6, 62.6, 62.9, 63.2, 63.4, 63.7, 63.8, 63.1, 62.9]],
    coalPriceB: ['CW_Q9000000397_ACT_COAL', [456, 448, 462, 470, 460, 476, 492, 505, 482, 478]],
    gasPriceB: ['CW_Q9000000397_ACT_GAS', [668, 650, 670, 682, 675, 690, 708, 720, 695, 688]],
    coalUnitCost: ['CW_Q9000000360_ACT_COAL', [292, 299, 285, 281, 289, 277, 274, 270, 279, 276]],
    gasUnitCost: ['CW_Q9000000360_ACT_GAS', [486, 498, 479, 472, 481, 465, 458, 449, 466, 462]],
    coalMargin: ['CW_Q9000000405_ACT_COAL', [138, 126, 152, 165, 145, 176, 192, 211, 181, 184]],
    gasMargin: ['CW_Q9000000405_ACT_GAS', [149, 121, 156, 175, 161, 186, 207, 226, 192, 195]],
    materials: ['CW_Q2040600157_ACT_ALL', [52, 48, 64, 59, 62, 73, 80, 76, 68, 65]],
    repairs: ['CW_Q9000000074_ACT_ALL', [88, 102, 140, 118, 160, 126, 112, 105, 132, 116]],
    operations: ['CW_Q9000000150_ACT_ALL', [116, 108, 123, 120, 128, 132, 141, 145, 136, 130]],
    entrusted: ['CW_Q9000000159_ACT_ALL', [79, 79, 81, 81, 83, 83, 86, 86, 85, 84]],
    coalFuel: ['CW_Q2040400140_ACT_COAL', [7380, 7040, 8020, 7630, 8010, 8510, 9430, 9630, 8850, 8760]],
    gasFuel: ['CW_Q2040400140_ACT_GAS', [4710, 4480, 5120, 4890, 5080, 5850, 6380, 6720, 5760, 5890]],
    coalConsumption: ['CW_Q2040100041_ACT_ALL', [298.4, 301.2, 296.8, 295.1, 297.2, 293.4, 291.8, 290.5, 293.2, 292.6]],
    coalUnitPrice: ['CW_Q2040600002_ACT_ALL', [978, 992, 960, 952, 970, 941, 935, 928, 950, 943]],
    gasConsumption: ['CW_Q9000000346_ACT_ALL', [0.184, 0.188, 0.182, 0.181, 0.183, 0.179, 0.177, 0.175, 0.18, 0.178]],
    gasUnitPrice: ['CW_Q9000000370_ACT_ALL', [2.64, 2.65, 2.63, 2.61, 2.63, 2.6, 2.59, 2.57, 2.59, 2.6]],
    longVolume: ['CW_Q9000000380_ACT_ALL', [23_900, 22_400, 26_100, 24_800, 26_000, 29_200, 32_600, 34_100, 30_200, 29_860]],
    longPrice: ['CW_Q9000000381_ACT_ALL', [468, 468, 470, 470, 472, 472, 475, 475, 476, 476]],
    agencyVolume: ['CW_Q9000000383_ACT_ALL', [4600, 4200, 4900, 4700, 4800, 5500, 6100, 6500, 5600, 5840]],
    agencyPrice: ['CW_Q9000000384_ACT_ALL', [486, 479, 491, 498, 487, 503, 518, 529, 508, 502]],
    spotVolume: ['CW_Q9000000385_ACT_ALL', [4100, 3600, 5100, 5200, 4900, 5800, 6700, 7400, 5400, 6120]],
    spotPrice: ['CW_Q9000000386_ACT_ALL', [531, 498, 548, 562, 539, 578, 611, 632, 586, 574]],
  };
  const previousCosts = {
    materials: [57, 54, 68, 63, 69, 79, 85, 83, 74, 71],
    repairs: [95, 112, 153, 129, 168, 140, 124, 119, 145, 128],
    operations: [122, 116, 129, 127, 135, 140, 149, 154, 144, 139],
    entrusted: [81, 81, 84, 84, 86, 86, 89, 89, 89, 88],
  };
  const expenseKeys = ['materials', 'repairs', 'operations', 'entrusted'];
  const expenseNames = ['材料费', '修理费', '生产运行费', '委托运营费'];
  const state = { month: 10, playing: true };
  const panels = {
    power: { view: 'execution', views: ['execution', 'structure'], remaining: 20_000, manualUntil: 0, hovering: false },
    cost: { view: 'production', views: ['production', 'fuel'], remaining: 27_000, manualUntil: 0, hovering: false },
    drivers: { view: 'coal', views: ['coal', 'gas'], remaining: 34_000, manualUntil: 0, hovering: false },
  };
  const charts = new Map();
  const index = () => state.month - 1;
  const value = (key) => metrics[key][1][index()];
  const padded = (values) => [...values, null, null];
  const data = (key) => padded(metrics[key][1]);
  const format = (number, digits = 0) => (number === null || number === undefined) ? '—' : number.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const completion = (actual, target) => target > 0 ? `${format(actual / target * 100, 1)}%` : '—';
  const stat = (label, number, unit = '', digits = 0, color = '') => `<div class="stat"><span class="stat-label">${label}</span><strong class="stat-number ${color}">${typeof number === 'string' ? number : format(number, digits)}</strong><span class="stat-unit">${unit}</span></div>`;
  const tooltip = {
    trigger: 'axis', backgroundColor: '#082641f5', borderColor: '#3ca5c7', borderWidth: 1,
    padding: [9, 12], textStyle: { color: '#e0f3ff', fontSize: 13 }, confine: true,
    axisPointer: { type: 'line', lineStyle: { color: '#5bc6e5', type: 'dashed' } },
  };
  function axisOptions() {
    return {
      animationDuration: 350, animationDurationUpdate: 260,
      textStyle: { fontFamily: 'Microsoft YaHei', color: '#99b8d0' },
      tooltip: { ...tooltip, valueFormatter: (v) => (v === null || v === undefined) ? '未报送' : format(v, Number.isInteger(v) ? 0 : 2) },
      legend: { top: 5, left: 'center', itemWidth: 12, itemHeight: 7, itemGap: 13, textStyle: { color: '#a5c7df', fontSize: 11 } },
      grid: { top: 35, bottom: 24, left: 43, right: 12 },
      xAxis: { type: 'category', data: months, axisTick: { show: false }, axisLine: { lineStyle: { color: '#41607d' } }, axisLabel: { interval: 0, fontSize: 10, color: (v) => v === `${state.month}月` ? cyan : '#8aa9c3' } },
      yAxis: { type: 'value', splitNumber: 3, axisLabel: { color: '#88a7c1', fontSize: 10 }, splitLine: { lineStyle: { color: '#213d5b', type: 'dashed' } } },
    };
  }
  const selection = () => ({ silent: true, itemStyle: { color: '#31c5ee0e' }, data: [[{ xAxis: index() - 0.45 }, { xAxis: index() + 0.45 }]] });
  function line(name, values, color, highlight = false) {
    return { name, type: 'line', data: values, smooth: false, connectNulls: false, symbol: 'circle', symbolSize: (_, p) => p.dataIndex === index() ? 7 : 3, lineStyle: { width: 2 }, itemStyle: { color }, ...(highlight ? { markArea: selection() } : {}) };
  }
  function bar(name, values, color, extras = {}) {
    return { name, type: 'bar', data: values, barMaxWidth: 14, itemStyle: { color, borderRadius: [2, 2, 0, 0] }, emphasis: { focus: 'series' }, ...extras };
  }
  function chart(id, option) {
    if (!charts.has(id)) charts.set(id, echarts.init(document.querySelector(`#${id}`), null, { renderer: 'svg' }));
    charts.get(id).setOption(option, { notMerge: true, lazyUpdate: false });
  }
  function overview() {
    $('#profit-value').textContent = format(value('profit'));
    $('#profit-value').classList.toggle('negative', value('profit') < 0);
    $('#profit-status').textContent = ['亏损', '持平', '盈利'][Math.sign(value('profit')) + 1];
    $('#profit-status').classList.toggle('negative', value('profit') < 0);
    $('#cost-value').textContent = format(value('cost'));
    $('#capacity-value').textContent = format(value('capacity'));
    document.querySelectorAll('.selected-period').forEach((el) => { el.textContent = `2026年${String(state.month).padStart(2, '0')}月`; });
  }
  function income() {
    $('#income-stats').innerHTML = stat('电力收入', value('electricityIncome')) + stat('热力收入', value('heatIncome')) + stat('两项合计', value('electricityIncome') + value('heatIncome'));
    chart('income-chart', { ...axisOptions(), series: [bar('电力收入', data('electricityIncome'), blue, { stack: 'income', markArea: selection() }), bar('热力收入', data('heatIncome'), cyan, { stack: 'income' })] });
  }
  function quantityPrice(id, actualKey, targetKey, priceKey, priceName) {
    const option = axisOptions();
    option.grid.right = 38;
    option.yAxis = [option.yAxis, { ...option.yAxis, splitLine: { show: false } }];
    option.series = [bar('目标', data(targetKey), '#527caa77', { markArea: selection() }), bar('实际', data(actualKey), cyan), { ...line(priceName, data(priceKey), amber), yAxisIndex: 1 }];
    chart(id, option);
  }
  function power() {
    if (panels.power.view === 'execution') {
      $('#power-stats').innerHTML = stat('实际 / 万千瓦时', value('powerActual')) + stat('月目标', value('powerTarget')) + stat('完成率', completion(value('powerActual'), value('powerTarget')));
      quantityPrice('power-chart', 'powerActual', 'powerTarget', 'electricityPrice', '售电均价');
      $('#power-caption').innerHTML = '当月目标与实际 · 月均电价<span>柱：万kWh / 线：元/MWh</span>';
    } else {
      $('#power-stats').innerHTML = stat('燃煤发电量', value('coalPower')) + stat('燃气发电量', value('gasPower')) + stat('煤气合计', value('coalPower') + value('gasPower'));
      chart('power-chart', { ...axisOptions(), series: [bar('燃煤', data('coalPower'), cyan, { stack: 'power', markArea: selection() }), bar('燃气', data('gasPower'), blue, { stack: 'power' })] });
      $('#power-caption').innerHTML = '煤气发电量构成<span>单位：万千瓦时</span>';
    }
  }
  function heat() {
    $('#heat-stats').innerHTML = stat('实际 / 万吉焦', value('heatActual'), '', 2) + stat('月目标', value('heatTarget'), '', 2) + stat('完成率', completion(value('heatActual'), value('heatTarget')));
    quantityPrice('heat-chart', 'heatActual', 'heatTarget', 'heatPrice', '售热均价');
  }
  function margin() {
    $('#margin-stats').innerHTML = stat('燃煤边际利润', value('coalMargin')) + stat('燃气边际利润', value('gasMargin'));
    const option = axisOptions();
    option.xAxis.data = ['燃煤', '燃气'];
    option.series = [bar('电量电价B', [value('coalPriceB'), value('gasPriceB')], blue), bar('单位燃料成本', [value('coalUnitCost'), value('gasUnitCost')], cyan), bar('边际利润', [value('coalMargin'), value('gasMargin')], amber)].map((s) => ({ ...s, barMaxWidth: 26, label: { show: true, position: 'top', fontSize: 11, color: '#d5e8f5' } }));
    chart('margin-chart', option);
  }
  const totals = (previous = false) => Array.from({ length: 10 }, (_, i) => expenseKeys.reduce((sum, key) => sum + (previous ? previousCosts[key][i] : metrics[key][1][i]), 0));
  function expense() {
    const option = axisOptions();
    if (panels.cost.view === 'production') {
      const current = totals();
      const previous = totals(true);
      const difference = current[index()] - previous[index()];
      $('#expense-stats').innerHTML = stat('四项成本合计', current[index()], '万元') + stat('上年同月', previous[index()], '万元') + stat('同比差额', `${difference > 0 ? '+' : ''}${format(difference)}`, '万元');
      option.series = [line('本年', padded(current), cyan, true), line('上年同期', padded(previous), amber)];
      option.tooltip = { ...tooltip, formatter: (params) => {
        const i = params[0].dataIndex;
        if (i > 9) return `${months[i]} · 未报送`;
        return `<b>${months[i]} · 四项成本 / 万元</b><br/>${  params.map((p) => `${p.marker}${p.seriesName}合计：${format(p.value)}`).join('<br/>')  }<br/>${  expenseNames.map((name, j) => `${name}：${metrics[expenseKeys[j]][1][i]} / ${previousCosts[expenseKeys[j]][i]}`).join('<br/>')  }<br/><span style="color:#8baec8">明细顺序：本年 / 上年</span>`;
      } };
      $('#expense-caption').innerHTML = '材料 / 修理 / 生产运行 / 委托运营<span>双线：本年与上年</span>';
    } else {
      $('#expense-stats').innerHTML = stat('燃煤燃料费', value('coalFuel'), '万元') + stat('燃气燃料费', value('gasFuel'), '万元');
      option.series = [line('燃煤', data('coalFuel'), cyan, true), line('燃气', data('gasFuel'), blue)];
      $('#expense-caption').innerHTML = '燃煤、燃气月度燃料费<span>双线：燃煤与燃气</span>';
    }
    chart('expense-chart', option);
  }
  function drivers() {
    const items = panels.drivers.view === 'coal' ? [['供电标准煤耗', 'coalConsumption', '克/千瓦时', 1], ['入炉综合标煤单价', 'coalUnitPrice', '元/吨', 0]] : [['供电实际气耗率', 'gasConsumption', '立方米/千瓦时', 3], ['天然气价（含税）', 'gasUnitPrice', '元/立方米', 2]];
    items.forEach(([label, key, unit, digits], i) => {
      const id = i === 0 ? 'one' : 'two';
      $(`#driver-${id}-label`).textContent = label;
      $(`#driver-${id}-value`).innerHTML = `${format(value(key), digits)}<span class="stat-unit">${unit}</span>`;
      const option = axisOptions();
      option.legend.show = false;
      option.grid = { top: 13, bottom: 22, left: 5, right: 5 };
      option.xAxis.axisLabel.formatter = (v, n) => [0, 4, 9, 11].includes(n) ? v : '';
      option.yAxis = { type: 'value', scale: true, show: false };
      option.series = [{ ...line(label, data(key), i === 0 ? cyan : amber, true), areaStyle: { color: i === 0 ? '#39e7ff15' : '#ffc66c12' } }];
      option.tooltip.valueFormatter = (v) => (v === null || v === undefined) ? '未报送' : `${format(v, digits)} ${unit}`;
      chart(`driver-${id}-chart`, option);
    });
  }
  function profit() {
    $('#profit-stats').innerHTML = stat('所选月利润', value('profit'), '万元', 0, value('profit') < 0 ? 'negative' : '') + stat('数据月份', `2026.${String(state.month).padStart(2, '0')}`);
    const option = axisOptions();
    option.legend.show = false;
    option.grid.top = 14;
    option.series = [{ ...line('月度利润', data('profit'), cyan, true), areaStyle: { color: '#279ace19' }, markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: '#b0d0e2', width: 1 }, data: [{ yAxis: 0 }] } }];
    chart('profit-chart', option);
  }
  function market() {
    const option = axisOptions();
    const categories = ['中长期', '代购电', '现货'];
    option.legend.show = false;
    option.title = [{ text: '电量 · 万千瓦时', top: 0, left: 3, textStyle: { color: '#91bad5', fontSize: 11, fontWeight: 'normal' } }, { text: '电价 · 元/兆瓦时', top: '49%', left: 3, textStyle: { color: '#91bad5', fontSize: 11, fontWeight: 'normal' } }];
    option.grid = [{ top: '14%', height: '30%', left: 45, right: 14 }, { top: '65%', bottom: 22, left: 45, right: 14 }];
    option.xAxis = [{ ...option.xAxis, data: categories, axisLabel: { show: false } }, { ...option.xAxis, gridIndex: 1, data: categories, axisLabel: { color: '#adc6d9', fontSize: 12 } }];
    option.yAxis = [{ ...option.yAxis, splitNumber: 2 }, { ...option.yAxis, gridIndex: 1, splitNumber: 2, min: 0 }];
    option.series = [
      { ...bar('电量', [value('longVolume'), value('agencyVolume'), value('spotVolume')], cyan), barMaxWidth: 28, label: { show: true, position: 'top', fontSize: 12, color: '#c5eff6' } },
      { name: '电价', type: 'scatter', xAxisIndex: 1, yAxisIndex: 1, data: [value('longPrice'), value('agencyPrice'), value('spotPrice')], symbolSize: 9, itemStyle: { color: amber }, label: { show: true, position: 'top', fontSize: 12, color: '#ffdb9f' } },
    ];
    chart('market-chart', option);
  }
  const renderers = { power, cost: expense, drivers };
  function switchPanel(key, view) {
    const panel = panels[key];
    panel.view = view;
    const element = document.querySelector(`[data-rotating="${key}"]`);
    element.querySelectorAll('[data-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === view);
      button.setAttribute('aria-pressed', String(button.dataset.tab === view));
    });
    renderers[key]();
    const body = element.querySelector('.panel-body');
    body.classList.remove('switching');
    void body.offsetWidth;
    body.classList.add('switching');
  }
  function renderAll() { overview(); income(); power(); heat(); margin(); expense(); drivers(); profit(); market(); }
  function resize() {
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    $('#screen').style.transform = `scale(${scale})`;
    $('#screen').style.left = `${(window.innerWidth - 1920 * scale) / 2}px`;
    $('#screen').style.top = `${(window.innerHeight - 1080 * scale) / 2}px`;
    charts.forEach((instance) => instance.resize());
  }
  function updateClock() {
    const now = new Date();
    $('#clock').textContent = now.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    $('#clock').dateTime = now.toISOString();
  }
  $('#month').innerHTML = Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${i === 9 ? 'selected' : ''}>2026年${String(i + 1).padStart(2, '0')}月</option>`).join('');
  $('#month').addEventListener('change', (event) => { state.month = Number(event.target.value); renderAll(); });
  Object.entries(panels).forEach(([key, panel]) => {
    const element = document.querySelector(`[data-rotating="${key}"]`);
    element.addEventListener('mouseenter', () => { panel.hovering = true; });
    element.addEventListener('mouseleave', () => { panel.hovering = false; });
    element.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => {
      panel.manualUntil = performance.now() + 60_000;
      panel.remaining = 20_000;
      switchPanel(key, button.dataset.tab);
    }));
  });
  $('#rotation').addEventListener('click', () => {
    state.playing = !state.playing;
    $('#rotation').textContent = state.playing ? '暂停轮播' : '恢复轮播';
    $('#rotation').setAttribute('aria-pressed', String(state.playing));
    $('#rotation-state').textContent = state.playing ? '页签自动轮播中' : '页签轮播已暂停 · 可手动切换';
  });
  $('#fullscreen').addEventListener('click', async () => {
    try {
      await (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
    } catch { $('#fullscreen').textContent = '请使用 F11 全屏'; }
  });
  let lastTick = performance.now();
  const tick = setInterval(() => {
    const now = performance.now();
    const elapsed = Math.min(now - lastTick, 1000);
    lastTick = now;
    if (!state.playing || document.hidden) return;
    Object.entries(panels).forEach(([key, panel]) => {
      if (panel.hovering) return;
      if (panel.manualUntil) {
        if (now < panel.manualUntil) return;
        panel.manualUntil = 0;
        panel.remaining = 0;
      }
      panel.remaining -= elapsed;
      if (panel.remaining <= 0) {
        switchPanel(key, panel.views[(panel.views.indexOf(panel.view) + 1) % panel.views.length]);
        panel.remaining = 20_000;
      }
    });
  }, 250);
  const clockTimer = setInterval(updateClock, 1000);
  window.addEventListener('resize', resize);
  window.addEventListener('pagehide', (event) => {
    // Preserve timers/charts when the browser places the page in the back-forward cache.
    if (event.persisted) return;
    clearInterval(tick); clearInterval(clockTimer);
    charts.forEach((instance) => instance.dispose());
  });
  updateClock(); resize(); renderAll();
})();
