import React, { useState } from 'react';
import { KnowledgeNode, KnowledgeLink } from '../lib/db';
import { DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverEvent, DragStartEvent, useDroppable } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Lock, Unlock, ChevronDown, ChevronRight } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function PointNodeDisplay({ node, allNodes, onNodeClick, highlightedNodes, isLocked, activeId, dragOverId }: { node: KnowledgeNode, allNodes: KnowledgeNode[], onNodeClick: (n: KnowledgeNode) => void, highlightedNodes: string[], isLocked: boolean, activeId: string | null, dragOverId: string | null }) {
  const children = allNodes.filter(n => n.parentId === node.id && (n.type === 'point' || n.type === 'subpoint'));
  
  if (children.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <SortableContext items={children.map(c => c.id)} strategy={verticalListSortingStrategy}>
        {children.map(child => {
          const hasGrandChildren = allNodes.some(n => n.parentId === child.id && (n.type === 'point' || n.type === 'subpoint'));
          return (
            <PointNodeItem 
              key={child.id} 
              child={child} 
              allNodes={allNodes} 
              onNodeClick={onNodeClick} 
              highlightedNodes={highlightedNodes} 
              hasGrandChildren={hasGrandChildren}
              isLocked={isLocked}
              activeId={activeId}
              dragOverId={dragOverId}
            />
          );
        })}
      </SortableContext>
    </div>
  );
}

