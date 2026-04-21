import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { KnowledgeNode, KnowledgeLink } from '../lib/db';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MindMapProps {
  nodes: KnowledgeNode[];
  links: KnowledgeLink[];
  onNodeClick: (node: KnowledgeNode) => void;
  highlightedNodes?: string[];
}

export default function MindMap({ nodes, links, onNodeClick, highlightedNodes = [] }: MindMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Initialize collapsed state: collapse all points that have children (Level 2 and below)
  useEffect(() => {
    if (!initialized && nodes.length > 0) {
      const initialCollapsed = new Set<string>();
      const parentIds = new Set(nodes.map(n => n.parentId).filter(Boolean));
      nodes.forEach(n => {
        if (n.type === 'point' && parentIds.has(n.id)) {
          initialCollapsed.add(n.id);
        }
      });
      setCollapsedIds(initialCollapsed);
      setInitialized(true);
    }
  }, [nodes, initialized]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    svg.selectAll('*').remove();

    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const chapters = nodes.filter(n => n.type === 'chapter');
    const points = nodes.filter(n => n.type === 'point' || n.type === 'subpoint');

    const buildTree = (parentId: string): any[] => {
      return points.filter(p => p.parentId === parentId).map(p => {
        const children = buildTree(p.id);
        const hasChildren = children.length > 0;
        const isCollapsed = collapsedIds.has(p.id);
        return {
          ...p,
          hasChildren,
          children: (hasChildren && !isCollapsed) ? children : undefined
        };
      });
    };

    const rootData = {
      id: 'root',
      label: '知识图谱',
      type: 'root',
      hasChildren: chapters.length > 0,
      children: chapters.map(ch => {
        const children = buildTree(ch.id);
        const hasChildren = children.length > 0;
        const isCollapsed = collapsedIds.has(ch.id);
        return {
          ...ch,
          hasChildren,
          children: (hasChildren && !isCollapsed) ? children : undefined
        };
      })
    };

    const root = d3.hierarchy(rootData);
    
    // Calculate layout
    const treeLayout = d3.tree().nodeSize([50, 320]);
    treeLayout(root);

    // Center the tree
    let x0 = Infinity;
    let x1 = -x0;
    root.each(d => {
      if (d.x > x1) x1 = d.x;
      if (d.x < x0) x0 = d.x;
    });

    g.attr('transform', `translate(${width / 4},${height / 2})`);
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 4, height / 2).scale(1));

    // Links
    g.append('g')
      .attr('fill', 'none')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1.5)
      .selectAll('path')
      .data(root.links())
      .join('path')
      .attr('d', d3.linkHorizontal<any, any>()
        .x(d => d.y)
        .y(d => d.x) as any
      );

    // Nodes
    const node = g.append('g')
      .selectAll('g')
      .data(root.descendants())
      .join('g')
      .attr('transform', d => `translate(${d.y},${d.x})`);

    node.append('text')
      .attr('dy', '0.32em')
      .attr('text-anchor', 'middle')
      .attr('class', d => {
        if (d.data.id === 'root') return 'fill-white font-semibold text-sm';
        if (highlightedNodes.includes(d.data.id)) return 'fill-white font-semibold text-xs';
        return d.data.type === 'chapter' ? 'fill-white font-semibold text-xs' : 'fill-emerald-950 dark:fill-emerald-50 font-medium text-xs';
      })
      .text(d => {
        const label = d.data.label || '';
        return label.length > 20 ? label.substring(0, 20) + '...' : label;
      })
      .attr('cursor', d => d.data.id === 'root' ? 'default' : 'pointer')
      .on('click', (event, d) => {
        if (d.data.id !== 'root') {
          onNodeClick(d.data as any);
        }
      });

    node.each(function(d: any) {
      const gNode = d3.select(this);
      const textNode = gNode.select('text').node() as SVGTextElement;
      const bbox = textNode.getBBox();
      const paddingX = 16;
      const paddingY = 10;
      
      gNode.insert('rect', 'text')
        .attr('x', bbox.x - paddingX)
        .attr('y', bbox.y - paddingY)
        .attr('width', bbox.width + paddingX * 2)
        .attr('height', bbox.height + paddingY * 2)
        .attr('rx', 6)
        .attr('ry', 6)
        .attr('class', () => {
          if (d.data.id === 'root') return 'fill-indigo-400 stroke-indigo-500';
          if (highlightedNodes.includes(d.data.id)) return 'fill-amber-400 stroke-amber-500 shadow-amber-500/50';
          return d.data.type === 'chapter' ? 'fill-violet-400 stroke-violet-500' : 'fill-emerald-50 dark:fill-emerald-900/40 stroke-emerald-400 dark:stroke-emerald-500/60';
        })
        .attr('stroke-width', 1.5)
        .attr('cursor', d.data.id === 'root' ? 'default' : 'pointer')
        .on('click', (event) => {
          if (d.data.id !== 'root') {
            onNodeClick(d.data as any);
          }
        });

      // Add collapse/expand toggle if it has children
      if (d.data.hasChildren && d.data.id !== 'root') {
        const isCollapsed = collapsedIds.has(d.data.id);
        const toggleG = gNode.append('g')
          .attr('transform', `translate(${bbox.x + bbox.width + paddingX}, ${bbox.y + bbox.height / 2})`)
          .attr('cursor', 'pointer')
          .on('click', (event) => {
            event.stopPropagation();
            setCollapsedIds(prev => {
              const next = new Set(prev);
              if (next.has(d.data.id)) {
                next.delete(d.data.id);
              } else {
                next.add(d.data.id);
              }
              return next;
            });
          });

        toggleG.append('circle')
          .attr('r', 8)
          .attr('fill', '#fff')
          .attr('stroke', '#94a3b8')
          .attr('stroke-width', 1.5)
          .attr('class', 'hover:stroke-indigo-500 transition-colors');

        toggleG.append('text')
          .attr('dy', '0.32em')
          .attr('text-anchor', 'middle')
          .attr('fill', '#64748b')
          .attr('font-size', '12px')
          .attr('font-weight', 'bold')
          .attr('class', 'select-none')
          .text(isCollapsed ? '+' : '-');
      }
    });

  }, [nodes, links, highlightedNodes, collapsedIds]);

  return (
    <div ref={containerRef} className="w-full h-full bg-transparent overflow-hidden relative text-slate-700 dark:text-slate-300">
      <svg ref={svgRef} className="w-full h-full" />
      <div className="absolute bottom-6 left-6 flex flex-col gap-2 text-xs font-medium text-slate-500 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-4 rounded bg-indigo-400 border border-indigo-500" /> 根节点
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-4 rounded bg-violet-400 border border-violet-500" /> 章节 / 主题
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-4 rounded bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-400 dark:border-emerald-500/60" /> 知识点
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-4 rounded bg-amber-400 border border-amber-500" /> 高亮定位
        </div>
      </div>
    </div>
  );
}
