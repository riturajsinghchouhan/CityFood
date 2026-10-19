// The Dashboard's recharts 3 charts redrawn with react-native-svg: an area + line chart, a grouped
// bar chart and a (donut) pie, with recharts' defaults copied where they show: 5 "nice" y ticks
// from 0, 60 px y axis, 30 px x axis, preserveEnd x tick thinning, dashed #f0f0f0 grid, monotone
// curves, area fillOpacity 0.6, bar barCategoryGap 10% / barGap 4, pie start angle 0 going
// counter-clockwise, the legend with line/rect icons and series-coloured text, and the tooltip
// (shown on tap instead of hover).
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { Text } from "../ui";

const MARGIN = 5;
const Y_AXIS_WIDTH = 60;
const X_AXIS_HEIGHT = 30;
const AXIS_COLOR = "#9ca3af";
const GRID_COLOR = "#f0f0f0";
const TICK_FONT = 11;
const LEGEND_HEIGHT = 30;

export const chartTooltipStyle = {
  backgroundColor: "#ffffff",
  borderWidth: 1,
  borderColor: "#e5e7eb",
  borderRadius: 12,
  boxShadow: "0px 8px 24px rgba(0,0,0,0.08)",
};

// recharts getNiceTickValues([0, max], 5) for a 0-based domain.
function niceTicks(maxValue, count = 5) {
  const max = Number(maxValue) || 0;
  if (max <= 0) return [0, 1, 2, 3, 4];
  const roughStep = max / (count - 1);
  const digitCount = Math.floor(Math.log10(roughStep)) + 1;
  const digitCountValue = 10 ** digitCount;
  const stepRatio = roughStep / digitCountValue;
  const stepRatioScale = digitCount !== 1 ? 0.05 : 0.1;
  const amend = Math.ceil(stepRatio / stepRatioScale) * stepRatioScale;
  const step = Number((amend * digitCountValue).toPrecision(12));
  return Array.from({ length: count }, (_, i) => Number((step * i).toPrecision(12)));
}

