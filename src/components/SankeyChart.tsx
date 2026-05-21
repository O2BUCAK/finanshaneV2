import React, { useMemo } from 'react';
import { sankey, sankeyLinkHorizontal, sankeyJustify } from 'd3-sankey';

interface SankeyNode {
  id: string;
  name: string;
  value?: number;
  displayValue?: number;
  color?: string;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

interface SankeyChartProps {
  data: {
    nodes: SankeyNode[];
    links: SankeyLink[];
  };
  width?: number;
  height?: number;
  formatCurrency: (val: number) => string;
}

export const SankeyChart: React.FC<SankeyChartProps> = ({ data, width = 900, height = 400, formatCurrency }) => {
  const { nodes, links } = useMemo(() => {
    const sankeyGenerator = sankey<SankeyNode, SankeyLink>()
      .nodeId(d => d.id)
      .nodeWidth(30)
      .nodePadding(35)
      .extent([[180, 70], [width - 180, height - 30]])
      .nodeAlign(sankeyJustify);

    // Deep copy data because d3-sankey mutates it
    const nodesCopy = data.nodes.map(d => ({ ...d }));
    const linksCopy = data.links.map(d => ({ ...d }));

    try {
      return sankeyGenerator({
        nodes: nodesCopy,
        links: linksCopy
      });
    } catch (e) {
      console.error("Sankey generation error:", e);
      return { nodes: [], links: [] };
    }
  }, [data, width, height]);

  if (!nodes.length || !links.length) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Yeterli veri yok</div>;
  }

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        {links.map((link, i) => {
          const sourceColor = (link.source as any).color || '#10b981';
          const targetColor = (link.target as any).color || '#3b82f6';
          const gradientId = `link-gradient-${i}`;
          return (
            <linearGradient key={gradientId} id={gradientId} gradientUnits="userSpaceOnUse" x1={(link.source as any).x1} x2={(link.target as any).x0}>
              <stop offset="0%" stopColor={sourceColor} stopOpacity={0.5} />
              <stop offset="100%" stopColor={targetColor} stopOpacity={0.5} />
            </linearGradient>
          );
        })}
      </defs>

      <g>
        {links.map((link, i) => {
          const path = sankeyLinkHorizontal()(link as any);
          return (
            <path
              key={`link-${i}`}
              d={path || ''}
              stroke={`url(#link-gradient-${i})`}
              strokeWidth={Math.max(1, (link as any).width)}
              fill="none"
              className="hover:stroke-opacity-80 transition-all duration-300 cursor-pointer"
              style={{ strokeOpacity: 0.5 }}
            >
              <title>{`${(link.source as any).name.replace(/\u200B/g, '')} → ${(link.target as any).name.replace(/\u200B/g, '')}\n${formatCurrency(link.value)}`}</title>
            </path>
          );
        })}
      </g>

      <g>
        {nodes.map((node: any, i) => {
          const isTotal = node.id === 'total_income';
          const isLeft = node.x0 < width / 3 && !isTotal;
          const isRight = !isLeft && !isTotal;
          
          let color = node.color || '#3b82f6';
          
          return (
            <g key={`node-${i}`}>
              <rect
                x={node.x0}
                y={node.y0}
                height={Math.max(1, node.y1 - node.y0)}
                width={node.x1 - node.x0}
                fill={color}
                rx={4}
                className="hover:opacity-80 transition-opacity cursor-pointer"
              >
                <title>{`${node.name.replace(/\u200B/g, '')}\n${formatCurrency(node.value)}`}</title>
              </rect>
              
              <foreignObject 
                x={isTotal ? node.x0 - 80 + (node.x1 - node.x0) / 2 : (isLeft ? node.x0 - 175 : node.x1 + 10)} 
                y={isTotal ? node.y0 - 62 : node.y0 + (node.y1 - node.y0) / 2 - 25} 
                width={isTotal ? 160 : 165} 
                height={50}
                className="overflow-visible pointer-events-none"
              >
                <div className={`flex flex-col justify-center h-full ${isTotal ? 'items-center' : (isLeft ? 'items-end' : 'items-start')}`}>
                  <div className={`backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-2 border ${
                    isTotal 
                      ? 'bg-primary/10 border-primary/20 flex-col items-center gap-0.5' 
                      : 'bg-card/90 border-border'
                  }`}>
                    {isLeft && (
                      <>
                        <div className="flex flex-col items-end text-right">
                          <span className="text-xs font-semibold text-muted-foreground truncate max-w-[125px]">
                            {node.name.replace(/\u200B/g, '')}
                          </span>
                          <span className="text-sm font-bold text-foreground">
                            {formatCurrency(node.displayValue !== undefined ? node.displayValue : node.value)}
                          </span>
                        </div>
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      </>
                    )}
                    
                    {isTotal && (
                      <>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">{node.name.replace(/\u200B/g, '')}</span>
                        <span className="text-sm font-black text-foreground">{formatCurrency(node.displayValue !== undefined ? node.displayValue : node.value)}</span>
                      </>
                    )}

                    {isRight && (
                      <>
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <div className="flex flex-col items-start text-left">
                          <span className="text-xs font-semibold text-muted-foreground truncate max-w-[125px]">
                            {node.name.replace(/\u200B/g, '')}
                          </span>
                          <span className="text-sm font-bold text-foreground">
                            {formatCurrency(node.displayValue !== undefined ? node.displayValue : node.value)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </g>
    </svg>
  );
};
