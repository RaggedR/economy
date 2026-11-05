// The page script. html.ts inlines this into the self-contained file.
// A series stays the colour it was given. Hiding one does not recolour the rest.
(function () {
  var COLORS = ["var(--ink)", "var(--oxide)", "var(--pine)", "var(--ochre)"];

  function format(series, value) {
    if (value === undefined || value === null) return "\u2014";
    if (series.id === "unemployment") return (Math.round(value * 1000) / 10) + "%";
    if (Number.isInteger(value)) return String(value);
    return String(Math.round(value * 1000) / 1000);
  }

  function formatTick(track, value) {
    var unemployment = track.series.length > 0 && track.series.every(function (series) {
      return series.id === "unemployment";
    });
    if (unemployment) return format({ id: "unemployment" }, value);
    if (Number.isInteger(value)) return String(value);
    return String(Math.round(value * 10) / 10);
  }

  function svgEl(name) {
    return document.createElementNS("http://www.w3.org/2000/svg", name);
  }

  function drawTrack(track, months, hidden, selected, emptyLabel) {
    var w = 800;
    var h = 112;
    var padL = 52;
    var padR = 16;
    var padT = 16;
    var padB = 24;
    var plotW = w - padL - padR;
    var plotH = h - padT - padB;
    var svg = svgEl("svg");
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", track.unit);
    var n = Math.max(months.length, 1);
    var visible = [];
    track.series.forEach(function (series, index) {
      if (!hidden.has(series.id)) visible.push({ series: series, index: index });
    });
    var peak = 0;
    visible.forEach(function (item) {
      item.series.points.forEach(function (point) {
        if (point.value > peak) peak = point.value;
      });
    });
    var onlyUnemployment = track.series.length > 0 &&
      track.series.every(function (series) {
        return series.id === "unemployment";
      });
    var max = onlyUnemployment ? 1 : peak <= 0 ? 1 : peak * 1.2;

    function xMonth(month) {
      var i = months.indexOf(month);
      if (i < 0) i = 0;
      return padL + (i + 0.5) * (plotW / n);
    }
    function xOf(month, place) {
      var base = xMonth(month);
      if (visible.length < 2) return base;
      return base + (place - (visible.length - 1) / 2) * 18;
    }
    function yOf(value) {
      return padT + plotH - (value / max) * plotH;
    }

    var hi = months.indexOf(selected);
    if (hi >= 0) {
      var band = svgEl("rect");
      band.setAttribute("x", String(padL + hi * (plotW / n)));
      band.setAttribute("y", String(padT));
      band.setAttribute("width", String(plotW / n));
      band.setAttribute("height", String(plotH));
      band.setAttribute("class", "band");
      svg.appendChild(band);
    }

    if (visible.length > 0) {
      [0, max / 2, max].forEach(function (tick) {
        var y = yOf(tick);
        var rule = svgEl("line");
        rule.setAttribute("x1", String(padL));
        rule.setAttribute("x2", String(w - padR));
        rule.setAttribute("y1", String(y));
        rule.setAttribute("y2", String(y));
        rule.setAttribute("class", "rule");
        svg.appendChild(rule);
        var label = svgEl("text");
        label.setAttribute("x", String(padL - 8));
        label.setAttribute("y", String(y + 3));
        label.setAttribute("class", "tick");
        label.textContent = formatTick(track, tick);
        svg.appendChild(label);
      });
    }

    visible.forEach(function (item, place) {
      var color = COLORS[item.index % COLORS.length];
      var pts = item.series.points.filter(function (point) {
        return months.indexOf(point.month) >= 0;
      });
      if (pts.length === 0) return;
      var d = "";
      pts.forEach(function (point, i) {
        var x = xOf(point.month, place);
        var y = yOf(point.value);
        if (i === 0) d = "M " + x + " " + y;
        else d += " H " + x + " V " + y;
      });
      var path = svgEl("path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", "1.6");
      svg.appendChild(path);
      pts.forEach(function (point) {
        var dot = svgEl("circle");
        dot.setAttribute("cx", String(xOf(point.month, place)));
        dot.setAttribute("cy", String(yOf(point.value)));
        dot.setAttribute("r", "3.5");
        dot.setAttribute("fill", color);
        var title = svgEl("title");
        title.textContent = item.series.label + " " + format(item.series, point.value);
        dot.appendChild(title);
        svg.appendChild(dot);
      });
    });

    months.forEach(function (month) {
      var label = svgEl("text");
      label.setAttribute("x", String(xMonth(month)));
      label.setAttribute("y", String(h - 6));
      label.setAttribute("class", "tick month");
      label.textContent = String(month);
      svg.appendChild(label);
    });

    if (visible.length === 0) {
      var empty = svgEl("text");
      empty.setAttribute("x", String(padL + plotW / 2));
      empty.setAttribute("y", String(padT + plotH / 2));
      empty.setAttribute("class", "tick month");
      empty.textContent = emptyLabel;
      svg.appendChild(empty);
    }

    var cap = svgEl("text");
    cap.setAttribute("x", String(w - padR));
    cap.setAttribute("y", "12");
    cap.setAttribute("class", "tick unit");
    cap.textContent = track.unit;
    svg.appendChild(cap);
    return svg;
  }

  function draw(article) {
    var tape = JSON.parse(article.querySelector("script.tape").textContent);
    var hidden = new Set();
    article.querySelectorAll("input[data-series]").forEach(function (input) {
      if (!input.checked) hidden.add(input.dataset.series);
    });
    var selected = Number(article.dataset.month);
    tape.panels.forEach(function (panel) {
      var host = article.querySelector('[data-panel="' + panel.id + '"] .plot');
      if (!host) return;
      host.replaceChildren();
      panel.tracks.forEach(function (track) {
        var label = track.series.every(function (series) {
            return hidden.has(series.id);
          })
          ? "hidden"
          : "no posting";
        host.appendChild(drawTrack(track, tape.months, hidden, selected, label));
      });
      panel.tracks.forEach(function (track) {
        track.series.forEach(function (series) {
          var li = article.querySelector(
            '[data-panel="' + panel.id + '"] [data-figure="' + series.id + '"]',
          );
          if (!li) return;
          var value = li.querySelector("b");
          var at = series.points.find(function (point) {
            return point.month === selected;
          });
          if (value) value.textContent = format(series, at ? at.value : null);
          li.hidden = hidden.has(series.id);
        });
      });
    });
    article.querySelectorAll(".rail button").forEach(function (btn) {
      btn.setAttribute(
        "aria-pressed",
        btn.dataset.month === String(selected) ? "true" : "false",
      );
    });
    article.querySelectorAll(".reasons").forEach(function (block) {
      block.hidden = block.dataset.month !== String(selected);
    });
  }

  function boot() {
    var select = document.querySelector("#scene");
    var articles = Array.prototype.slice.call(document.querySelectorAll("main article"));
    function show(name) {
      articles.forEach(function (article) {
        article.hidden = article.dataset.scene !== name;
      });
    }
    if (select) {
      select.addEventListener("change", function () {
        show(select.value);
      });
    }
    articles.forEach(function (article) {
      if (!article.dataset.month) article.dataset.month = article.dataset.book;
      article.addEventListener("change", function (event) {
        var target = event.target;
        if (target && target.matches && target.matches("input[data-series]")) {
          draw(article);
        }
      });
      article.querySelectorAll(".rail button").forEach(function (btn) {
        btn.addEventListener("click", function () {
          article.dataset.month = btn.dataset.month;
          draw(article);
        });
      });
      draw(article);
    });
    if (select) show(select.value);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else boot();
})();