// d3 curveMonotoneX.
function monotonePath(points) {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M${points[0].x},${points[0].y}`;
  if (n === 2) return `M${points[0].x},${points[0].y}L${points[1].x},${points[1].y}`;
  const sign = (v) => (v < 0 ? -1 : 1);
  const t = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i += 1) {
    const h0 = points[i].x - points[i - 1].x;
    const h1 = points[i + 1].x - points[i].x;
    const s0 = (points[i].y - points[i - 1].y) / (h0 || 1e-12);
    const s1 = (points[i + 1].y - points[i].y) / (h1 || 1e-12);
    const p = (s0 * h1 + s1 * h0) / (h0 + h1);
    t[i] = (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
  }
  const slope2 = (a, b, tangent) => {
    const h = b.x - a.x;
    return h ? (3 * (b.y - a.y) / h - tangent) / 2 : tangent;
  };
  t[0] = slope2(points[0], points[1], t[1]);
  t[n - 1] = slope2(points[n - 2], points[n - 1], t[n - 2]);
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < n - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = (b.x - a.x) / 3;
    d += `C${a.x + dx},${a.y + dx * t[i]},${b.x - dx},${b.y - dx * t[i + 1]},${b.x},${b.y}`;
  }
  return d;
}

// interval="preserveEnd": keep the last tick, walk backwards dropping ticks that would overlap.
function visibleTickIndexes(xs, labels) {
  const width = (s) => String(s ?? "").length * TICK_FONT * 0.58;
  const keep = new Set();
  let leftEdge = Infinity;
  for (let i = xs.length - 1; i >= 0; i -= 1) {
    const w = width(labels[i]);
    const right = xs[i] + w / 2;
    if (right + 2 <= leftEdge) {
      keep.add(i);
      leftEdge = xs[i] - w / 2;
    }
  }
  return keep;
}

function LegendIcon({ type, color }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 32 32">
      {type === "line" ? (
        <Path
          d="M0,16h10.666666666666666A5.333333333333333,5.333333333333333,0,1,1,21.333333333333332,16H32M21.333333333333332,16A5.333333333333333,5.333333333333333,0,1,1,10.666666666666666,16"
          stroke={color}
          strokeWidth={4}
          fill="none"
        />
      ) : (
        <Path d="M0,4h32v24h-32z" fill={color} />
      )}
    </Svg>
  );
}

export function ChartLegend({ items, textStyle }) {
  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <View key={item.name} style={styles.legendItem}>
          <LegendIcon type={item.type} color={item.color} />
          <Text style={[styles.legendText, { color: item.color }, textStyle]}>{item.name}</Text>
        </View>
      ))}
    </View>
  );
}

function Tooltip({ label, rows, x, y, width, height }) {
  const boxW = 150;
  const left = Math.max(0, Math.min(x + 10, width - boxW));
  const top = Math.max(0, Math.min(y + 10, height - 30 - rows.length * 22));
  return (
    <View pointerEvents="none" style={[styles.tooltip, { left, top, maxWidth: boxW }]}>
      {label != null ? <Text style={styles.tooltipLabel}>{label}</Text> : null}
      {rows.map((r) => (
        <Text key={r.name} style={[styles.tooltipRow, { color: r.color }]}>
          {r.name} : {r.value}
        </Text>
      ))}
    </View>
  );
}

function useWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = (e) => {
    const w = Math.round(e.nativeEvent.layout.width);
    setWidth((prev) => (prev === w ? prev : w));
  };
  return [width, onLayout];
}

function CartesianFrame({ plot, ticks, labels, xs, yOf }) {
  const keep = visibleTickIndexes(xs, labels);
  return (
    <G>
      {ticks.map((tick) => (
        <Line
          key={`h${tick}`}
          x1={plot.left}
          x2={plot.right}
          y1={yOf(tick)}
          y2={yOf(tick)}
          stroke={GRID_COLOR}
          strokeDasharray="3 3"
        />
      ))}
      {xs.map((x, i) => (
        <Line key={`v${i}`} x1={x} x2={x} y1={plot.top} y2={plot.bottom} stroke={GRID_COLOR} strokeDasharray="3 3" />
      ))}
      <Line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} stroke={AXIS_COLOR} />
      <Line x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.bottom} stroke={AXIS_COLOR} />
      {ticks.map((tick) => (
        <G key={`yt${tick}`}>
          <Line x1={plot.left - 6} x2={plot.left} y1={yOf(tick)} y2={yOf(tick)} stroke={AXIS_COLOR} />
          <SvgText
            x={plot.left - 8}
            y={yOf(tick) + TICK_FONT / 3}
            fontSize={TICK_FONT}
            fill={AXIS_COLOR}
            textAnchor="end"
          >
            {String(tick)}
          </SvgText>
        </G>
      ))}
      {xs.map((x, i) =>
        keep.has(i) ? (
          <G key={`xt${i}`}>
            <Line x1={x} x2={x} y1={plot.bottom} y2={plot.bottom + 6} stroke={AXIS_COLOR} />
            <SvgText x={x} y={plot.bottom + 8 + TICK_FONT} fontSize={TICK_FONT} fill={AXIS_COLOR} textAnchor="middle">
              {String(labels[i] ?? "")}
            </SvgText>
          </G>
        ) : null,
      )}
    </G>
  );
}

/**
 * AreaChart with an Area (gradient fill) and a Line. series: [{key, name, color, kind: "area"|"line",
 * gradient?: [color, startOpacity], strokeWidth}]
 */
export function AreaLineChart({ data, xKey, series, height }) {
  const [width, onLayout] = useWidth();
  const [active, setActive] = useState(null);
  const svgHeight = height - LEGEND_HEIGHT;
  const plot = useMemo(
    () => ({
      left: MARGIN + Y_AXIS_WIDTH,
      right: Math.max(MARGIN + Y_AXIS_WIDTH + 1, width - MARGIN),
      top: MARGIN,
      bottom: svgHeight - MARGIN - X_AXIS_HEIGHT,
    }),
    [width, svgHeight],
  );
  const max = Math.max(0, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const yOf = (v) => plot.bottom - ((Number(v) || 0) / top) * (plot.bottom - plot.top);
  const n = data.length;
  const xs = data.map((_, i) => (n <= 1 ? (plot.left + plot.right) / 2 : plot.left + (i * (plot.right - plot.left)) / (n - 1)));

  const onPress = (e) => {
    if (!n) return;
    const lx = e.nativeEvent.locationX;
    let best = 0;
    xs.forEach((x, i) => {
      if (Math.abs(x - lx) < Math.abs(xs[best] - lx)) best = i;
    });
    setActive((prev) => (prev === best ? null : best));
  };

  return (
    <View style={{ height }} onLayout={onLayout}>
      {width > 0 ? (
        <Pressable onPress={onPress} style={{ height: svgHeight }}>
          <Svg width={width} height={svgHeight}>
            <Defs>
              {series
                .filter((s) => s.gradient)
                .map((s) => (
                  <LinearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="5%" stopColor={s.gradient[0]} stopOpacity={s.gradient[1]} />
                    <Stop offset="95%" stopColor={s.gradient[0]} stopOpacity={0} />
                  </LinearGradient>
                ))}
            </Defs>
            <CartesianFrame plot={plot} ticks={ticks} labels={data.map((d) => d[xKey])} xs={xs} yOf={yOf} />
            {active != null ? (
              <Line x1={xs[active]} x2={xs[active]} y1={plot.top} y2={plot.bottom} stroke="#ccc" />
            ) : null}
            {series.map((s) => {
              const points = data.map((d, i) => ({ x: xs[i], y: yOf(d[s.key]) }));
              const line = monotonePath(points);
              if (s.kind === "area") {
                const area = n ? `${line}L${xs[n - 1]},${plot.bottom}L${xs[0]},${plot.bottom}Z` : "";
                return (
                  <G key={s.key}>
                    <Path d={area} fill={`url(#grad-${s.key})`} fillOpacity={0.6} />
                    <Path d={line} stroke={s.color} strokeWidth={s.strokeWidth || 1} fill="none" />
                  </G>
                );
              }
              return <Path key={s.key} d={line} stroke={s.color} strokeWidth={s.strokeWidth || 1} fill="none" />;
            })}
            {active != null
              ? series.map((s) => (
                  <Circle
                    key={`dot-${s.key}`}
                    cx={xs[active]}
                    cy={yOf(data[active]?.[s.key])}
                    r={4}
                    fill={s.color}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                ))
              : null}
          </Svg>
          {active != null ? (
            <Tooltip
              label={data[active]?.[xKey]}
              rows={series.map((s) => ({ name: s.name, color: s.color, value: data[active]?.[s.key] }))}
              x={xs[active]}
              y={plot.top + 20}
              width={width}
              height={svgHeight}
            />
          ) : null}
        </Pressable>
      ) : null}
      <ChartLegend items={series.map((s) => ({ name: s.name, color: s.color, type: "line" }))} />
    </View>
  );
}

