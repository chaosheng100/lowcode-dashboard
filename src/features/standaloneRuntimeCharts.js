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
