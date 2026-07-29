/* 独立部署产物运行态（原生 JS，无外部框架依赖）。
 * 由 buildStandaloneHtml 注入 window.__DATA__，渲染真实可运行的数据大屏：
 *  - 布局还原（组件绝对定位 + transform:scale 自适应）
 *  - 组件族：文本/图片/指标卡/折线/柱状/饼图/表格/容器/ECharts 全系
 *  - 全局变量 ${G.x} 占位解析（模块间数据互通）
 *  - 联动：点击数据元素 -> 全局筛选；命中 route.links 声明式规则 -> 目标动作
 * 图表优先用 CDN 的 ECharts，离线时降级为 SVG。
 */
(function () {
  'use strict';
  var DATA = window.__DATA__ || { title: '数据大屏', screens: [], globalVars: {}, dataSources: {}, env: {} };
  var vars = DATA.globalVars || {};
  var screens = DATA.screens || [];
  var dsMap = DATA.dataSources || {};
  var env = DATA.env || {};
  var state = { filter: null, index: 0 };

  /* ---------- 事件总线 + 声明式联动 ---------- */
  var bus = (function () {
    var m = {};
    return {
      on: function (t, fn) { (m[t] || (m[t] = [])).push(fn); },
      emit: function (t, p) { (m[t] || []).forEach(function (fn) { fn(p); }); }
    };
  })();

  /* ---------- 工具 ---------- */
  function resolveVars(s) {
    if (typeof s !== 'string') return s;
    return s.replace(/\$\{G\.([A-Za-z0-9_]+)\}/g, function (_, k) {
      return k in vars ? vars[k] : '${G.' + k + '}';
    });
  }
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'style') e.style.cssText = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (html != null) e.innerHTML = html;
    return e;
  }
  function hasEcharts() { return typeof window.echarts !== 'undefined'; }
  function esc(s) { return String(s == null ? '' : s); }

  /* ---------- 图表 ---------- */
  function axisStyle() {
    return {
      axisLine: { lineStyle: { color: '#2a3340' } },
      axisLabel: { color: '#9aa7b4', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(42,51,64,0.6)' } }
    };
  }
  function buildEchartsOption(type, p, data) {
    var color = p.color || '#4f8cff';
    var title = p.title
      ? { text: p.title, textStyle: { color: '#9aa7b4', fontSize: 13 }, left: 8, top: 6 }
      : undefined;
    var legend = p.showLegend ? { textStyle: { color: '#9aa7b4', fontSize: 10 }, bottom: 0 } : undefined;
    var grid = { left: 42, right: 16, top: p.title ? 40 : 20, bottom: p.showLegend ? 40 : 28 };
    if (type === 'echartLine' || type === 'lineChart') {
      return { title: title, legend: legend, grid: grid, tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: data.map(function (d) { return d.name; }), axisLine: { lineStyle: { color: '#2a3340' } }, axisLabel: { color: '#9aa7b4', fontSize: 10 } },
        yAxis: { type: 'value', axisLine: { lineStyle: { color: '#2a3340' } }, axisLabel: { color: '#9aa7b4', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(42,51,64,0.6)' } } },
        series: [{ name: p.title || '数值', type: 'line', smooth: p.smooth !== false, data: data.map(function (d) { return d.value; }), itemStyle: { color: color }, areaStyle: { opacity: 0.12, color: color }, symbolSize: 6 }] };
    }
    if (type === 'echartBar' || type === 'barChart') {
      return { title: title, legend: legend, grid: grid, tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: data.map(function (d) { return d.name; }), axisLine: { lineStyle: { color: '#2a3340' } }, axisLabel: { color: '#9aa7b4', fontSize: 10 } },
        yAxis: { type: 'value', axisLine: { lineStyle: { color: '#2a3340' } }, axisLabel: { color: '#9aa7b4', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(42,51,64,0.6)' } } },
        series: [{ name: p.title || '数值', type: 'bar', barMaxWidth: 28, data: data.map(function (d) { return d.value; }), itemStyle: { color: color, borderRadius: [4, 4, 0, 0] } }] };
    }
    if (type === 'echartPie' || type === 'pieChart') {
      return { title: title, tooltip: { trigger: 'item' },
        legend: p.showLegend !== false ? { textStyle: { color: '#9aa7b4', fontSize: 10 }, bottom: 0 } : undefined,
        series: [{ name: p.title || '占比', type: 'pie', radius: ['38%', '66%'], center: ['50%', '50%'],
          data: data.map(function (d) { return { name: d.name, value: d.value }; }),
          label: { color: '#9aa7b4', fontSize: 10 }, itemStyle: { borderColor: '#0a0e1a', borderWidth: 2 } }] };
    }
    if (type === 'echartGauge') {
      return { series: [{ type: 'gauge', min: 0, max: p.gaugeMax || 100,
        progress: { show: true, width: 10, itemStyle: { color: color } },
        axisLine: { lineStyle: { width: 10, color: [[1, '#1a2433']] } }, axisTick: { show: false },
        splitLine: { length: 8, lineStyle: { color: '#2a3340' } }, axisLabel: { color: '#9aa7b4', fontSize: 9, distance: 16 },
        pointer: { itemStyle: { color: color } },
        title: { show: !!p.title, offsetCenter: [0, '70%'], color: '#9aa7b4', fontSize: 12 },
        detail: { valueAnimation: true, color: '#e6edf3', fontSize: 20, offsetCenter: [0, '40%'] },
        data: [{ value: p.gaugeValue || (data[0] ? data[0].value : 0), name: p.title || '' }] }] };
    }
    if (type === 'echartRadar') {
      var max = Math.max.apply(null, data.map(function (d) { return d.value; })) * 1.2 || 100;
      return { title: title, radar: { indicator: data.map(function (d) { return { name: d.name, max: max }; }),
          axisName: { color: '#9aa7b4', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(42,51,64,0.8)' } },
          splitArea: { areaStyle: { color: ['rgba(79,140,255,0.03)', 'rgba(79,140,255,0.06)'] } } },
        series: [{ type: 'radar', data: [{ value: data.map(function (d) { return d.value; }), name: p.title || '指标', itemStyle: { color: color }, areaStyle: { opacity: 0.2 } }] }] };
    }
    // echartCustom
    try { return JSON.parse(p.optionJson || '{}'); } catch (e) { return { title: { text: 'option JSON 解析失败', textStyle: { color: '#ff5d5d', fontSize: 12 } } }; }
  }
  function svgBarLine(type, p, data) {
    var w = 300, h = 160, pad = 28;
    var max = Math.max.apply(null, data.map(function (d) { return d.value; })) || 1;
    var n = data.length || 1;
    var bw = (w - pad * 2) / n;
    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">';
    svg += '<line x1="' + pad + '" y1="' + (h - pad) + '" x2="' + (w - pad) + '" y2="' + (h - pad) + '" stroke="#2a3340"/>';
    data.forEach(function (d, i) {
      var val = (d.value / max) * (h - pad * 2);
      if (type === 'pieChart' || type === 'echartPie') return;
      if (type === 'barChart' || type === 'echartBar') {
        var x = pad + i * bw + bw * 0.15, bh = val, by = h - pad - bh;
        svg += '<rect x="' + x + '" y="' + by + '" width="' + (bw * 0.7) + '" height="' + bh + '" rx="3" fill="' + (p.color || '#4f8cff') + '"/>';
        svg += '<text x="' + (x + bw * 0.35) + '" y="' + (h - pad + 12) + '" fill="#9aa7b4" font-size="9" text-anchor="middle">' + esc(d.name) + '</text>';
      } else {
        var px = pad + (i / n) * (w - pad * 2), py = h - pad - val;
        svg += (i === 0 ? '' : '<line x1="' + (pad + ((i - 1) / n) * (w - pad * 2)) + '" y1="' + (h - pad - (data[i - 1].value / max) * (h - pad * 2)) + '" x2="' + px + '" y2="' + py + '" stroke="' + (p.color || '#4f8cff') + '" stroke-width="2"/>') + '<circle cx="' + px + '" cy="' + py + '" r="2.5" fill="' + (p.color || '#4f8cff') + '"/>';
        svg += '<text x="' + px + '" y="' + (h - pad + 12) + '" fill="#9aa7b4" font-size="9" text-anchor="middle">' + esc(d.name) + '</text>';
      }
    });
    svg += '</svg>';
    return svg;
  }
  function svgPie(p, data) {
    var w = 220, h = 160, cx = w / 2, cy = h / 2, r = 60;
    var total = data.reduce(function (s, d) { return s + d.value; }, 0) || 1;
    var cols = ['#4f8cff', '#22d3ee', '#a855f7', '#4ade80', '#facc15', '#f87171', '#e0b15a'];
    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">';
    var ang = -Math.PI / 2;
    data.forEach(function (d, i) {
      var a2 = ang + (d.value / total) * Math.PI * 2;
      var x1 = cx + r * Math.cos(ang), y1 = cy + r * Math.sin(ang);
      var x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      var large = (d.value / total) > 0.5 ? 1 : 0;
      svg += '<path d="M' + cx + ' ' + cy + ' L' + x1 + ' ' + y1 + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2 + ' Z" fill="' + cols[i % cols.length] + '"/>';
      ang = a2;
    });
    svg += '</svg>';
    return svg;
  }

  /* ---------- 组件渲染 ---------- */
  var chartInits = []; // {node, type, p, getData}

  function renderWidget(comp) {
    var p = comp.props || {};
    var type = comp.type;
    var node = el('div', { style: 'width:100%;height:100%;position:relative;overflow:hidden;color:#e6edf3;font-family:system-ui,"PingFang SC",sans-serif;box-sizing:border-box;' });
    var data = p.data || [];

    function onPick() {
      if (!p.interactive) return null;
      return function (field, value) {
        var f = { field: field || p.filterField || 'name', value: value };
        // 切换逻辑
        if (state.filter && state.filter.field === f.field && state.filter.value === f.value) applyFilter(null);
        else applyFilter(f);
        // 触发声明式联动
        bus.emit('pick', { componentId: comp.id, type: 'pick', payload: { field: f.field, value: f.value } });
      };
    }

    if (type === 'text') {
      node.style.display = 'flex';
      node.style.alignItems = 'center';
      node.style.padding = '4px 10px';
      node.style.fontSize = (p.fontSize || 14) + 'px';
      node.style.color = p.color || '#e6edf3';
      node.style.textAlign = p.align || 'left';
      node.style.fontWeight = p.bold ? '700' : '400';
      if (p.align === 'center') node.style.justifyContent = 'center';
      if (p.align === 'right') node.style.justifyContent = 'flex-end';
      node.textContent = resolveVars(p.content || '');
    } else if (type === 'image') {
      var img = el('img', { src: resolveVars(p.src || ''), style: 'width:100%;height:100%;object-fit:' + (p.fit || 'cover') });
      node.appendChild(img);
    } else if (type === 'metric') {
      node.style.display = 'flex'; node.style.flexDirection = 'column'; node.style.justifyContent = 'center';
      node.style.padding = '8px 14px';
      var label = el('div', { style: 'font-size:13px;color:#9aa7b4' }, resolveVars(p.label || ''));
      var num = el('div', { style: 'font-size:30px;font-weight:800;background:linear-gradient(135deg,#00d4ff,#4f8cff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;' },
        String(p.data && p.data[0] ? p.data[0].value : (p.value != null ? p.value : 0)));
      node.appendChild(label); node.appendChild(num);
      if (p.unit) node.appendChild(el('div', { style: 'font-size:12px;color:#7889a3' }, resolveVars(p.unit)));
    } else if (type === 'table') {
      var cols = p.columns || (data[0] ? Object.keys(data[0]) : []);
      var tbl = '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
      tbl += '<thead><tr>' + cols.map(function (c) { return '<th style="border:1px solid #1a2433;padding:5px 8px;color:#9aa7b4;background:#0f1a30;text-align:left;">' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
      node._rows = data.map(function (row) {
        return '<tr' + (p.interactive ? ' style="cursor:pointer"' : '') + '>' + cols.map(function (c) {
          var v = row[c];
          return '<td style="border:1px solid #1a2433;padding:5px 8px;">' + esc(v) + '</td>';
        }).join('') + '</tr>';
      });
      tbl += '</tbody></table>';
      node.innerHTML = tbl;
      node.style.overflow = 'auto';
      node._redraw = function (filter) {
        var rows = node._rows;
        if (filter && p.filterField && p.filterField !== 'name') {
          rows = rows.filter(function (_, i) { return true; }); // 表格按行过滤由字段名决定，简版保留全部
        }
        node.querySelector('tbody').innerHTML = rows.join('');
        if (p.interactive) bindTableClicks();
      };
      function bindTableClicks() {
        if (!p.interactive) return;
        var trs = node.querySelectorAll('tbody tr');
        trs.forEach(function (tr, i) {
          tr.onclick = function () { var pk = onPick(); if (pk) pk(p.filterField || cols[0], String(data[i] ? data[i][p.filterField || cols[0]] : '')); };
        });
      }
      bindTableClicks();
    } else if (type === 'container') {
      node.style.background = p.background || 'rgba(15,26,48,0.4)';
      node.style.border = '1px dashed rgba(0,212,255,0.2)';
      node.style.borderRadius = '8px';
    } else if (type === 'digitalTwin' || type === 'twinAlarm') {
      node.style.display = 'flex'; node.style.flexDirection = 'column'; node.style.alignItems = 'center'; node.style.justifyContent = 'center';
      node.style.gap = '6px'; node.style.color = '#9aa7b4'; node.style.fontSize = '12px'; node.style.textAlign = 'center';
      node.innerHTML = '<div style="font-size:26px">🛰️</div><div>' + (type === 'digitalTwin' ? '数字孪生场景' : '孪生告警清单') + '</div><div style="opacity:.7">（3D 运行态需引入孪生运行时，此处为静态占位）</div>';
    } else if (['barChart', 'lineChart', 'pieChart', 'echartLine', 'echartBar', 'echartPie', 'echartGauge', 'echartRadar', 'echartCustom'].indexOf(type) >= 0) {
      node.style.padding = '4px';
      var box = el('div', { style: 'width:100%;height:100%' });
      node.appendChild(box);
      chartInits.push({
        node: box, type: type, p: p,
        getData: function (filter) {
          if (!filter || (p.liveSourceId)) return data;
          var field = p.filterField || 'name';
          if (field === 'name') return data.filter(function (d) { return d.name === filter.value; });
          return data;
        }
      });
    }

    node._comp = comp;
    return node;
  }

  /* ---------- 渲染单个大屏 ---------- */
  function renderScreen(i) {
    state.index = i;
    var screen = screens[i];
    var stage = document.getElementById('stage');
    stage.innerHTML = '';
    chartInits = [];

    var wrap = el('div', { class: 'screen-wrap', style: 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;overflow:hidden;' });
    var canvas = el('div', { class: 'screen-canvas', style: 'position:relative;transform-origin:center center;background:' + (screen.page.background || '#0a0e1a') + ';width:' + screen.page.width + 'px;height:' + screen.page.height + 'px;' });
    canvas.dataset.w = screen.page.width;
    canvas.dataset.h = screen.page.height;
    if (screen.page.backgroundImage) {
      var bg = el('div', { style: 'position:absolute;inset:0;background-image:url(' + screen.page.backgroundImage + ');background-size:cover;background-position:center;opacity:' + (screen.page.backgroundImageOpacity != null ? screen.page.backgroundImageOpacity : 1) + ';' });
      canvas.appendChild(bg);
    }
    screen.components.forEach(function (comp) {
      var c = el('div', { class: 'comp', style: 'position:absolute;left:' + comp.style.x + 'px;top:' + comp.style.y + 'px;width:' + comp.style.w + 'px;height:' + comp.style.h + 'px;' });
      c._filterField = comp.props ? (comp.props.filterField || null) : null;
      var inner = renderWidget(comp);
      c.appendChild(inner);
      canvas.appendChild(c);
    });
    wrap.appendChild(canvas);
    stage.appendChild(wrap);

    // 初始化图表（ECharts 优先，否则 SVG 降级）
    chartInits.forEach(function (c) {
      var d = c.getData(state.filter);
      if (hasEcharts()) {
        try {
          var chart = window.echarts.init(c.node);
          chart.setOption(buildEchartsOption(c.type, c.p, d), true);
          chart.on('click', function (params) {
            if (c.p.interactive && params && params.name) { var pk = c.node._comp && null; }
          });
          c.chart = chart;
        } catch (e) { c.node.innerHTML = svgFallback(c.type, c.p, d); }
      } else {
        c.node.innerHTML = svgFallback(c.type, c.p, d);
      }
    });

    // 点击联动（仅 ECharts 模式下需手动绑定，SVG 也绑定）
    chartInits.forEach(function (c) {
      var d = c.getData(state.filter);
      if (hasEcharts() && c.chart) {
        c.chart.on('click', function (params) {
          if (c.p.interactive && params && typeof params.name === 'string') {
            var f = { field: c.p.filterField || 'name', value: params.name };
            if (state.filter && state.filter.field === f.field && state.filter.value === f.value) applyFilter(null);
            else applyFilter(f);
            bus.emit('pick', { componentId: c.node._comp ? c.node._comp.id : '', type: 'pick', payload: { field: f.field, value: f.value } });
          }
        });
      } else {
        // SVG 柱状/折线：给柱子/点绑定点击
        var rects = c.node.querySelectorAll('rect, circle, path');
        rects.forEach(function (shape, idx) {
          var dNow = c.getData(state.filter);
          shape.style.cursor = c.p.interactive ? 'pointer' : 'default';
          shape.onclick = function () {
            if (!c.p.interactive) return;
            var datum = dNow[idx] || dNow[0];
            if (!datum) return;
            var f = { field: c.p.filterField || 'name', value: datum.name };
            if (state.filter && state.filter.field === f.field && state.filter.value === f.value) applyFilter(null);
            else applyFilter(f);
            bus.emit('pick', { componentId: c.node._comp ? c.node._comp.id : '', type: 'pick', payload: { field: f.field, value: f.value } });
          };
        });
      }
    });

    fit(canvas, wrap);
    window.addEventListener('resize', function () { fit(canvas, wrap); });

    // 声明式联动：监听事件总线，分发当前屏的 links
    bus.on('pick', function (payload) {
      var links = screen.links || [];
      links.filter(function (l) { return l.source.componentId === payload.componentId && l.source.event === payload.type; })
        .forEach(function (l) {
          (l.targets || []).forEach(function (t) {
            if (t.action === 'setFilter') { var pr = t.params || {}; if (pr.field != null && pr.value != null) applyFilter({ field: pr.field, value: String(pr.value) }); }
            else if (t.action === 'clearFilter') { applyFilter(null); }
          });
        });
    });

    if (state.filter) applyFilter(state.filter);
  }

  function svgFallback(type, p, data) {
    if (type === 'echartPie' || type === 'pieChart') return svgPie(p, data);
    if (type === 'echartGauge') return '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9aa7b4;font-size:13px">仪表盘需 ECharts（离线降级）</div>';
    if (type === 'echartRadar') return '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9aa7b4;font-size:13px">雷达图需 ECharts（离线降级）</div>';
    if (type === 'echartCustom') return '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9aa7b4;font-size:13px">自定义图表需 ECharts（离线降级）</div>';
    return svgBarLine(type, p, data);
  }

  /* ---------- 联动筛选 ---------- */
  function applyFilter(f) {
    state.filter = f;
    var canvas = document.querySelector('.screen-canvas');
    if (canvas) {
      var comps = canvas.querySelectorAll('.comp');
      comps.forEach(function (c) {
        if (!f || !c._filterField) { c.style.opacity = '1'; c.style.boxShadow = 'none'; return; }
        if (f.field === c._filterField) {
          // 高亮/过滤：这里以 dim 其余的方式表达（简化版联动）
          c.style.opacity = '1';
          c.style.boxShadow = '0 0 0 1px #00d4ff, 0 0 12px rgba(0,212,255,.3)';
        } else {
          c.style.opacity = '0.35';
          c.style.boxShadow = 'none';
        }
      });
    }
    // 重绘数据组件（按 name 过滤）
    chartInits.forEach(function (c) {
      var d = c.getData(f);
      if (c.chart) { try { c.chart.setOption(buildEchartsOption(c.type, c.p, d), true); } catch (e) {} }
      else { c.node.innerHTML = svgFallback(c.type, c.p, d); bindSvgClicks(c); }
    });
    document.querySelectorAll('.comp > div').forEach(function () {});
    refreshTableFilter(f);
    renderBanner();
  }
  function bindSvgClicks(c) {
    if (!c.p.interactive) return;
    var shapes = c.node.querySelectorAll('rect, circle, path');
    shapes.forEach(function (shape, idx) {
      var dNow = c.getData(state.filter);
      shape.onclick = function () {
        var datum = dNow[idx] || dNow[0]; if (!datum) return;
        var f = { field: c.p.filterField || 'name', value: datum.name };
        if (state.filter && state.filter.field === f.field && state.filter.value === f.value) applyFilter(null); else applyFilter(f);
        bus.emit('pick', { componentId: '', type: 'pick', payload: { field: f.field, value: f.value } });
      };
    });
  }
  function refreshTableFilter(f) {
    document.querySelectorAll('.comp').forEach(function (c) {
      var inner = c.firstChild;
      if (inner && inner._redraw) inner._redraw(f);
    });
  }
  function renderBanner() {
    var b = document.getElementById('banner');
    if (!state.filter) { b.style.display = 'none'; return; }
    b.style.display = 'flex';
    b.innerHTML = '<span>联动筛选：' + esc(state.filter.field) + ' = ' + esc(state.filter.value) + '</span><button id="clearFilter" style="margin-left:10px;background:none;border:1px solid #00d4ff;color:#00d4ff;border-radius:12px;padding:2px 10px;cursor:pointer;font-size:12px">清除</button>';
    document.getElementById('clearFilter').onclick = function () { applyFilter(null); bus.emit('pick', { componentId: '', type: 'pick', payload: {} }); };
  }

  function fit(canvas, wrap) {
    var pad = 24;
    var aw = wrap.clientWidth - pad * 2, ah = wrap.clientHeight - pad * 2;
    var sc = Math.min(aw / Number(canvas.dataset.w), ah / Number(canvas.dataset.h), 1.2);
    canvas.style.transform = 'scale(' + sc + ')';
  }

  /* ---------- 顶部导航 + 启动 ---------- */
  function boot() {
    document.getElementById('title').textContent = DATA.title || '数据大屏';
    var nav = document.getElementById('nav');
    if (screens.length > 1) {
      screens.forEach(function (s, i) {
        var btn = el('button', { class: 'tab' + (i === 0 ? ' active' : ''), onclick: '' }, s.name);
        btn.onclick = function () {
          document.querySelectorAll('#nav .tab').forEach(function (t) { t.className = 'tab'; });
          btn.className = 'tab active';
          renderScreen(i);
        };
        nav.appendChild(btn);
      });
    } else {
      nav.style.display = 'none';
    }
    if (!screens.length) {
      document.getElementById('stage').innerHTML = '<div style="color:#9aa7b4;padding:40px">该部署包未包含任何大屏</div>';
      return;
    }
    renderScreen(0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