/** BarChart with grouped bars. series: [{key, name, color, radius}] */
export function GroupedBarChart({ data, xKey, series, height }) {
  const [width, onLayout] = useWidth();
  const [active, setActive] = useState(null);
  const svgHeight = height - LEGEND_HEIGHT;
  const plot = {
    left: MARGIN + Y_AXIS_WIDTH,
    right: Math.max(MARGIN + Y_AXIS_WIDTH + 1, width - MARGIN),
    top: MARGIN,
    bottom: svgHeight - MARGIN - X_AXIS_HEIGHT,
  };
  const max = Math.max(0, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const yOf = (v) => plot.bottom - ((Number(v) || 0) / top) * (plot.bottom - plot.top);
  const n = data.length;
  const band = n ? (plot.right - plot.left) / n : 0;
  const xs = data.map((_, i) => plot.left + band * i + band / 2);
  const offset = band * 0.1;
  const barGap = 4;
  const barSize = Math.max(0, (band - 2 * offset - (series.length - 1) * barGap) / series.length);

  const barPath = (x, y, w, h, r) => {
    const rr = Math.max(0, Math.min(r, w / 2, h));
    return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
  };

  const onPress = (e) => {
    if (!n || !band) return;
    const idx = Math.floor((e.nativeEvent.locationX - plot.left) / band);
    if (idx < 0 || idx >= n) return;
    setActive((prev) => (prev === idx ? null : idx));
  };

  return (
    <View style={{ height }} onLayout={onLayout}>
      {width > 0 ? (
        <Pressable onPress={onPress} style={{ height: svgHeight }}>
          <Svg width={width} height={svgHeight}>
            {active != null ? (
              <Rect x={plot.left + band * active} y={plot.top} width={band} height={plot.bottom - plot.top} fill="#ccc" fillOpacity={0.5} />
            ) : null}
            <CartesianFrame plot={plot} ticks={ticks} labels={data.map((d) => d[xKey])} xs={xs} yOf={yOf} />
            {data.map((d, i) =>
              series.map((s, si) => {
                const v = Number(d[s.key]) || 0;
                if (v <= 0) return null;
                const x = plot.left + band * i + offset + si * (barSize + barGap);
                const y = yOf(v);
                return <Path key={`${i}-${s.key}`} d={barPath(x, y, barSize, plot.bottom - y, s.radius ?? 0)} fill={s.color} />;
              }),
            )}
          </Svg>
          {active != null ? (
            <Tooltip
              label={data[active]?.[xKey]}
              rows={series.map((s) => ({ name: s.name, color: s.color, value: data[active]?.[s.key] }))}
              x={xs[active]}
              y={plot.top + 20}
              width={width}
              height={svgHeight}
            />
          ) : null}
        </Pressable>
      ) : null}
      <ChartLegend items={series.map((s) => ({ name: s.name, color: s.color, type: "rect" }))} />
    </View>
  );
}

function sectorPath(cx, cy, inner, outer, startDeg, endDeg) {
  const rad = Math.PI / 180;
  // recharts polarToCartesian: y goes up, so angles turn counter-clockwise on screen.
  const pt = (r, a) => [cx + r * Math.cos(-a * rad), cy + r * Math.sin(-a * rad)];
  const delta = Math.min(359.999, endDeg - startDeg);
  const end = startDeg + delta;
  const large = delta > 180 ? 1 : 0;
  const [ox1, oy1] = pt(outer, startDeg);
  const [ox2, oy2] = pt(outer, end);
  if (inner <= 0) {
    return `M${cx},${cy}L${ox1},${oy1}A${outer},${outer},0,${large},0,${ox2},${oy2}Z`;
  }
  const [ix1, iy1] = pt(inner, end);
  const [ix2, iy2] = pt(inner, startDeg);
  return `M${ox1},${oy1}A${outer},${outer},0,${large},0,${ox2},${oy2}L${ix1},${iy1}A${inner},${inner},0,${large},1,${ix2},${iy2}Z`;
}

/** Pie / donut. data: [{label, value, color}] */
export function PieDonutChart({ data, height, innerRadius = 0, outerRadius, paddingAngle = 0 }) {
  const [width, onLayout] = useWidth();
  const [active, setActive] = useState(null);
  const svgHeight = height - LEGEND_HEIGHT;
  const cx = width / 2;
  const cy = svgHeight / 2;
  const total = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const nonZero = data.filter((d) => Number(d.value) > 0).length;
  const realTotal = 360 - nonZero * paddingAngle;
  const sectors = [];
  let prevEnd = 0;
  data.forEach((d, i) => {
    const v = Number(d.value) || 0;
    const start = i === 0 ? 0 : prevEnd + (v > 0 ? paddingAngle : 0);
    const delta = total > 0 ? (realTotal * v) / total : 0;
    sectors.push({ ...d, start, end: start + delta });
    prevEnd = start + delta;
  });

  const onPress = (e) => {
    const dx = e.nativeEvent.locationX - cx;
    const dy = e.nativeEvent.locationY - cy;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r < innerRadius || r > outerRadius) {
      setActive(null);
      return;
    }
    let a = (Math.atan2(-dy, dx) * 180) / Math.PI;
    if (a < 0) a += 360;
    const idx = sectors.findIndex((s) => a >= s.start && a <= s.end);
    setActive((prev) => (idx < 0 || prev === idx ? null : idx));
  };

  return (
    <View style={{ height }} onLayout={onLayout}>
      {width > 0 ? (
        <Pressable onPress={onPress} style={{ height: svgHeight }}>
          <Svg width={width} height={svgHeight}>
            {sectors.map((s, i) =>
              s.end > s.start ? (
                <Path key={`${s.label}-${i}`} d={sectorPath(cx, cy, innerRadius, outerRadius, s.start, s.end)} fill={s.color} />
              ) : null,
            )}
          </Svg>
          {active != null && sectors[active] ? (
            <Tooltip
              label={null}
              rows={[{ name: sectors[active].label, color: sectors[active].color, value: sectors[active].value }]}
              x={cx}
              y={cy}
              width={width}
              height={svgHeight}
            />
          ) : null}
        </Pressable>
      ) : null}
      <ChartLegend
        items={data.map((d) => ({ name: d.label, color: d.color, type: "rect" }))}
        textStyle={styles.pieLegendText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    minHeight: LEGEND_HEIGHT,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
  legendItem: { flexDirection: "row", alignItems: "center", marginRight: 10 },
  legendText: { marginLeft: 4, fontSize: 14 },
  pieLegendText: { fontSize: 12, color: "#364153" },
  tooltip: { position: "absolute", padding: 10, ...chartTooltipStyle },
  tooltipLabel: { fontSize: 14, color: "#000000", marginBottom: 4 },
  tooltipRow: { fontSize: 14, paddingVertical: 2 },
});