function PointNodeItem({ child, allNodes, onNodeClick, highlightedNodes, hasGrandChildren, isLocked, activeId, dragOverId }: { child: KnowledgeNode, allNodes: KnowledgeNode[], onNodeClick: (n: KnowledgeNode) => void, highlightedNodes: string[], hasGrandChildren: boolean, isLocked: boolean, activeId: string | null, dragOverId: string | null }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: child.id, data: { type: 'subpoint', node: child }, disabled: isLocked });
  const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({ id: `${child.id}-make-child`, data: { type: 'make-child', node: child } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const canDropAsChild = activeId && activeId !== child.id && !isDragging;

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="pl-3 border-l-2 border-slate-200/60 dark:border-slate-700/60"
    >
      {dragOverId === child.id && activeId !== child.id && (
        <div className="h-1 bg-indigo-500 rounded-full my-1 shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse" />
      )}
      <div 
        className={cn(
          "text-xs p-2 bg-white/40 dark:bg-slate-900/40 rounded-lg cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 flex items-center justify-between gap-2 relative",
          highlightedNodes.includes(child.id) && "ring-2 ring-amber-400 bg-amber-50/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.2)]",
          !highlightedNodes.includes(child.id) && "text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400",
          isLocked ? "" : "cursor-grab active:cursor-grabbing"
        )}
        onClick={(e) => {
          if (!isDragging) {
            e.stopPropagation();
            onNodeClick(child);
          }
        }}
      >
        <span className="flex-1 line-clamp-2">{child.label}</span>
        {hasGrandChildren && (
          <button 
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
      </div>
      {hasGrandChildren && isExpanded && (
        <div className="cursor-default">
          <PointNodeDisplay node={child} allNodes={allNodes} onNodeClick={onNodeClick} highlightedNodes={highlightedNodes} isLocked={isLocked} activeId={activeId} dragOverId={dragOverId} />
        </div>
      )}
      {canDropAsChild && (
        <div 
          ref={setDropRef}
          className="h-4 -mb-2 relative z-10"
        >
          {isDropOver && (
            <div className="absolute inset-0 flex items-center pl-4">
              <div className="h-1 w-full bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SortablePoint({ node, allNodes, onClick, onNodeClick, isHighlighted, highlightedNodes, isLocked, activeId, dragOverId }: { key?: string | number, node: KnowledgeNode, allNodes: KnowledgeNode[], onClick: () => void, onNodeClick: (n: KnowledgeNode) => void, isHighlighted: boolean, highlightedNodes: string[], isLocked: boolean, activeId: string | null, dragOverId: string | null }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id, data: { type: 'point', node }, disabled: isLocked });
  const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({ id: `${node.id}-make-child`, data: { type: 'make-child', node } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasChildren = allNodes.some(n => n.parentId === node.id && (n.type === 'point' || n.type === 'subpoint'));
  const canDropAsChild = activeId && activeId !== node.id && !isDragging;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!isDragging) onClick();
      }}
      className="relative mb-3"
    >
      {dragOverId === node.id && activeId !== node.id && (
        <div className="absolute -top-2 left-0 right-0 h-1.5 bg-indigo-500 rounded-full z-10 shadow-[0_0_10px_rgba(99,102,241,0.8)] animate-pulse" />
      )}
      <div
        className={cn(
          "p-4 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-100/50 dark:border-slate-700/50 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:bg-white dark:hover:bg-slate-800 transition-all duration-300 relative",
          isLocked ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
          isHighlighted && "ring-2 ring-amber-400 border-transparent bg-amber-50/30 dark:bg-amber-900/10 shadow-[0_0_20px_rgba(251,191,36,0.15)]"
        )}
      >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-2 flex-1">{node.label}</div>
        {hasChildren && (
          <button 
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div className="cursor-default">
          <PointNodeDisplay node={node} allNodes={allNodes} onNodeClick={onNodeClick} highlightedNodes={highlightedNodes} isLocked={isLocked} activeId={activeId} dragOverId={dragOverId} />
        </div>
      )}
      </div>
      {canDropAsChild && (
        <div 
          ref={setDropRef}
          className="h-6 -mb-3 relative z-10"
        >
          {isDropOver && (
            <div className="absolute inset-0 flex items-center pl-6">
              <div className="h-1.5 w-full bg-indigo-400 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.6)] animate-pulse" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChapterBlock({ chapter, points, allNodes, onNodeClick, highlightedNodes, activeId, dragOverId }: { key?: string | number, chapter: KnowledgeNode, points: KnowledgeNode[], allNodes: KnowledgeNode[], onNodeClick: (n: KnowledgeNode) => void, highlightedNodes: string[], activeId: string | null, dragOverId: string | null }) {
  const [isLocked, setIsLocked] = useState(false);
  const { setNodeRef } = useSortable({ id: chapter.id, data: { type: 'chapter', node: chapter }, disabled: isLocked });

  return (
    <div className="bg-white/80 dark:bg-slate-900/60 p-5 rounded-[24px] border border-slate-100/80 dark:border-slate-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none flex flex-col h-full max-h-[650px] backdrop-blur-sm group relative">
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-50 dark:border-slate-800/60">
        <div 
          className={cn("font-bold text-lg cursor-pointer hover:text-indigo-500 transition-colors", highlightedNodes.includes(chapter.id) && "text-amber-500 dark:text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]")}
          onClick={() => onNodeClick(chapter)}
        >
          {chapter.label}
        </div>
        <button
          onClick={() => setIsLocked(!isLocked)}
          className={cn(
            "p-1.5 rounded-lg transition-all duration-300",
            isLocked 
              ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 opacity-100" 
              : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300 opacity-0 group-hover:opacity-100 focus:opacity-100"
          )}
          title={isLocked ? "解锁以允许拖动" : "锁定以防止意外拖动"}
        >
          {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar" ref={setNodeRef}>
        <SortableContext items={points.map(p => p.id)} strategy={verticalListSortingStrategy}>
          {points.map(point => (
            <SortablePoint key={point.id} node={point} allNodes={allNodes} onClick={() => onNodeClick(point)} onNodeClick={onNodeClick} isHighlighted={highlightedNodes.includes(point.id)} highlightedNodes={highlightedNodes} isLocked={isLocked} activeId={activeId} dragOverId={dragOverId} />
          ))}
        </SortableContext>
        {dragOverId === chapter.id && activeId !== chapter.id && (
          <div className="h-1.5 bg-indigo-500 rounded-full my-2 shadow-[0_0_10px_rgba(99,102,241,0.8)] animate-pulse" />
        )}
        {points.length === 0 && (
          <div className="text-slate-400 text-sm text-center py-6 italic border-2 border-dashed border-slate-200 dark:border-slate-700/50 rounded-2xl">拖拽知识点到这里</div>
        )}
      </div>
    </div>
  );
}

interface KnowledgeBlocksProps {
  nodes: KnowledgeNode[];
  links: KnowledgeLink[];
  onNodesChange: (nodes: KnowledgeNode[]) => void;
  onLinksChange: (links: KnowledgeLink[]) => void;
  onNodeClick: (node: KnowledgeNode) => void;
  highlightedNodes?: string[];
}

export default function KnowledgeBlocks({ nodes, links, onNodesChange, onLinksChange, onNodeClick, highlightedNodes = [] }: KnowledgeBlocksProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const chapters = nodes.filter(n => n.type === 'chapter').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const points = nodes.filter(n => n.type === 'point' || n.type === 'subpoint');

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setDragOverId(event.over?.id as string || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setDragOverId(event.over?.id as string || null);
    // We intentionally do nothing else in onDragOver to prevent layout thrashing and infinite loops.
    // All structural changes (moving between chapters, nesting) are handled in onDragEnd.
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setDragOverId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id as string;

    if (activeId === overId) return;

    if (overId.endsWith('-make-child')) {
      const targetNodeId = overId.replace('-make-child', '');
      const activeNode = nodes.find(n => n.id === activeId);
      const targetNode = nodes.find(n => n.id === targetNodeId);

      if (activeNode && targetNode && activeNode.parentId !== targetNodeId) {
        const targetPoints = points.filter(p => p.parentId === targetNodeId);
        const maxOrder = targetPoints.reduce((max, p) => Math.max(max, p.order ?? 0), -1);

        const newNodes = nodes.map(n => {
          if (n.id === activeId) {
            return { ...n, parentId: targetNodeId, type: 'subpoint' as const, order: maxOrder + 1 };
          }
          return n;
        });
        onNodesChange(newNodes);

        const newLinks = links.map(l => {
          if (l.target === activeId && l.label === 'contains') {
            return { ...l, source: targetNodeId };
          }
          return l;
        });
        onLinksChange(newLinks);
      }
      return;
    }

    const activeNode = nodes.find(n => n.id === activeId);
    const overNode = nodes.find(n => n.id === overId);

    if (!activeNode || !overNode) return;

    const isPointOrSubpoint = (type?: string) => type === 'point' || type === 'subpoint';

    // 1. Moving to a different parent (chapter or point)
    if (activeNode.parentId !== overNode.parentId && isPointOrSubpoint(overNode.type)) {
      const newParentNode = nodes.find(n => n.id === overNode.parentId);
      const newType = newParentNode?.type === 'chapter' ? 'point' : 'subpoint';
      const targetPoints = points.filter(p => p.parentId === overNode.parentId);
      const maxOrder = targetPoints.reduce((max, p) => Math.max(max, p.order ?? 0), -1);
      
      const newNodes = nodes.map(n => {
        if (n.id === activeId) {
          return { ...n, parentId: overNode.parentId, type: newType as any, order: maxOrder + 1 };
        }
        return n;
      });
      onNodesChange(newNodes);
      
      const newLinks = links.map(l => {
        if (l.target === activeId && l.label === 'contains') {
          return { ...l, source: overNode.parentId! };
        }
        return l;
      });
      onLinksChange(newLinks);
      return;
    }

    // 2. Moving to a chapter directly
    if (overNode.type === 'chapter' && activeNode.parentId !== overNode.id) {
      const targetPoints = points.filter(p => p.parentId === overNode.id);
      const maxOrder = targetPoints.reduce((max, p) => Math.max(max, p.order ?? 0), -1);
      
      const newNodes = nodes.map(n => {
        if (n.id === activeId) {
          return { ...n, parentId: overNode.id, type: 'point' as any, order: maxOrder + 1 };
        }
        return n;
      });
      onNodesChange(newNodes);

      const newLinks = links.map(l => {
        if (l.target === activeId && l.label === 'contains') {
          return { ...l, source: overNode.id };
        }
        return l;
      });
      onLinksChange(newLinks);
      return;
    }

    // 3. Reordering within the same parent
    if (isPointOrSubpoint(activeNode.type) && isPointOrSubpoint(overNode.type) && activeNode.parentId === overNode.parentId) {
      const chapterPoints = points.filter(p => p.parentId === activeNode.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const oldIndex = chapterPoints.findIndex(p => p.id === activeId);
      const newIndex = chapterPoints.findIndex(p => p.id === overId);
      
      const newChapterPoints = arrayMove(chapterPoints, oldIndex, newIndex).map((p, index) => ({ ...p, order: index }));
      
      const otherNodes = nodes.filter(n => n.parentId !== activeNode.parentId || !isPointOrSubpoint(n.type));
      onNodesChange([...otherNodes, ...newChapterPoints]);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar p-8 pb-32 bg-transparent relative">
      <div className="max-w-[1400px] mx-auto">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
            {chapters.map(chapter => {
              const chapterPoints = points.filter(p => p.parentId === chapter.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
              return (
                <ChapterBlock 
                  key={chapter.id} 
                  chapter={chapter} 
                  points={chapterPoints} 
                  allNodes={nodes}
                  onNodeClick={onNodeClick}
                  highlightedNodes={highlightedNodes}
                  activeId={activeId}
                  dragOverId={dragOverId}
                />
              );
            })}
          </div>
        </DndContext>
      </div>
    </div>
  );
}
