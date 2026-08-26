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
  var datasetLabels = DATA.datasetLabels || {};
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
      function tableColumnKey(c) {
        if (c && typeof c === 'object') return String(c.key || c.field || c.dataIndex || '');
        return '';
      }
      function tableHeaderText(c) {
        if (typeof c === 'string') return c;
        var o = c || {};
        if (o.dataSetFieldKey && datasetLabels[o.dataSetFieldKey]) return datasetLabels[o.dataSetFieldKey];
        return String(o.name || o.label || o.key || o.title || '');
      }
      function tableCell(row, c, i) {
        var k = tableColumnKey(c);
        var v = k ? row[k] : (i === 0 ? row.name : row.value);
        return v == null ? '' : String(v);
      }
      var hidden = {};
      (p.hiddenColumns || []).forEach(function (k) { hidden[k] = true; });
      var cols = (p.columns || (data[0] ? Object.keys(data[0]) : [])).filter(function (c) {
        if (typeof c === 'string') return !hidden[c];
        return !hidden[String(c.key || c.dataSetFieldKey || '')];
      });
      if (!cols.length) cols = ['名称', '数值'];
      node._rows = data.map(function (row) {
        return '<tr' + (p.interactive ? ' style="cursor:pointer"' : '') + '>' + cols.map(function (c, j) {
          return '<td style="border:1px solid #1a2433;padding:5px 8px;">' + esc(tableCell(row, c, j)) + '</td>';
        }).join('') + '</tr>';
      });
      var headHtml = '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' + cols.map(function (c) { return '<th style="border:1px solid #1a2433;padding:5px 8px;color:#9aa7b4;background:#0f1a30;text-align:left;">' + esc(tableHeaderText(c)) + '</th>'; }).join('') + '</tr></thead></table>';
      var scrollEnabled = !!p.scroll;
      var visibleRowsCount = Math.max(1, Math.round(Number(p.visibleRows) || 6));
      var tableHtml;
      if (scrollEnabled) {
        tableHtml = '<div class="w-table-scroll" style="display:flex;flex-direction:column;height:100%;overflow:hidden;">' +
          '<div style="flex:none;overflow:hidden;">' + headHtml + '</div>' +
          '<div class="w-table-body" style="position:relative;flex:1;min-height:0;overflow:hidden;">' +
          '<div class="w-table-track" style="will-change:transform;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px;"><tbody>' +
          node._rows.join('') + node._rows.join('') +
          '</tbody></table></div></div></div>';
      } else {
        tableHtml = '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' + cols.map(function (c) { return '<th style="border:1px solid #1a2433;padding:5px 8px;color:#9aa7b4;background:#0f1a30;text-align:left;">' + esc(tableHeaderText(c)) + '</th>'; }).join('') + '</tr></thead><tbody>' + node._rows.join('') + '</tbody></table>';
      }
      var tbl = tableHtml;
      node.innerHTML = tbl;
      node.style.overflow = scrollEnabled ? 'hidden' : 'auto';
      node._stopScroll = null;
      var bodyEl = scrollEnabled ? node.querySelector('.w-table-body') : null;
      var trackEl = scrollEnabled ? node.querySelector('.w-table-track') : null;
      function startScroll() {
        if (!scrollEnabled || !bodyEl || !trackEl || data.length <= visibleRowsCount) return;
        var speed = Math.max(5, Number(p.scrollSpeed) || 30);
        var hovered = false;
        var offset = 0;
        var last = performance.now();
        bodyEl.onmouseenter = function () { hovered = true; };
        bodyEl.onmouseleave = function () { hovered = false; };
        function tick(now) {
          var dt = Math.min(64, now - last);
          last = now;
          if (!hovered) {
            offset += (speed * dt) / 1000;
            var half = trackEl.offsetHeight / 2;
            if (half > 0 && offset >= half) offset -= half;
            trackEl.style.transform = 'translateY(' + (-offset) + 'px)';
          }
          node._raf = requestAnimationFrame(tick);
        }
        node._raf = requestAnimationFrame(tick);
        node._stopScroll = function () {
          if (node._raf) cancelAnimationFrame(node._raf);
          node._raf = null;
        };
      }
      function measureBody() {
        if (!scrollEnabled || !bodyEl || !trackEl) return;
        var firstRow = trackEl.querySelector('tbody tr');
        var rowHeight = firstRow ? firstRow.offsetHeight : 28;
        var totalHeight = trackEl.offsetHeight / 2;
        var h = Math.min(Math.max(rowHeight * visibleRowsCount, rowHeight), totalHeight);
        bodyEl.style.height = h + 'px';
      }
      function measureAndStart() {
        if (!scrollEnabled) return;
        measureBody();
        startScroll();
      }
      // 节点可能尚未挂载进文档，先等下一帧完成布局后再测量可视区高度并启动滚动。
      if (document.body.contains(node)) measureAndStart();
      else requestAnimationFrame(function () { measureAndStart(); });
      node._restartScroll = function () {
        if (node._stopScroll) node._stopScroll();
        measureBody();
        startScroll();
      };
      node._redraw = function (filter) {
        var rows = node._rows;
        if (filter && p.filterField && p.filterField !== 'name') {
          rows = rows.filter(function (_, i) { return true; }); // 表格按行过滤由字段名决定，简版保留全部
        }
        var tb = node.querySelector('tbody');
        if (tb) tb.innerHTML = rows.join('') + (scrollEnabled ? rows.join('') : '');
        if (scrollEnabled && trackEl) {
          var half = trackEl.offsetHeight / 2;
          trackEl.style.transform = half > 0 ? 'translateY(0)' : '';
          node._restartScroll();
        }
        if (p.interactive) bindTableClicks();
      };
      function bindTableClicks() {
        if (!p.interactive) return;
        var trs = node.querySelectorAll('tbody tr');
        trs.forEach(function (tr, i) {
          tr.onclick = function () {
            var pk = onPick();
            if (!pk) return;
            var field = p.filterField || tableColumnKey(cols[0]) || cols[0] || 'name';
            pk(field, String(data[i % data.length] ? data[i % data.length][field] : ''));
          };
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
