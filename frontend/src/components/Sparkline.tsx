import { NivoSparkline } from './charts/NivoSparkline';

/**
 * Sparkline component - minimal line chart for showing trends
 * Thin wrapper over NivoSparkline for backward compatibility.
 */
interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

export function Sparkline({
  data,
  color = 'var(--mantine-color-blue-6)',
  height = 30,
}: SparklineProps) {
  return <NivoSparkline data={data} color={color} height={height} />;
}
