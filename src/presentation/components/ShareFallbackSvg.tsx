import { Fragment } from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

export interface ShareFallbackStat {
  label: string;
  value: string;
}

interface ShareFallbackSvgProps {
  svgRef: any;
  gradient: [string, string, string];
  pill: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  heroValue?: string;
  heroLabel?: string;
  stats: ShareFallbackStat[];
  footer: string;
}

function lines(text: string, max: number, limit: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      out.push(current);
      current = word;
      return;
    }
    current = next;
  });

  if (current) out.push(current);
  return out.slice(0, limit);
}

export function ShareFallbackSvg({
  svgRef,
  gradient,
  pill,
  eyebrow,
  title,
  subtitle,
  heroValue,
  heroLabel,
  stats,
  footer,
}: ShareFallbackSvgProps) {
  const titleLines = lines(title, 23, 2);
  const subtitleLines = lines(subtitle, 40, 3);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: -1400, top: 0, width: 1080, height: 1350 }}>
      <Svg ref={svgRef} width={1080} height={1350} viewBox="0 0 1080 1350">
        <Defs>
          <SvgLinearGradient id="shareBg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradient[0]} />
            <Stop offset="0.52" stopColor={gradient[1]} />
            <Stop offset="1" stopColor={gradient[2]} />
          </SvgLinearGradient>
        </Defs>

        <Rect x="0" y="0" width="1080" height="1350" fill="url(#shareBg)" />
        <Circle cx="948" cy="112" r="230" fill="#FFFFFF" opacity="0.12" />
        <Circle cx="95" cy="1225" r="250" fill="#FFFFFF" opacity="0.08" />

        <Rect x="72" y="72" width="54" height="54" rx="15" fill="#FFFFFF" opacity="0.18" />
        <SvgText x="150" y="112" fill="#FFFFFF" fontSize="36" fontWeight="800">
          Unchainly
        </SvgText>
        <Rect x="740" y="76" width="268" height="48" rx="24" fill="#FFFFFF" opacity="0.16" />
        <SvgText x="874" y="108" fill="#FFFFFF" fontSize="23" fontWeight="700" textAnchor="middle">
          {pill}
        </SvgText>

        <SvgText x="540" y={heroValue ? 342 : 390} fill="#FFFFFF" opacity="0.82" fontSize="28" fontWeight="700" textAnchor="middle">
          {eyebrow.toUpperCase()}
        </SvgText>

        {heroValue ? (
          <>
            <SvgText x="540" y="492" fill="#FFFFFF" fontSize="120" fontWeight="900" textAnchor="middle">
              {heroValue}
            </SvgText>
            {heroLabel ? (
              <SvgText x="540" y="552" fill="#FFFFFF" opacity="0.84" fontSize="34" fontWeight="700" textAnchor="middle">
                {heroLabel}
              </SvgText>
            ) : null}
          </>
        ) : null}

        {titleLines.map((line, index) => (
          <SvgText
            key={line}
            x="540"
            y={(heroValue ? 670 : 510) + index * 58}
            fill="#FFFFFF"
            fontSize="50"
            fontWeight="900"
            textAnchor="middle"
          >
            {line}
          </SvgText>
        ))}

        {subtitleLines.map((line, index) => (
          <SvgText
            key={line}
            x="540"
            y={(heroValue ? 805 : 660) + index * 39}
            fill="#FFFFFF"
            opacity="0.82"
            fontSize="29"
            fontWeight="600"
            textAnchor="middle"
          >
            {line}
          </SvgText>
        ))}

        <Rect x="72" y="1035" width="936" height="152" rx="34" fill="#FFFFFF" opacity="0.13" />
        {stats.slice(0, 3).map((stat, index) => {
          const x = 160 + index * 380;
          const anchor = index === 0 ? 'start' : index === 1 ? 'middle' : 'end';
          return (
            <Fragment key={stat.label}>
              <SvgText x={x} y="1112" fill="#FFFFFF" fontSize="38" fontWeight="800" textAnchor={anchor}>
                {stat.value}
              </SvgText>
              <SvgText x={x} y="1158" fill="#FFFFFF" opacity="0.75" fontSize="24" textAnchor={anchor}>
                {stat.label}
              </SvgText>
            </Fragment>
          );
        })}

        <SvgText x="540" y="1262" fill="#FFFFFF" opacity="0.72" fontSize="25" textAnchor="middle">
          {footer}
        </SvgText>
      </Svg>
    </View>
  );
}
