import React, { useEffect, useRef, useState } from 'react';
import { useFocusReplay } from '../motion/useFocusReplay';
import { Animated, Easing, LayoutChangeEvent, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { C, FONT } from '../../theme';
import { useReduceMotion } from '../motion/useReduceMotion';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface LinePoint {
  label: string;
  value: number;
}

interface Props {
  data: LinePoint[];
  height?: number;
  color?: string;
  format?: (n: number) => string;
}

// Round the axis max up so grid lines land on clean values.
function niceMax(max: number) {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/** Brutalist curved line chart: line draws itself in, area fades up, dots pop in. */
export default function AnimatedLineChart({
  data,
  height = 170,
  color = C.primary,
  format = n => String(n),
}: Props) {
  const [w, setW] = useState(280);
  const reduce = useReduceMotion();
  const replay = useFocusReplay();
  const progress = useRef(new Animated.Value(0)).current;
  const key = data.map(d => d.value).join(',');

  useEffect(() => {
    progress.setValue(reduce ? 1 : 0);
    if (reduce) return;
    Animated.timing(progress, {
      toValue: 1,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [key, reduce, replay, progress]);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.floor(e.nativeEvent.layout.width);
    if (next > 0 && next !== w) setW(next);
  };

  const padL = 34;
  const padR = 14;
  const padT = 16;
  const padB = 24;
  const max = niceMax(Math.max(0, ...data.map(d => d.value)));
  const plotW = w - padL - padR;
  const plotH = height - padT - padB;
  const pts = data.map((d, i) => ({
    x: padL + (data.length === 1 ? plotW / 2 : (plotW * i) / (data.length - 1)),
    y: padT + plotH - (d.value / max) * plotH,
  }));
  // Smooth curve through the points. Monotone tangents keep it from dipping
  // below zero or overshooting a peak between two months.
  const slope = pts
    .slice(1)
    .map((p, i) => (p.y - pts[i].y) / (p.x - pts[i].x || 1));
  const tan = pts.map((_, i) =>
    i === 0
      ? slope[0] || 0
      : i === pts.length - 1
      ? slope[i - 1]
      : slope[i - 1] * slope[i] <= 0
      ? 0
      : (slope[i - 1] + slope[i]) / 2,
  );
  slope.forEach((sl, i) => {
    if (sl === 0) {
      tan[i] = 0;
      tan[i + 1] = 0;
      return;
    }
    const a = tan[i] / sl;
    const b = tan[i + 1] / sl;
    const h = Math.hypot(a, b);
    if (h > 3) {
      tan[i] = (3 / h) * a * sl;
      tan[i + 1] = (3 / h) * b * sl;
    }
  });
  let line = pts.length ? `M${pts[0].x},${pts[0].y}` : '';
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dx = (b.x - a.x) / 3;
    const c1 = { x: a.x + dx, y: a.y + tan[i - 1] * dx };
    const c2 = { x: b.x - dx, y: b.y - tan[i] * dx };
    line += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}`;
    // curve length, sampled, for the draw-in dash animation
    let prev = a;
    for (let k = 1; k <= 12; k++) {
      const t = k / 12;
      const u = 1 - t;
      const q = {
        x:
          u * u * u * a.x +
          3 * u * u * t * c1.x +
          3 * u * t * t * c2.x +
          t * t * t * b.x,
        y:
          u * u * u * a.y +
          3 * u * u * t * c1.y +
          3 * u * t * t * c2.y +
          t * t * t * b.y,
      };
      len += Math.hypot(q.x - prev.x, q.y - prev.y);
      prev = q;
    }
  }
  const area = pts.length
    ? `${line} L${pts[pts.length - 1].x},${padT + plotH} L${pts[0].x},${
        padT + plotH
      } Z`
    : '';
  len = Math.ceil(len) + 2;
  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [len, 0],
  });
  const dotR = progress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0, 0, 5],
  });
  const areaOpacity = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });
  const gid = 'lg' + color.replace('#', '');

  return (
    <View onLayout={onLayout}>
      <Svg width={w} height={height}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.3} />
            <Stop offset="1" stopColor={color} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        {[0, 0.5, 1].map(t => {
          const y = padT + plotH * (1 - t);
          return (
            <React.Fragment key={t}>
              <Line
                x1={padL}
                x2={w - padR}
                y1={y}
                y2={y}
                stroke={C.black}
                strokeOpacity={0.15}
                strokeDasharray="3 3"
              />
              <SvgText
                x={padL - 6}
                y={y + 3}
                fontSize={10}
                fontFamily={FONT.bold}
                fill={C.black}
                textAnchor="end"
              >
                {format(Math.round(max * t))}
              </SvgText>
            </React.Fragment>
          );
        })}
        {area ? (
          <AnimatedPath d={area} fill={`url(#${gid})`} opacity={areaOpacity} />
        ) : null}
        {line ? (
          <AnimatedPath
            d={line}
            stroke={color}
            strokeWidth={3}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={[len, len]}
            strokeDashoffset={dashOffset}
          />
        ) : null}
        {pts.map((p, i) => (
          <React.Fragment key={i}>
            <AnimatedCircle
              cx={p.x}
              cy={p.y}
              r={dotR}
              fill={C.white}
              stroke={C.black}
              strokeWidth={2}
            />
            <SvgText
              x={p.x}
              y={height - 8}
              fontSize={10}
              fontFamily={FONT.bold}
              fill={C.black}
              textAnchor="middle"
            >
              {data[i].label}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}
