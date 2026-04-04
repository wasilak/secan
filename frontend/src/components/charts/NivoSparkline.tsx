import { ResponsiveLine } from '@nivo/line';

interface NivoSparklineProps {
  data: number[];
  color: string;
  height?: number;
}

export function NivoSparkline({ data, color, height = 30 }: NivoSparklineProps) {
  const lineData = [
    {
      id: 'sparkline',
      data: data.map((v, i) => ({ x: i, y: v })),
    },
  ];

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveLine
        data={lineData}
        enableGridX={false}
        enableGridY={false}
        axisBottom={null}
        axisLeft={null}
        enablePoints={false}
        enableArea={true}
        areaOpacity={0.2}
        colors={[color]}
        isInteractive={true}
        animate={true}
      />
    </div>
  );
}
