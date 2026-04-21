import { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  FileText, 
  BookOpen, 
  Search, 
  Trash2, 
  Download, 
  Upload, 
  ChevronRight, 
  ChevronDown, 
  Settings, 
  Send,
  X,
  Edit2,
  Save,
  Moon,
  Sun,
  LayoutGrid,
  Network,
  ArrowLeft,
  ImagePlus,
  Sparkles,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  KnowledgeNode, 
  KnowledgeLink, 
  DocumentRecord,
  Course,
  Note,
  saveGraph, 
  loadGraph, 
  saveDocument, 
  loadDocuments, 
  deleteDocument,
  saveCourse,
  loadCourses,
  deleteCourse
} from './lib/db';
import { analyzeContent, askQuestion, generateCourseFramework, analyzeMaterialForNode, generateFrameworkFromOutline, parseMaterialToMarkdown } from './lib/gemini';
import { extractTextFromFile } from './lib/fileParser';
import KnowledgeBlocks from './components/KnowledgeBlocks';
import MindMap from './components/MindMap';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { onUserChange } from './lib/auth-state';
import { loginWithGoogle, logout } from './lib/firebase';
import { User } from 'firebase/auth';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const preprocessLaTeX = (text: string) => {
  if (!text) return text;
  // Fix KaTeX unsupported array column alignment like @{\quad} or @ {\quad}
  return text.replace(/\\begin\{array\}\{((?:[^{}]|\{[^{}]*\})*)\}/g, (match, p1) => {
    return '\\begin{array}{' + p1.replace(/@\s*\{[^{}]*\}/g, '') + '}';
  });
};

const NodeTreeSelector = ({ nodes, selectedId, onSelect }: { nodes: KnowledgeNode[], selectedId: string, onSelect: (id: string) => void }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  
  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rootNodes = nodes.filter(n => !n.parentId || !nodes.some(p => p.id === n.parentId));
  const getChildren = (parentId: string) => nodes.filter(n => n.parentId === parentId);

  const renderNode = (node: KnowledgeNode, level: number) => {
    const children = getChildren(node.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedId === node.id;

    return (
      <div key={node.id} className="flex flex-col">
        <div 
          className={cn(
            "flex items-center py-1.5 px-2 rounded-lg cursor-pointer transition-colors mb-0.5",
            isSelected 
              ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium" 
              : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
          )}
          style={{ paddingLeft: `${level * 1.2 + 0.5}rem` }}
          onClick={() => onSelect(isSelected ? '' : node.id)}
        >
          <div 
            className="w-5 h-5 flex items-center justify-center mr-1.5 shrink-0 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            onClick={(e) => {
              if (hasChildren) {
                toggleExpand(node.id, e);
              }
            }}
          >
            {hasChildren ? (
              <ChevronRight className={cn("w-4 h-4 transition-transform text-slate-400 dark:text-slate-500", isExpanded && "rotate-90")} />
            ) : (
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
            )}
          </div>
          <span className="truncate text-sm">{node.label}</span>
        </div>
        {isExpanded && hasChildren && (
          <div className="flex flex-col">
            {children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (nodes.length === 0) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-4 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
        暂无知识点
      </div>
    );
  }

  return (
    <div className="flex flex-col max-h-36 overflow-y-auto pr-1 custom-scrollbar border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 bg-slate-50/50 dark:bg-slate-800/50">
      {rootNodes.map(node => renderNode(node, 0))}
    </div>
  );
};

const SortableChapterItem = ({ chapter, selectedNode, setSelectedNode, setEditNode, setIsEditing, handleDeleteNode }: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: chapter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="group flex items-center justify-between rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all duration-200">
      <div className="flex items-center flex-1 min-w-0">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-2 pr-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
        </div>
        <button 
          onClick={() => setSelectedNode(chapter)}
          className={cn("flex-1 flex items-center gap-1.5 py-2 pr-2 pl-1 text-sm text-left truncate", selectedNode?.id === chapter.id ? "text-indigo-600 dark:text-indigo-400 font-medium" : "text-slate-600 dark:text-slate-400")}
        >
          <ChevronRight className={cn("w-4 h-4 shrink-0 transition-transform", selectedNode?.id === chapter.id && "rotate-90")} />
          <span className="truncate">{chapter.label}</span>
        </button>
      </div>
      <div className="flex items-center gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setEditNode(chapter);
            setIsEditing(true);
          }}
          className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
          title="编辑章节"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteNode(chapter.id);
          }}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
          title="删除章节"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [editingCourseName, setEditingCourseName] = useState('');
  const [editingCourseSyllabus, setEditingCourseSyllabus] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseSyllabus, setNewCourseSyllabus] = useState('');

  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [links, setLinks] = useState<KnowledgeLink[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [previewNode, setPreviewNode] = useState<KnowledgeNode | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [question, setQuestion] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [referencedNote, setReferencedNote] = useState<{nodeId: string, noteId: string, content: string} | null>(null);
  const [answer, setAnswer] = useState<{ history: { role: 'user' | 'model', text: string }[]; relevantNodes: string[] } | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [isFollowingUp, setIsFollowingUp] = useState(false);
  const [isAddAnswerModalOpen, setIsAddAnswerModalOpen] = useState(false);
  const [answerTextToSave, setAnswerTextToSave] = useState('');
  const [answerNoteTitle, setAnswerNoteTitle] = useState('');
  const [selectionRect, setSelectionRect] = useState<{ top: number, left: number } | null>(null);

  const getCleanSelectionText = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return '';
    
    const container = document.createElement('div');
    for (let i = 0; i < selection.rangeCount; i++) {
      container.appendChild(selection.getRangeAt(i).cloneContents());
    }
    
    // Replace katex elements with their TeX source
    const katexElements = container.querySelectorAll('.katex');
    katexElements.forEach(el => {
      const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
      if (annotation && annotation.textContent) {
        const isBlock = el.closest('.katex-display') !== null;
        const tex = annotation.textContent;
        const textNode = document.createTextNode(isBlock ? `\n$$\n${tex}\n$$\n` : `$${tex}$`);
        el.parentNode?.replaceChild(textNode, el);
      } else {
        // Fallback: remove mathml to avoid duplication
        const mathml = el.querySelector('.katex-mathml');
        if (mathml) mathml.remove();
      }
    });
    
    return container.textContent || '';
  };

  const [addAnswerTargetNodeId, setAddAnswerTargetNodeId] = useState('');
  const [newAnswerNodeLabel, setNewAnswerNodeLabel] = useState('');
  const [newAnswerParentId, setNewAnswerParentId] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editNode, setEditNode] = useState<KnowledgeNode | null>(null);
  const [viewMode, setViewMode] = useState<'blocks' | 'mindmap'>('blocks');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteTitle, setEditingNoteTitle] = useState('');
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newExampleQ, setNewExampleQ] = useState('');
  const [newExampleA, setNewExampleA] = useState('');
  const [newSubpoint, setNewSubpoint] = useState('');
  const [isExpandingChapter, setIsExpandingChapter] = useState(false);
  const [chapterOutline, setChapterOutline] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setLoginError(null);
      await loginWithGoogle();
    } catch (e: any) {
      if (e.code === 'auth/popup-blocked') {
        setLoginError('弹出窗口被拦截，请尝试在新标签页中打开应用，或在浏览器设置中允许此网站的弹出窗口。');
      } else if (e.code === 'auth/cancelled-popup-request' || e.code === 'auth/popup-closed-by-user') {
        setLoginError('登录请求已取消。');
      } else {
        setLoginError('登录出现错误，请重试。' + (e.message || ''));
      }
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onUserChange((newUser) => {
      setUser(newUser);
      if (!newUser) {
        setIsLoaded(false);
        setCourses([]);
        setNodes([]);
        setLinks([]);
        setDocuments([]);
      } else {
        init();
      }
    });
  }, []);

  const init = async () => {
    setIsLoaded(false);
    const loadedCourses = await loadCourses();
    setCourses(loadedCourses);
      
      let initialCourseId = null;
      if (loadedCourses.length > 0) {
        initialCourseId = loadedCourses[0].id;
      } else {
        // Create a default course if none exists
        const defaultCourse = { id: 'default', name: '默认课程', createdAt: Date.now() };
        await saveCourse(defaultCourse);
        setCourses([defaultCourse]);
        initialCourseId = 'default';
      }
      setActiveCourseId(initialCourseId);

      const graph = await loadGraph();
      const docs = await loadDocuments();
      
      // Migrate old data to default course if needed
      let migrated = false;
      const migratedNodes = graph.nodes.map(n => {
        if (!n.courseId) { migrated = true; return { ...n, courseId: 'default' }; }
        return n;
      });
      const migratedLinks = graph.links.map(l => {
        if (!l.courseId) { migrated = true; return { ...l, courseId: 'default' }; }
        return l;
      });
      const migratedDocs = docs.map(d => {
        if (!d.courseId) { migrated = true; return { ...d, courseId: 'default' }; }
        return d;
      });

      setNodes(migratedNodes);
      setLinks(migratedLinks);
      setDocuments(migratedDocs);
      
      if (migrated) {
        saveGraph(migratedNodes, migratedLinks);
        migratedDocs.forEach(d => saveDocument(d));
      }
      
      setIsLoaded(true);
  };

  useEffect(() => {
    // Only save graph after initial load is complete
    if (isLoaded) {
      saveGraph(nodes, links);
    }
  }, [nodes, links, isLoaded]);

  useEffect(() => {
    const handleMouseDown = () => {
      setSelectionRect(null);
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const handleSyllabusFileUpload = async (e: any, isEditing: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await extractTextFromFile(file);
      if (isEditing) {
        setEditingCourseSyllabus(prev => prev ? `${prev}\n\n${text}` : text);
      } else {
        setNewCourseSyllabus(prev => prev ? `${prev}\n\n${text}` : text);
      }
    } catch (error) {
      console.error("Error extracting text:", error);
    }
    e.target.value = ''; // Reset input
  };

  const handleCreateCourse = async () => {
    if (!newCourseName.trim()) return;
    setIsAnalyzing(true);
    try {
      const newCourse: Course = {
        id: Math.random().toString(36).substr(2, 9),
        name: newCourseName,
        createdAt: Date.now()
      };
      await saveCourse(newCourse);
      setCourses(prev => [...prev, newCourse]);
      setActiveCourseId(newCourse.id);
      
      if (newCourseSyllabus.trim()) {
        const framework = await generateCourseFramework(newCourseSyllabus);
        const newNodes: KnowledgeNode[] = [];
        const newLinks: KnowledgeLink[] = [];
        
        let parsedFramework = framework;
        if (!Array.isArray(framework) && framework && typeof framework === 'object') {
          // Sometimes AI returns an object with a property containing the array
          const possibleArray = Object.values(framework).find(val => Array.isArray(val));
          if (possibleArray) {
            parsedFramework = possibleArray;
          }
        }

        if (Array.isArray(parsedFramework)) {
          parsedFramework.forEach((chapter: any, cIdx: number) => {
            const chapterId = `c_${Math.random().toString(36).substr(2, 9)}`;
            newNodes.push({
              id: chapterId,
              label: chapter.title || chapter.label || chapter.name || `Chapter ${cIdx + 1}`,
              content: chapter.description || chapter.content || `Chapter ${cIdx + 1}: ${chapter.title || ''}`,
              type: 'chapter',
              source: 'Manual Input',
              courseId: newCourse.id
            });
            
            if (Array.isArray(chapter.points)) {
              chapter.points.forEach((point: any) => {
                const pointId = `p_${Math.random().toString(36).substr(2, 9)}`;
                newNodes.push({
                  id: pointId,
                  label: point.label || point.title || point.name || 'Untitled Point',
                  content: point.content || point.description || '',
                  examples: formatExampleContent(point.examples),
                  type: 'point',
                  source: 'Manual Input',
                  courseId: newCourse.id,
                  parentId: chapterId
                });
                newLinks.push({
                  source: chapterId,
                  target: pointId,
                  label: 'contains',
                  courseId: newCourse.id
                });
                
                if (Array.isArray(point.relationships)) {
                  point.relationships.forEach((rel: any) => {
                    const targetNode = newNodes.find(n => n.label === rel.target);
                    if (targetNode) {
                      newLinks.push({
                        source: pointId,
                        target: targetNode.id,
                        label: rel.type || 'related',
                        courseId: newCourse.id
                      });
                    }
                  });
                }
              });
            }
          });
        }
        
        setNodes(prev => [...prev, ...newNodes]);
        setLinks(prev => [...prev, ...newLinks]);
      }
      
      setIsCreatingCourse(false);
      setNewCourseName('');
      setNewCourseSyllabus('');
    } catch (error) {
      console.error("Error creating course:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleEditCourse = async () => {
    if (!editingCourseName.trim() || !activeCourseId) return;
    setIsAnalyzing(true);
    try {
      const course = courses.find(c => c.id === activeCourseId);
      if (course) {
        const updatedCourse = { ...course, name: editingCourseName };
        await saveCourse(updatedCourse);
        setCourses(prev => prev.map(c => c.id === activeCourseId ? updatedCourse : c));
      }

      if (editingCourseSyllabus.trim()) {
        const framework = await generateCourseFramework(editingCourseSyllabus);
        const newNodes: KnowledgeNode[] = [];
        const newLinks: KnowledgeLink[] = [];
        
        let parsedFramework = framework;
        if (!Array.isArray(framework) && framework && typeof framework === 'object') {
          const possibleArray = Object.values(framework).find(val => Array.isArray(val));
          if (possibleArray) {
            parsedFramework = possibleArray;
          }
        }

        if (Array.isArray(parsedFramework)) {
          parsedFramework.forEach((chapter: any, cIdx: number) => {
            const chapterId = `c_${Math.random().toString(36).substr(2, 9)}`;
            newNodes.push({
              id: chapterId,
              label: chapter.title || chapter.label || chapter.name || `Chapter ${cIdx + 1}`,
              content: chapter.description || chapter.content || `Chapter ${cIdx + 1}: ${chapter.title || ''}`,
              type: 'chapter',
              source: 'Manual Input',
              courseId: activeCourseId
            });
            
            if (Array.isArray(chapter.points)) {
              chapter.points.forEach((point: any) => {
                const pointId = `p_${Math.random().toString(36).substr(2, 9)}`;
                newNodes.push({
                  id: pointId,
                  label: point.label || point.title || point.name || 'Untitled Point',
                  content: point.content || point.description || '',
                  type: 'point',
                  source: 'Manual Input',
                  courseId: activeCourseId,
                  parentId: chapterId
                });
                newLinks.push({
                  source: chapterId,
                  target: pointId,
                  label: 'contains',
                  courseId: activeCourseId
                });
                
                if (Array.isArray(point.relationships)) {
                  point.relationships.forEach((rel: any) => {
                    const targetNode = newNodes.find(n => n.label === rel.target);
                    if (targetNode) {
                      newLinks.push({
                        source: pointId,
                        target: targetNode.id,
                        label: rel.type || 'related',
                        courseId: activeCourseId
                      });
                    }
                  });
                }
              });
            }
          });
        }

        setNodes(prev => [...prev, ...newNodes]);
        setLinks(prev => [...prev, ...newLinks]);
      }

      setIsEditingCourse(false);
      setEditingCourseSyllabus('');
    } catch (error) {
      console.error("Error updating course:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteCourse = async (id: string) => {
    try {
      await deleteCourse(id);
      setCourses(prev => prev.filter(c => c.id !== id));
      
      // Clean up nodes, links, and docs
      setNodes(prev => prev.filter(n => n.courseId !== id));
      setLinks(prev => prev.filter(l => l.courseId !== id));
      setDocuments(prev => prev.filter(d => d.courseId !== id));
      
      if (activeCourseId === id) {
        const remainingCourses = courses.filter(c => c.id !== id);
        setActiveCourseId(remainingCourses.length > 0 ? remainingCourses[0].id : null);
        setSelectedNode(null);
      }
      setCourseToDelete(null);
    } catch (error) {
      console.error("Error deleting course:", error);
    }
  };

  const activeNodes = nodes
    .filter(n => n.courseId === activeCourseId || (!n.courseId && !activeCourseId))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const activeLinks = links.filter(l => l.courseId === activeCourseId || (!l.courseId && !activeCourseId));
  const activeDocs = documents.filter(d => d.courseId === activeCourseId || (!d.courseId && !activeCourseId));

  const formatNoteContent = (content: string, title?: string) => {
    if (!content) return content;
    let formatted = content.trim();
    
    if (title) {
      if (formatted.startsWith(title)) {
        formatted = formatted.substring(title.length).trim();
      } else {
        // Try to remove the title even if there are leading numbers in the content but not in the title
        // Or if the title has leading numbers but the content doesn't
        let cleanTitle = title.replace(/^(?:\d+[\.\u3001、\)]|(?:\(|（)\d+(?:\)|）)|(?:\(|（)[一二三四五六七八九十]+(?:\)|）)|[一二三四五六七八九十]+[\.\u3001、\)])\s*/, '').trim();
        if (cleanTitle) {
          const escapedTitle = cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const titleRegex = new RegExp(`^(?:\\d+[\\.\\u3001、\\)]|(?:\\(|（)\\d+(?:\\)|）)|(?:\\(|（)[一二三四五六七八九十]+(?:\\)|）)|[一二三四五六七八九十]+[\\.\\u3001、\\)])?\\s*${escapedTitle}\\s*`);
          formatted = formatted.replace(titleRegex, '');
        }
      }
    }

    // Strip any remaining leading colons (often left over after title removal)
    formatted = formatted.replace(/^[:：]\s*/, '');

    // Replace [SPLIT] delimiter with double newlines for paragraph breaks
    formatted = formatted.replace(/\[SPLIT\]/g, '\n\n');
    
    // Also handle literal \n\n if the AI outputs them as text
    formatted = formatted.replace(/\\n\\n/g, '\n\n');

    return formatted || content;
  };

  const formatExampleContent = (examples: any[]) => {
    if (!examples || !Array.isArray(examples)) return [];
    return examples.map(ex => {
      let q = ex.question || '';
      let a = ex.answer || '';
      
      if (typeof q === 'string') {
        q = q.replace(/\[SPLIT\]/g, '\n\n').replace(/\\n\\n/g, '\n\n');
      }
      if (typeof a === 'string') {
        a = a.replace(/\[SPLIT\]/g, '\n\n').replace(/\\n\\n/g, '\n\n');
      }
      
      return { ...ex, question: q, answer: a };
    });
  };

  const handleFileUpload = async (e: any) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsAnalyzing(true);
    try {
      for (const file of Array.from(files) as File[]) {
        const text = await extractTextFromFile(file);
        
        // Build existing framework string
        const existingChapters = nodes.filter(n => n.type === 'chapter' && (n.courseId === activeCourseId || (!n.courseId && !activeCourseId)));
        let existingFrameworkStr = '';
        if (existingChapters.length > 0) {
          existingFrameworkStr = existingChapters.map(ch => {
            const points = nodes.filter(n => n.parentId === ch.id);
            return `- Chapter: ${ch.label}\n` + points.map(p => `  - Point: ${p.label}`).join('\n');
          }).join('\n');
        }

        // Run Markdown parsing and Content Analysis in parallel
        const [markdownText, analysis] = await Promise.all([
          parseMaterialToMarkdown(text),
          analyzeContent(text, existingFrameworkStr || undefined)
        ]);
        
        const doc: DocumentRecord = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name.replace(/\.[^/.]+$/, "") + ".md",
          type: "text/markdown",
          content: markdownText,
          uploadDate: Date.now(),
          courseId: activeCourseId || undefined
        };
        await saveDocument(doc);
        setDocuments(prev => [...prev, doc]);

        const newNodes: KnowledgeNode[] = [];
        const newLinks: KnowledgeLink[] = [];

        let parsedAnalysis = analysis;
        if (!Array.isArray(analysis) && analysis && typeof analysis === 'object') {
          const possibleArray = Object.values(analysis).find(val => Array.isArray(val));
          if (possibleArray) {
            parsedAnalysis = possibleArray;
          }
        }

        if (Array.isArray(parsedAnalysis)) {
          parsedAnalysis.forEach((chapter: any) => {
            const chapterId = `ch-${Math.random().toString(36).substr(2, 5)}`;
            newNodes.push({
              id: chapterId,
              label: chapter.title || chapter.label || chapter.name || 'Untitled Chapter',
              type: 'chapter',
              content: chapter.description || chapter.content || `Chapter: ${chapter.title || ''}`,
              source: file.name
            });

            if (Array.isArray(chapter.points)) {
              chapter.points.forEach((point: any) => {
                const pointId = `pt-${Math.random().toString(36).substr(2, 5)}`;
                newNodes.push({
                  id: pointId,
                  label: point.label || point.title || point.name || 'Untitled Point',
                  type: 'point',
                  content: formatNoteContent(point.content || point.description || '', point.label || point.title || point.name),
                  examples: formatExampleContent(point.examples),
                  source: file.name,
                  parentId: chapterId
                });

                newLinks.push({
                  source: chapterId,
                  target: pointId,
                  label: 'contains'
                });

                if (Array.isArray(point.relationships)) {
                  point.relationships.forEach((rel: any) => {
                    // We'll try to find existing nodes with similar labels later or just create placeholders
                    // For now, we only link within the current batch for simplicity
                  });
                }
              });
            }
          });
        }

        // Semantic merging logic
        let finalIdMapping: Record<string, string> = {};
        setNodes(prev => {
          const merged = [...prev];
          const idMapping: Record<string, string> = {}; // Maps new ID to existing ID if merged

          newNodes.forEach(newNode => {
            // Find existing node with same label and type
            // For points, ideally we should also check if they belong to the same chapter, 
            // but since we might not know the parent's existing ID yet if it was just mapped,
            // we'll rely on label uniqueness within the course for simplicity, or check mapped parent.
            const mappedParentId = newNode.parentId ? (idMapping[newNode.parentId] || newNode.parentId) : undefined;
            
            const existingIndex = merged.findIndex(n => 
              n.label.toLowerCase() === newNode.label.toLowerCase() && 
              n.type === newNode.type &&
              (n.courseId === activeCourseId || (!n.courseId && !activeCourseId)) &&
              (newNode.type === 'chapter' || n.parentId === mappedParentId)
            );

            if (existingIndex !== -1) {
              const existing = merged[existingIndex];
              idMapping[newNode.id] = existing.id; // Record mapping

              const newNotes: Note[] = (newNode.notes || []).map(n => ({
                id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                title: n.title,
                content: formatNoteContent(n.content, n.title),
                source: newNode.source,
                createdAt: Date.now()
              }));
              if (newNotes.length === 0) {
                newNotes.push({
                  id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  content: formatNoteContent(newNode.content, newNode.label),
                  source: newNode.source,
                  createdAt: Date.now()
                });
              }
              merged[existingIndex] = {
                ...existing,
                notes: [...(existing.notes || []), ...newNotes],
                examples: [...(existing.examples || []), ...formatExampleContent(newNode.examples || [])]
              };
            } else {
              const newNotes: Note[] = (newNode.notes || []).map(n => ({
                id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                title: n.title,
                content: formatNoteContent(n.content, n.title),
                source: newNode.source,
                createdAt: Date.now()
              }));
              if (newNotes.length === 0) {
                newNotes.push({
                  id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  content: formatNoteContent(newNode.content, newNode.label),
                  source: newNode.source,
                  createdAt: Date.now()
                });
              }
              merged.push({
                ...newNode,
                parentId: mappedParentId, // Use mapped parent ID
                notes: newNotes,
                examples: formatExampleContent(newNode.examples),
                courseId: activeCourseId || undefined
              });
            }
          });
          finalIdMapping = idMapping;
          return merged;
        });

        setLinks(prev => {
          const mergedLinks = [...prev];
          newLinks.forEach(link => {
            const sourceId = finalIdMapping[link.source] || link.source;
            const targetId = finalIdMapping[link.target] || link.target;
            
            // Check if link already exists
            const exists = mergedLinks.some(l => l.source === sourceId && l.target === targetId);
            if (!exists) {
              mergedLinks.push({
                source: sourceId,
                target: targetId,
                label: link.label,
                courseId: activeCourseId || undefined
              });
            }
          });
          return mergedLinks;
        });
      }
    } catch (error) {
      console.error(error);
      console.error("Analysis failed. Please check your API key.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNodeFileUpload = async (e: any, targetNode: KnowledgeNode) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsAnalyzing(true);
    try {
      for (const file of Array.from(files) as File[]) {
        const text = await extractTextFromFile(file);
        
        const existingChildren = nodes.filter(n => n.parentId === targetNode.id);
        const existingFrameworkStr = existingChildren.length > 0 
          ? existingChildren.map(n => `- ${n.label}: ${n.content || ''}`).join('\n')
          : undefined;

        // Run Markdown parsing and Content Analysis in parallel
        const [markdownText, extractedPoints] = await Promise.all([
          parseMaterialToMarkdown(text),
          analyzeMaterialForNode(text, targetNode.type as 'chapter' | 'point', targetNode.label, existingFrameworkStr)
        ]);
        
        const doc: DocumentRecord = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name.replace(/\.[^/.]+$/, "") + ".md",
          type: "text/markdown",
          content: markdownText,
          uploadDate: Date.now(),
          courseId: activeCourseId || undefined
        };
        await saveDocument(doc);
        setDocuments(prev => [...prev, doc]);
        
        const newLinks: KnowledgeLink[] = [];
        
        setNodes(prev => {
          const merged = [...prev];
          newLinks.length = 0; // Clear to prevent double-population in Strict Mode
          
          let pointsToProcess = extractedPoints;
          
          if (extractedPoints.length > 0) {
            const firstPoint = extractedPoints[0];
            let isMainPoint = false;
            
            if (targetNode.type === 'chapter') {
              isMainPoint = firstPoint.label.includes('章') || 
                            firstPoint.label.toLowerCase().includes('chapter') ||
                            firstPoint.label.toLowerCase().includes(targetNode.label.toLowerCase()) ||
                            targetNode.label.toLowerCase().includes(firstPoint.label.toLowerCase());
                            
              if (!isMainPoint && extractedPoints.length === 1 && firstPoint.subPoints && firstPoint.subPoints.length > 0) {
                isMainPoint = true;
              }
            } else {
              isMainPoint = extractedPoints.length === 1 || 
                            firstPoint.label.toLowerCase().includes(targetNode.label.toLowerCase()) ||
                            targetNode.label.toLowerCase().includes(firstPoint.label.toLowerCase());
            }

            if (isMainPoint) {
              const targetIndex = merged.findIndex(n => n.id === targetNode.id);
              if (targetIndex !== -1) {
                const newNotes: Note[] = (firstPoint.notes || []).map((n: any) => ({
                  id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  title: n.title,
                  content: formatNoteContent(n.content, n.title),
                  source: file.name,
                  createdAt: Date.now()
                }));
                
                if (newNotes.length === 0 && firstPoint.content) {
                  newNotes.push({
                    id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    content: formatNoteContent(firstPoint.content, firstPoint.label),
                    source: file.name,
                    createdAt: Date.now()
                  });
                }
                
                const newExamples = formatExampleContent(firstPoint.examples || []);
                
                merged[targetIndex] = {
                  ...merged[targetIndex],
                  label: targetNode.type === 'chapter' ? firstPoint.label : (firstPoint.label.length > merged[targetIndex].label.length ? firstPoint.label : merged[targetIndex].label),
                  notes: [...(merged[targetIndex].notes || []), ...newNotes],
                  examples: [...(merged[targetIndex].examples || []), ...newExamples]
                };
              }
              
              pointsToProcess = [
                ...(firstPoint.subPoints || []),
                ...extractedPoints.slice(1)
              ];
            }
          }

          const processExtractedPoint = (point: any, parentId: string) => {
            const newNotes: Note[] = (point.notes || []).map((n: any) => ({
              id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              title: n.title,
              content: formatNoteContent(n.content, n.title),
              source: file.name,
              createdAt: Date.now()
            }));

            if (newNotes.length === 0) {
              newNotes.push({
                id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                content: formatNoteContent(point.content, point.label),
                source: file.name,
                createdAt: Date.now()
              });
            }
            
            const newExamples = formatExampleContent(point.examples || []);

            let currentPointId = '';

            // Check if point exists under this parent
            const existingIndex = merged.findIndex(n => n.parentId === parentId && n.label.toLowerCase() === point.label.toLowerCase());
            if (existingIndex !== -1) {
              // Add note to existing point
              const existingPoint = merged[existingIndex];
              merged[existingIndex] = {
                ...existingPoint,
                notes: [...(existingPoint.notes || []), ...newNotes],
                examples: [...(existingPoint.examples || []), ...newExamples]
              };
              currentPointId = existingPoint.id;
            } else {
              // Create new point
              currentPointId = `pt-${Math.random().toString(36).substr(2, 5)}`;
              merged.push({
                id: currentPointId,
                label: point.label,
                type: 'point',
                content: point.content,
                source: file.name,
                parentId: parentId,
                notes: newNotes,
                examples: newExamples,
                courseId: activeCourseId || undefined
              });
              newLinks.push({
                source: parentId,
                target: currentPointId,
                label: 'contains',
                courseId: activeCourseId || undefined
              });
            }

            if (point.subPoints && point.subPoints.length > 0 && currentPointId) {
              point.subPoints.forEach((subPoint: any) => {
                processExtractedPoint(subPoint, currentPointId);
              });
            }
          };

          pointsToProcess.forEach(point => {
            processExtractedPoint(point, targetNode.id);
          });
          
          const updatedTarget = merged.find(n => n.id === targetNode.id);
          if (updatedTarget) {
            setTimeout(() => setSelectedNode(updatedTarget), 0);
          }
          
          return merged;
        });

        if (newLinks.length > 0) {
          setLinks(prevLinks => {
            const existing = new Set(prevLinks.map(l => `${l.source}-${l.target}-${l.label}`));
            const toAdd = newLinks.filter(l => !existing.has(`${l.source}-${l.target}-${l.label}`));
            return [...prevLinks, ...toAdd];
          });
        }
      }
    } catch (error) {
      console.error(error);
      console.error("Material analysis failed. Please check your API key.");
    } finally {
      setIsAnalyzing(false);
    }
  };


  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setUploadedImage(event.target?.result as string);
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  const handleAsk = async () => {
    if (!question.trim() && !referencedNote && !uploadedImage) return;
    setIsAnswering(true);
    try {
      const context = nodes.map(n => {
        let text = `ID: ${n.id} | Label: ${n.label} | Content: ${n.content}`;
        if (n.notes && n.notes.length > 0) {
          text += `\n  相关笔记:\n` + n.notes.map(note => `  - ${note.title ? note.title + ': ' : ''}${note.content}`).join('\n');
        }
        return text;
      }).join('\n\n');
      
      const finalQuestion = referencedNote 
        ? (question.trim() ? `关于以下笔记内容：\n"${referencedNote.content}"\n\n我的问题是：${question}` : `请解释以下笔记内容：\n"${referencedNote.content}"`)
        : (question.trim() ? question : (uploadedImage ? "请解答图片中的题目，并指出相关的知识点。" : ""));

      const result = await askQuestion(finalQuestion, context, uploadedImage || undefined);
      setAnswer({
        history: [
          { role: 'user', text: finalQuestion },
          { role: 'model', text: result.answer }
        ],
        relevantNodes: result.relevantNodes
      });
      setReferencedNote(null);
      setUploadedImage(null);
      setQuestion('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnswering(false);
    }
  };

  const handleFollowUpAsk = async () => {
    if (!followUpQuestion.trim() || !answer) return;
    setIsFollowingUp(true);
    try {
      const context = nodes.map(n => {
        let text = `ID: ${n.id} | Label: ${n.label} | Content: ${n.content}`;
        if (n.notes && n.notes.length > 0) {
          text += `\n  相关笔记:\n` + n.notes.map(note => `  - ${note.title ? note.title + ': ' : ''}${note.content}`).join('\n');
        }
        return text;
      }).join('\n\n');
      
      const result = await askQuestion(followUpQuestion, context, undefined, answer.history);
      setAnswer({
        history: [
          ...answer.history,
          { role: 'user', text: followUpQuestion },
          { role: 'model', text: result.answer }
        ],
        relevantNodes: Array.from(new Set([...answer.relevantNodes, ...result.relevantNodes]))
      });
      setFollowUpQuestion('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsFollowingUp(false);
    }
  };

  const handleNodeUpdate = () => {
    if (!editNode) return;
    setNodes(prev => prev.map(n => n.id === editNode.id ? editNode : n));
    setIsEditing(false);
    setSelectedNode(editNode);
  };

  const handleDeleteNode = (id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setLinks(prev => prev.filter(l => l.source !== id && l.target !== id));
    setSelectedNode(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setNodes((items) => {
        const activeCourseChapters = items
          .filter(n => (n.type === 'chapter' || n.id.startsWith('c_')) && (n.courseId === activeCourseId || (!n.courseId && !activeCourseId)))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          
        const oldIndex = activeCourseChapters.findIndex((item) => item.id === active.id);
        const newIndex = activeCourseChapters.findIndex((item) => item.id === over.id);
        
        if (oldIndex === -1 || newIndex === -1) return items;
        
        const newChapters = arrayMove(activeCourseChapters, oldIndex, newIndex);
        const orderMap = new Map(newChapters.map((c, index) => [c.id, index]));
        
        return items.map(item => {
          if (orderMap.has(item.id)) {
            return { ...item, order: orderMap.get(item.id) };
          }
          return item;
        });
      });
    }
  };

  const handleAddNote = () => {
    if (!selectedNode || !newNoteContent.trim()) return;
    const newNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title: newNoteTitle.trim() || undefined,
      content: newNoteContent,
      createdAt: Date.now()
    };
    const updatedNode = {
      ...selectedNode,
      notes: [...(selectedNode.notes || []), newNote]
    };
    setNodes(prev => prev.map(n => n.id === updatedNode.id ? updatedNode : n));
    setSelectedNode(updatedNode);
    setNewNoteTitle('');
    setNewNoteContent('');
  };

  const handleUpdateNote = () => {
    if (!selectedNode || !editingNoteId || !editingNoteContent.trim()) return;
    const updatedNotes = (selectedNode.notes || []).map(note => 
      note.id === editingNoteId 
        ? { ...note, title: editingNoteTitle.trim() || undefined, content: editingNoteContent }
        : note
    );
    const updatedNode = { ...selectedNode, notes: updatedNotes };
    setNodes(prev => prev.map(n => n.id === updatedNode.id ? updatedNode : n));
    setSelectedNode(updatedNode);
    setEditingNoteId(null);
    setEditingNoteTitle('');
    setEditingNoteContent('');
  };

  const handleDeleteNote = (noteId: string) => {
    if (!selectedNode) return;
    const updatedNotes = (selectedNode.notes || []).filter(note => note.id !== noteId);
    const updatedNode = { ...selectedNode, notes: updatedNotes };
    setNodes(prev => prev.map(n => n.id === updatedNode.id ? updatedNode : n));
    setSelectedNode(updatedNode);
  };

  const handleNoteImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEditing: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const imageMarkdown = `\n\n![image](${base64})\n\n`;
      if (isEditing) {
        setEditingNoteContent(prev => prev + imageMarkdown);
      } else {
        setNewNoteContent(prev => prev + imageMarkdown);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddTag = () => {
    if (!selectedNode || !newTag.trim()) return;
    const updatedNode = {
      ...selectedNode,
      tags: [...(selectedNode.tags || []), newTag.trim()]
    };
    setNodes(prev => prev.map(n => n.id === updatedNode.id ? updatedNode : n));
    setSelectedNode(updatedNode);
    setNewTag('');
  };

  const handleAddExample = () => {
    if (!selectedNode || !newExampleQ.trim() || !newExampleA.trim()) return;
    const newExample = {
      question: newExampleQ,
      answer: newExampleA
    };
    const updatedNode = {
      ...selectedNode,
      examples: [...(selectedNode.examples || []), newExample]
    };
    setNodes(prev => prev.map(n => n.id === updatedNode.id ? updatedNode : n));
    setSelectedNode(updatedNode);
    setNewExampleQ('');
    setNewExampleA('');
  };

  const handleAddSubpoint = () => {
    if (!selectedNode || !newSubpoint.trim()) return;
    const subpointId = `sp_${Math.random().toString(36).substr(2, 9)}`;
    const newSubNode: KnowledgeNode = {
      id: subpointId,
      label: newSubpoint,
      content: '',
      type: 'point',
      source: 'Manual Input',
      courseId: activeCourseId || undefined,
      parentId: selectedNode.id
    };
    const newLink: KnowledgeLink = {
      source: selectedNode.id,
      target: subpointId,
      label: 'contains',
      courseId: activeCourseId || undefined
    };
    setNodes(prev => [...prev, newSubNode]);
    setLinks(prev => [...prev, newLink]);
    setNewSubpoint('');
  };

  const handleGenerateOutline = () => {
    if (!selectedNode) return;
    setChapterOutline('');
    setIsExpandingChapter(true);
  };

  const handleSaveOutline = async () => {
    if (!selectedNode || !chapterOutline.trim()) return;
    
    setIsAnalyzing(true);
    try {
      setIsExpandingChapter(false);
      
      const points = await generateFrameworkFromOutline(chapterOutline, selectedNode.label);
      
      const newLinks: KnowledgeLink[] = [];
      
      setNodes(prev => {
        const merged = [...prev];
        newLinks.length = 0; // Clear to prevent double-population in Strict Mode
        
        const processPoints = (pts: any[], parentId: string) => {
          pts.forEach(point => {
            let currentPointId = '';
            const existingIndex = merged.findIndex(n => n.parentId === parentId && n.label.toLowerCase() === point.label.toLowerCase());
            if (existingIndex !== -1) {
              merged[existingIndex] = {
                ...merged[existingIndex],
                content: merged[existingIndex].content ? `${merged[existingIndex].content}\n\n${point.content}` : point.content,
                examples: [...(merged[existingIndex].examples || []), ...formatExampleContent(point.examples || [])]
              };
              currentPointId = merged[existingIndex].id;
            } else {
              currentPointId = `pt-${Math.random().toString(36).substr(2, 5)}`;
              merged.push({
                id: currentPointId,
                label: point.label,
                type: 'point',
                content: point.content,
                examples: formatExampleContent(point.examples),
                source: 'AI Outline',
                parentId: parentId,
                courseId: activeCourseId || undefined
              });
              newLinks.push({
                source: parentId,
                target: currentPointId,
                label: 'contains',
                courseId: activeCourseId || undefined
              });
            }
            
            if (point.subPoints && point.subPoints.length > 0) {
              processPoints(point.subPoints, currentPointId);
            }
          });
        };
        
        processPoints(points, selectedNode.id);
        
        return merged;
      });

      if (newLinks.length > 0) {
        setLinks(prevLinks => {
          const existing = new Set(prevLinks.map(l => `${l.source}-${l.target}-${l.label}`));
          const toAdd = newLinks.filter(l => !existing.has(`${l.source}-${l.target}-${l.label}`));
          return [...prevLinks, ...toAdd];
        });
      }
      
      setChapterOutline('');
    } catch (error) {
      console.error(error);
      console.error("Outline analysis failed. Please check your API key.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const exportData = () => {
    const data = JSON.stringify({ nodes, links, documents });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'knowledge_graph_backup.json';
    a.click();
  };

  const importData = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        setNodes(data.nodes || []);
        setLinks(data.links || []);
        setDocuments(data.documents || []);
      } catch (error) {
        console.error("Failed to parse imported file:", error);
        alert("导入失败：文件格式不正确");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className={cn("flex flex-col h-screen w-full overflow-hidden transition-colors duration-500 font-sans", isDarkMode ? "dark bg-slate-950 text-slate-100" : "bg-[#F8FAFC] text-slate-700")}>
      {/* Background Gradient for Light Mode */}
      {!isDarkMode && (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(129,140,248,0.08),transparent_50%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(52,211,153,0.05),transparent_50%)] pointer-events-none" />
        </>
      )}

      {/* Top Header */}
      <header className="flex-none h-16 border-b border-slate-200/50 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/50 backdrop-blur-2xl z-30 flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-500/20 rounded-lg">
              <BookOpen className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            </div>
            <h1 className="font-bold text-lg text-slate-800 dark:text-slate-100">AI Graph</h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setViewMode('blocks')}
            className={cn("flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all duration-300", viewMode === 'blocks' ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800")}
          >
            <LayoutGrid className="w-4 h-4" /> 知识块
          </button>
          <button 
            onClick={() => setViewMode('mindmap')}
            className={cn("flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all duration-300", viewMode === 'mindmap' ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800")}
          >
            <Network className="w-4 h-4" /> 思维导图
          </button>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 my-auto mx-1" />
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all">
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button onClick={exportData} title="导出数据" className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all">
            <Download className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 my-auto mx-1" />
          {user ? (
            <div className="flex items-center gap-3 ml-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{user.displayName || user.email}</span>
              <button onClick={logout} className="px-4 py-2 text-sm font-medium text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 rounded-xl transition-all shadow-sm">
                登出
              </button>
            </div>
          ) : (
            <div className="relative">
              <button onClick={handleLogin} className="ml-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm shadow-indigo-600/20 flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Gmail 登录
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {!user ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 z-50 absolute inset-0">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-100 dark:border-slate-700">
              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6 transform rotate-3">
                <Network className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">开启你的知识图谱</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                登录后即可创建课程、上传资料，AI 将自动为你构建并永久保存专属的知识库。
              </p>
              <button 
                onClick={handleLogin} 
                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 text-slate-700 dark:text-white bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-xl transition-all shadow-sm font-medium"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                使用 Google 账号继续
              </button>
              {loginError && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg text-left">
                  {loginError}
                </div>
              )}
            </div>
          </div>
        ) : null}
        
        {/* Left Sidebar */}
        <aside className={cn(
          "border-r border-slate-200/50 dark:border-slate-800/60 flex flex-col bg-white/60 dark:bg-slate-900/50 backdrop-blur-2xl z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300 overflow-hidden",
          isSidebarOpen ? "w-80" : "w-0 border-r-0"
        )}>
          <div className="w-80 flex flex-col h-full">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-8">
          {/* Course Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">当前课程</h2>
              <button onClick={() => setIsCreatingCourse(true)} className="p-1 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-md text-indigo-500 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <select 
                value={activeCourseId || ''} 
                onChange={(e) => setActiveCourseId(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {activeCourseId && (
                <div className="flex gap-1">
                  <button 
                    onClick={() => {
                      const course = courses.find(c => c.id === activeCourseId);
                      if (course) {
                        setEditingCourseName(course.name);
                        setIsEditingCourse(true);
                      }
                    }} 
                    className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all"
                    title="编辑课程"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setCourseToDelete(activeCourseId)} 
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-800 rounded-xl transition-all"
                    title="删除课程"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Upload Area */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-indigo-100/80 dark:border-slate-700/60 bg-indigo-50/40 dark:bg-slate-800/30 rounded-2xl p-8 text-center hover:border-indigo-200 dark:hover:border-indigo-500/50 cursor-pointer transition-all duration-300 group shadow-sm hover:shadow-md hover:shadow-indigo-100/50 dark:hover:shadow-none"
          >
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple accept=".pdf,.txt,.md,.doc,.docx" />
            <div className="w-12 h-12 mx-auto mb-3 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-indigo-50 dark:border-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Plus className="w-6 h-6 text-indigo-400 group-hover:text-indigo-500" />
            </div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">上传课程文档</p>
            <p className="text-xs text-slate-400 mt-1.5">PDF, TXT, MD, DOCX</p>
          </div>

          {/* Document List */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">已上传文档</h3>
            <div className="space-y-1.5">
              {activeDocs.map(doc => (
                <div key={doc.id} className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-1.5 bg-white dark:bg-slate-800 rounded-md shadow-sm border border-slate-100 dark:border-slate-700">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </div>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300 truncate">{doc.name}</span>
                  </div>
                  <button onClick={() => {
                    deleteDocument(doc.id);
                    setDocuments(prev => prev.filter(d => d.id !== doc.id));
                  }} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 dark:hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {activeDocs.length === 0 && <p className="text-xs text-slate-400 italic px-1">暂无文档</p>}
            </div>
          </div>

          {/* Outline */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">章节大纲</h3>
              <button 
                onClick={() => {
                  if (!activeCourseId) return;
                  const newId = `c_${Math.random().toString(36).substr(2, 9)}`;
                  const maxOrder = activeNodes.filter(n => n.type === 'chapter' || n.id.startsWith('c_')).reduce((max, n) => Math.max(max, n.order ?? 0), -1);
                  setNodes(prev => [...prev, {
                    id: newId,
                    label: '新章节',
                    content: '',
                    type: 'chapter',
                    source: 'Manual Input',
                    courseId: activeCourseId,
                    order: maxOrder + 1
                  }]);
                }}
                className="p-1 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-md text-indigo-500 transition-colors"
                title="添加章节"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1">
              <DndContext
                sensors={useSensors(
                  useSensor(PointerSensor),
                  useSensor(KeyboardSensor, {
                    coordinateGetter: sortableKeyboardCoordinates,
                  })
                )}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={activeNodes.filter(n => n.type === 'chapter' || (n.id.startsWith('c_'))).map(n => n.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {activeNodes.filter(n => n.type === 'chapter' || (n.id.startsWith('c_'))).map(chapter => (
                    <SortableChapterItem
                      key={chapter.id}
                      chapter={chapter}
                      selectedNode={selectedNode}
                      setSelectedNode={setSelectedNode}
                      setEditNode={setEditNode}
                      setIsEditing={setIsEditing}
                      handleDeleteNode={handleDeleteNode}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              {activeNodes.filter(n => n.type === 'chapter' || (n.id.startsWith('c_'))).length === 0 && (
                <p className="text-xs text-slate-400 italic px-1">暂无章节</p>
              )}
            </div>
          </div>
        </div>
        </div>
      </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col relative z-10 min-w-0 overflow-hidden">
          {/* Graph Canvas */}
          <div className="flex-1 relative overflow-hidden">
            {viewMode === 'blocks' ? (
            <KnowledgeBlocks 
              nodes={activeNodes} 
              links={activeLinks} 
              onNodesChange={(newActiveNodes) => {
                setNodes(prev => {
                  const otherCourseNodes = prev.filter(n => !(n.courseId === activeCourseId || (!n.courseId && !activeCourseId)));
                  return [...otherCourseNodes, ...newActiveNodes];
                });
              }}
              onLinksChange={(newActiveLinks) => {
                setLinks(prev => {
                  const otherCourseLinks = prev.filter(l => !(l.courseId === activeCourseId || (!l.courseId && !activeCourseId)));
                  return [...otherCourseLinks, ...newActiveLinks];
                });
              }}
              onNodeClick={setSelectedNode}
              highlightedNodes={answer?.relevantNodes || []}
            />
          ) : (
            <MindMap 
              nodes={activeNodes} 
              links={activeLinks} 
              onNodeClick={setSelectedNode}
              highlightedNodes={answer?.relevantNodes || []}
            />
          )}
          
          {isAnalyzing && (
            <div className="absolute inset-0 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md flex items-center justify-center z-50">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-5">
                <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
                <p className="font-medium text-slate-700 dark:text-slate-300">AI 正在解析文档并构建图谱...</p>
              </div>
            </div>
          )}
        </div>

        {/* Floating Bottom Bar (Q&A) */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20">
          {referencedNote && (
            <div className="mb-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-xl flex items-start justify-between gap-3 shadow-sm mx-4">
              <div className="flex items-start gap-2 overflow-hidden">
                <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                <div className="text-sm text-indigo-700 dark:text-indigo-300 truncate">
                  <span className="font-medium mr-1">引用笔记:</span>
                  {referencedNote.content}
                </div>
              </div>
              <button onClick={() => setReferencedNote(null)} className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {uploadedImage && (
            <div className="mb-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl flex items-start justify-between gap-3 shadow-sm mx-4">
              <div className="flex items-start gap-2 overflow-hidden">
                <ImagePlus className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                <div className="text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-medium mr-1">已上传图片</span>
                  <img src={uploadedImage} alt="Uploaded" className="mt-2 max-h-24 rounded-md border border-slate-200 dark:border-slate-700" />
                </div>
              </div>
              <button onClick={() => setUploadedImage(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="relative shadow-[0_12px_40px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] rounded-full">
            <input 
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
              onPaste={handlePaste}
              placeholder="输入问题，或粘贴/上传题目图片..."
              className="w-full pl-14 pr-24 py-4 bg-white/80 dark:bg-slate-800/90 backdrop-blur-2xl border border-white/50 dark:border-slate-700/60 rounded-full focus:ring-2 focus:ring-indigo-400/50 outline-none transition-all text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
            />
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400/80" />
            
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <label className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full cursor-pointer transition-colors">
                <ImagePlus className="w-5 h-5" />
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
              <button 
                onClick={handleAsk}
                disabled={isAnswering || (!question.trim() && !referencedNote && !uploadedImage)}
                className="p-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full transition-all duration-300 disabled:opacity-50 hover:shadow-lg hover:shadow-indigo-500/30"
              >
                {isAnswering ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Right Panel (Details) */}
      <AnimatePresence>
        {(selectedNode || answer) && (
          <motion.aside 
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={cn(
              "border-l border-slate-200/50 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/95 backdrop-blur-2xl flex flex-col shadow-[-20px_0_40px_rgba(0,0,0,0.02)] dark:shadow-none z-40 transition-all duration-300",
              isPanelExpanded ? "fixed inset-0 z-50" : "w-[400px]"
            )}
          >
            <div className="p-5 border-b border-slate-200/50 dark:border-slate-800/60 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-slate-800 dark:text-slate-100">
                {answer ? "AI 回答" : "知识点详情"}
              </h2>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsPanelExpanded(!isPanelExpanded)} 
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                  title={isPanelExpanded ? "还原" : "全屏"}
                >
                  {isPanelExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => {
                    setSelectedNode(null);
                    setAnswer(null);
                    setIsEditing(false);
                    setIsPanelExpanded(false);
                  }} 
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              {answer ? (
                <div className="space-y-5 flex flex-col">
                  {answer.history.map((msg, idx) => (
                    <div 
                      key={idx}
                      className={cn(
                        "p-5 rounded-2xl text-sm leading-relaxed relative group prose prose-slate dark:prose-invert max-w-none prose-sm",
                        msg.role === 'user' 
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 self-end ml-8" 
                          : "bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-slate-700 dark:text-slate-300 self-start mr-8"
                      )}
                      onMouseUp={msg.role === 'model' ? (e) => {
                        const selection = window.getSelection();
                        if (selection && selection.toString().trim().length > 0) {
                          const range = selection.getRangeAt(0);
                          const rect = range.getBoundingClientRect();
                          const containerRect = e.currentTarget.getBoundingClientRect();
                          setSelectionRect({
                            top: rect.top - containerRect.top - 40,
                            left: rect.left - containerRect.left + rect.width / 2
                          });
                        } else {
                          setSelectionRect(null);
                        }
                      } : undefined}
                    >
                      <ReactMarkdown 
                        remarkPlugins={[remarkMath, remarkGfm]} 
                        rehypePlugins={[[rehypeKatex, { strict: false }]]}
                        urlTransform={(value) => value}
                        components={{
                          img: ({node, ...props}) => {
                            if (!props.src) return null;
                            return <img {...props} referrerPolicy="no-referrer" />;
                          },
                          a: ({node, href, children, ...props}) => {
                            if (href && href.startsWith('node://')) {
                              const nodeId = href.replace('node://', '');
                              return (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const targetNode = nodes.find(n => n.id === nodeId);
                                    if (targetNode) {
                                      setPreviewNode(targetNode);
                                    }
                                  }}
                                  className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 underline decoration-indigo-500/30 hover:decoration-indigo-500 transition-colors cursor-pointer font-medium"
                                >
                                  {children}
                                </button>
                              );
                            }
                            return <a href={href} {...props}>{children}</a>;
                          }
                        }}
                      >
                        {preprocessLaTeX(msg.text)}
                      </ReactMarkdown>
                      
                      {msg.role === 'model' && (
                        <>
                          <button 
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const selection = getCleanSelectionText().trim();
                              const textToSave = selection || msg.text;
                              setAnswerTextToSave(textToSave);

                              let targetNode = selectedNode;
                              if (!targetNode && answer.relevantNodes.length > 0) {
                                const firstNodeId = answer.relevantNodes[0];
                                targetNode = nodes.find(n => n.id === firstNodeId || n.label === firstNodeId) || null;
                              }
                              if (targetNode) {
                                setAddAnswerTargetNodeId(targetNode.id);
                              } else {
                                setAddAnswerTargetNodeId('');
                              }
                              setNewAnswerNodeLabel('');
                              setNewAnswerParentId('');
                              setAnswerNoteTitle('');
                              setIsAddAnswerModalOpen(true);
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                            title="添加到相关知识点笔记 (如果有选中文字则只添加选中部分)"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          {selectionRect && (
                            <div 
                              className="absolute z-50 animate-in fade-in zoom-in duration-200"
                              style={{ top: selectionRect.top, left: selectionRect.left, transform: 'translateX(-50%)' }}
                            >
                              <button
                                onMouseDown={(e) => {
                                  e.preventDefault(); // Prevent losing selection
                                  e.stopPropagation(); // Prevent document mousedown from firing
                                  const selection = getCleanSelectionText().trim();
                                  if (selection) {
                                    setAnswerTextToSave(selection);
                                    let targetNode = selectedNode;
                                    if (!targetNode && answer.relevantNodes.length > 0) {
                                      const firstNodeId = answer.relevantNodes[0];
                                      targetNode = nodes.find(n => n.id === firstNodeId || n.label === firstNodeId) || null;
                                    }
                                    if (targetNode) {
                                      setAddAnswerTargetNodeId(targetNode.id);
                                    } else {
                                      setAddAnswerTargetNodeId('');
                                    }
                                    setNewAnswerNodeLabel('');
                                    setNewAnswerParentId('');
                                    setAnswerNoteTitle('');
                                    setIsAddAnswerModalOpen(true);
                                    setSelectionRect(null);
                                    window.getSelection()?.removeAllRanges();
                                  }
                                }}
                                className="flex items-center justify-center p-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-500/30 transition-all duration-300"
                                title="添加选中内容为笔记"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                  
                  {/* Follow-up Question Input */}
                  <div className="mt-4 relative">
                    <input 
                      value={followUpQuestion}
                      onChange={(e) => setFollowUpQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleFollowUpAsk()}
                      placeholder="继续追问..."
                      className="w-full pl-4 pr-12 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-400/50 outline-none transition-all text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                    />
                    <button 
                      onClick={handleFollowUpAsk}
                      disabled={isFollowingUp || !followUpQuestion.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-all duration-300 disabled:opacity-50"
                    >
                      {isFollowingUp ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5 ml-0.5" />}
                    </button>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">相关知识点</h4>
                    <div className="flex flex-wrap gap-2">
                      {answer.relevantNodes.map((nodeId, idx) => {
                        const node = nodes.find(n => n.id === nodeId || n.label === nodeId);
                        return node ? (
                          <button 
                            key={`${nodeId}-${idx}`}
                            onClick={() => setSelectedNode(node)}
                            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 transition-all shadow-sm"
                          >
                            {node.label}
                          </button>
                        ) : null;
                      })}
                    </div>
                  </div>
                </div>
              ) : selectedNode && (
                <div className="space-y-6">
                  {isEditing ? (
                    <div className="space-y-5">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">标题</label>
                        <input 
                          value={editNode?.label}
                          onChange={(e) => setEditNode(prev => prev ? { ...prev, label: e.target.value } : null)}
                          className="w-full p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">内容</label>
                        <textarea 
                          rows={12}
                          value={editNode?.content}
                          onChange={(e) => setEditNode(prev => prev ? { ...prev, content: e.target.value } : null)}
                          className="w-full p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm leading-relaxed resize-none"
                        />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button onClick={handleNodeUpdate} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-all shadow-md shadow-indigo-500/20">
                          <Save className="w-4 h-4" /> 保存
                        </button>
                        <button onClick={() => setIsEditing(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium transition-all">
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        {selectedNode.parentId && (
                          <button 
                            onClick={() => {
                              const parentNode = nodes.find(n => n.id === selectedNode.parentId);
                              if (parentNode) setSelectedNode(parentNode);
                            }}
                            className="mb-4 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            返回上一级
                          </button>
                        )}
                        <div className="flex items-center justify-between mb-3">
                          <span className={cn("px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider", selectedNode.type === 'chapter' ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400")}>
                            {selectedNode.type === 'chapter' ? '章节' : '知识点'}
                          </span>
                          <div className="flex gap-1.5">
                            <button 
                              onClick={() => {
                                setEditNode(selectedNode);
                                setIsEditing(true);
                              }}
                              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-500 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteNode(selectedNode.id)}
                              className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-tight">{selectedNode.label}</h1>
                      </div>

                      <div className="prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        <ReactMarkdown 
                          remarkPlugins={[remarkMath, remarkGfm]} 
                          rehypePlugins={[[rehypeKatex, { strict: false }]]}
                          urlTransform={(value) => value}
                          components={{
                            img: ({node, ...props}) => {
                              if (!props.src) return null;
                              return <img {...props} referrerPolicy="no-referrer" />;
                            }
                          }}
                        >
                          {preprocessLaTeX(selectedNode.content)}
                        </ReactMarkdown>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedNode.tags?.map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 rounded-md text-[10px] font-medium flex items-center gap-1">
                            {tag}
                            <button onClick={() => {
                              const updatedNode = { ...selectedNode, tags: selectedNode.tags?.filter((_, idx) => idx !== i) };
                              setNodes(prev => prev.map(n => n.id === updatedNode.id ? updatedNode : n));
                              setSelectedNode(updatedNode);
                            }} className="hover:text-amber-900 dark:hover:text-amber-200">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        <div className="flex items-center gap-1">
                          <input 
                            value={newTag}
                            onChange={e => setNewTag(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                            placeholder="添加标签..."
                            className="w-20 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-[10px] outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="pt-6 border-t border-slate-100 dark:border-slate-800/60">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">快捷操作</h4>
                        <div className="flex flex-wrap gap-2">
                          <label className="cursor-pointer px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
                            <Upload className="w-4 h-4" /> 上传资料
                            <input 
                              type="file" 
                              multiple 
                              className="hidden" 
                              onChange={(e) => handleNodeFileUpload(e, selectedNode)}
                              accept=".txt,.md,.pdf,.doc,.docx"
                            />
                          </label>
                          {selectedNode.type === 'chapter' && (
                            <>
                              <button 
                                onClick={handleGenerateOutline}
                                className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                              >
                                <Network className="w-4 h-4" /> AI 提纲优化
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Subpoints */}
                      <div className="pt-6 border-t border-slate-100 dark:border-slate-800/60">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">子知识点</h4>
                        <div className="space-y-2 mb-3">
                          {activeNodes.filter(n => n.parentId === selectedNode.id && (n.type === 'subpoint' || n.type === 'point')).map(sub => (
                            <div key={sub.id} className="group flex items-center justify-between rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors">
                              <button 
                                onClick={() => setSelectedNode(sub)}
                                className="flex-1 text-left p-2.5 text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between truncate"
                              >
                                <span className="truncate">{sub.label}</span>
                                <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteNode(sub.id);
                                }}
                                className="p-2 mr-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                title="删除子节点"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input 
                            value={newSubpoint}
                            onChange={e => setNewSubpoint(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddSubpoint()}
                            placeholder="添加子知识点..."
                            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-xs"
                          />
                          <button 
                            onClick={handleAddSubpoint}
                            disabled={!newSubpoint.trim()}
                            className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                          >
                            添加
                          </button>
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="pt-6 border-t border-slate-100 dark:border-slate-800/60">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">笔记</h4>
                        
                        {selectedNode.notes && selectedNode.notes.length > 0 && (
                          <div className="space-y-3 mb-4">
                            {selectedNode.notes.map((note, i) => (
                              <div key={note.id || i} className="p-3 bg-yellow-50 dark:bg-yellow-500/10 rounded-xl text-sm text-slate-700 dark:text-slate-300 border border-yellow-100 dark:border-yellow-500/20 group relative">
                                {editingNoteId === note.id ? (
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      value={editingNoteTitle}
                                      onChange={(e) => setEditingNoteTitle(e.target.value)}
                                      placeholder="笔记标题 (可选)"
                                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm font-medium"
                                    />
                                    <textarea 
                                      value={editingNoteContent}
                                      onChange={(e) => setEditingNoteContent(e.target.value)}
                                      placeholder="笔记内容..."
                                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm resize-none h-24"
                                    />
                                    <div className="flex justify-between items-center">
                                      <label className="cursor-pointer p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors">
                                        <ImagePlus className="w-4 h-4" />
                                        <input 
                                          type="file" 
                                          accept="image/*" 
                                          className="hidden" 
                                          onChange={(e) => handleNoteImageUpload(e, true)} 
                                        />
                                      </label>
                                      <div className="flex gap-2">
                                        <button 
                                          onClick={() => setEditingNoteId(null)}
                                          className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-medium transition-all"
                                        >
                                          取消
                                        </button>
                                        <button 
                                          onClick={handleUpdateNote}
                                          disabled={!editingNoteContent.trim()}
                                          className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                                        >
                                          保存
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                      <button 
                                        onClick={() => {
                                          setReferencedNote({
                                            nodeId: selectedNode.id,
                                            noteId: note.id || '',
                                            content: note.content
                                          });
                                          setTimeout(() => {
                                            const inputEl = document.querySelector('input[placeholder*="输入问题"]') as HTMLInputElement;
                                            if (inputEl) {
                                              inputEl.focus();
                                            }
                                          }, 50);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-colors"
                                        title="问问 AI"
                                      >
                                        <Sparkles className="w-3.5 h-3.5" />
                                      </button>
                                      <button 
                                        onClick={() => {
                                          setEditingNoteId(note.id || null);
                                          setEditingNoteTitle(note.title || '');
                                          setEditingNoteContent(note.content);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-colors"
                                        title="编辑笔记"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button 
                                        onClick={() => setNoteToDelete(note.id || '')}
                                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-colors"
                                        title="删除笔记"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    {note.title && (
                                      <h5 className="font-bold text-slate-800 dark:text-slate-200 mb-1 pr-12">{note.title}</h5>
                                    )}
                                    <div className="prose prose-slate dark:prose-invert max-w-none prose-sm">
                                      <ReactMarkdown 
                                        remarkPlugins={[remarkMath, remarkGfm]} 
                                        rehypePlugins={[[rehypeKatex, { strict: false }]]}
                                        urlTransform={(value) => value}
                                        components={{
                                          img: ({node, ...props}) => {
                                            if (!props.src) return null;
                                            return <img {...props} referrerPolicy="no-referrer" />;
                                          }
                                        }}
                                      >
                                        {preprocessLaTeX(note.content)}
                                      </ReactMarkdown>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="space-y-2 bg-slate-50/50 dark:bg-slate-800/20 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50">
                          <input
                            type="text"
                            value={newNoteTitle}
                            onChange={(e) => setNewNoteTitle(e.target.value)}
                            placeholder="笔记标题 (可选)"
                            className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm font-medium"
                          />
                          <textarea 
                            value={newNoteContent}
                            onChange={(e) => setNewNoteContent(e.target.value)}
                            placeholder="添加新笔记内容..."
                            className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm resize-none h-20"
                          />
                          <div className="flex justify-between items-center">
                            <label className="cursor-pointer p-2 text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700" title="插入图片">
                              <ImagePlus className="w-4 h-4" />
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => handleNoteImageUpload(e, false)} 
                              />
                            </label>
                            <button 
                              onClick={handleAddNote}
                              disabled={!newNoteContent.trim()}
                              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" /> 添加笔记
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Examples */}
                      <div className="pt-6 border-t border-slate-100 dark:border-slate-800/60">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">例题</h4>
                        
                        {selectedNode.examples && selectedNode.examples.length > 0 && (
                          <div className="space-y-3 mb-4">
                            {selectedNode.examples.map((example, i) => (
                              <div key={i} className="flex flex-col gap-2 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800/60 last:border-0 last:pb-0 last:mb-0">
                                <div className="p-3 bg-blue-50/80 dark:bg-blue-500/10 rounded-xl text-sm text-slate-800 dark:text-slate-200 border border-blue-100 dark:border-blue-500/20">
                                  <div className="font-medium flex gap-2">
                                    <span className="shrink-0 text-blue-600 dark:text-blue-400 font-bold">Q:</span>
                                    <div className="markdown-body text-sm bg-transparent p-0">
                                      <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>{preprocessLaTeX(example.question)}</ReactMarkdown>
                                    </div>
                                  </div>
                                </div>
                                <div className="p-3 bg-emerald-50/80 dark:bg-emerald-500/10 rounded-xl text-sm text-slate-700 dark:text-slate-300 border border-emerald-100 dark:border-emerald-500/20">
                                  <div className="flex gap-2">
                                    <span className="shrink-0 text-emerald-600 dark:text-emerald-400 font-bold">A:</span>
                                    <div className="markdown-body text-sm bg-transparent p-0">
                                      <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>{preprocessLaTeX(example.answer)}</ReactMarkdown>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="space-y-2">
                          <input 
                            value={newExampleQ}
                            onChange={e => setNewExampleQ(e.target.value)}
                            placeholder="问题..."
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-xs"
                          />
                          <textarea 
                            value={newExampleA}
                            onChange={e => setNewExampleA(e.target.value)}
                            placeholder="答案..."
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-xs resize-none h-16"
                          />
                          <button 
                            onClick={handleAddExample}
                            disabled={!newExampleQ.trim() || !newExampleA.trim()}
                            className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                          >
                            添加例题
                          </button>
                        </div>
                      </div>

                      {/* Related Points */}
                      {activeLinks.filter(l => l.source === selectedNode.id || l.target === selectedNode.id).length > 0 && (
                        <div className="pt-6 border-t border-slate-100 dark:border-slate-800/60">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">关联知识点</h4>
                          <div className="flex flex-wrap gap-2">
                            {activeLinks.filter(l => l.source === selectedNode.id || l.target === selectedNode.id).map((link, idx) => {
                              const isSource = link.source === selectedNode.id;
                              const relatedId = isSource ? link.target : link.source;
                              const relatedNode = activeNodes.find(n => n.id === relatedId);
                              if (!relatedNode) return null;
                              return (
                                <button 
                                  key={`${link.source}-${link.target}-${(link as any).type || link.label}-${idx}`}
                                  onClick={() => setSelectedNode(relatedNode)}
                                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 transition-all shadow-sm flex items-center gap-1.5"
                                >
                                  <span className="text-[10px] text-slate-400">{(link as any).type || link.label}</span>
                                  {relatedNode.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="pt-6 border-t border-slate-100 dark:border-slate-800/60">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">来源文档</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700/50">
                          <FileText className="w-3.5 h-3.5" />
                          <span className="truncate">{selectedNode.source}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      </div>
      {/* Preview Node Modal */}
      <AnimatePresence>
        {previewNode && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewNode(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl max-h-[85vh] bg-white dark:bg-slate-900 rounded-[32px] shadow-[0_32px_80px_rgba(0,0,0,0.15)] border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-50 dark:border-slate-800/60 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-xl", previewNode.type === 'chapter' ? "bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10" : "bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10")}>
                    {previewNode.type === 'chapter' ? <BookOpen className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{previewNode.label}</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{previewNode.type === 'chapter' ? '章节详情' : '知识点详情'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setPreviewNode(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="prose prose-slate dark:prose-invert max-w-none mb-10">
                  <ReactMarkdown 
                    remarkPlugins={[remarkMath, remarkGfm]} 
                    rehypePlugins={[[rehypeKatex, { strict: false }]]}
                    urlTransform={(value) => value}
                    components={{
                      img: ({node, ...props}) => {
                        if (!props.src) return null;
                        return <img {...props} referrerPolicy="no-referrer" className="rounded-2xl shadow-lg border border-slate-100 dark:border-slate-800" />;
                      }
                    }}
                  >
                    {preprocessLaTeX(previewNode.content)}
                  </ReactMarkdown>
                </div>

                {previewNode.notes && previewNode.notes.length > 0 && (
                  <div className="space-y-6">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> 相关笔记
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                      {previewNode.notes.map((note) => (
                        <div key={note.id} className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                          {note.title && <h5 className="font-bold text-slate-800 dark:text-slate-200 mb-2">{note.title}</h5>}
                          <div className="prose prose-slate dark:prose-invert prose-sm max-w-none">
                            <ReactMarkdown 
                              remarkPlugins={[remarkMath, remarkGfm]} 
                              rehypePlugins={[[rehypeKatex, { strict: false }]]}
                              urlTransform={(value) => value}
                            >
                              {preprocessLaTeX(note.content)}
                            </ReactMarkdown>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800/60 flex justify-end gap-3">
                <button 
                  onClick={() => {
                    setSelectedNode(previewNode);
                    setPreviewNode(null);
                  }}
                  className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                >
                  在侧边栏打开 <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Course Modal */}
      <AnimatePresence>
        {isCreatingCourse && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h2 className="text-xl font-bold">新建课程库</h2>
                <button onClick={() => setIsCreatingCourse(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">课程名称</label>
                  <input 
                    type="text" 
                    value={newCourseName} 
                    onChange={e => setNewCourseName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="例如：高等数学"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">课程目录/大纲 (可选)</label>
                    <label className="cursor-pointer text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> 上传大纲文件
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".txt,.md,.pdf,.doc,.docx"
                        onChange={(e) => handleSyllabusFileUpload(e, false)}
                      />
                    </label>
                  </div>
                  <textarea 
                    value={newCourseSyllabus} 
                    onChange={e => setNewCourseSyllabus(e.target.value)}
                    className="w-full h-32 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    placeholder="输入课程目录或上传文本文件，AI将自动为您搭建知识框架..."
                  />
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
                <button onClick={() => setIsCreatingCourse(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium">
                  取消
                </button>
                <button 
                  onClick={handleCreateCourse}
                  disabled={!newCourseName.trim() || isAnalyzing}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isAnalyzing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  创建
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Edit Course Modal */}
      <AnimatePresence>
        {isEditingCourse && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h2 className="text-xl font-bold">编辑课程</h2>
                <button onClick={() => setIsEditingCourse(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">课程名称</label>
                  <input 
                    type="text" 
                    value={editingCourseName} 
                    onChange={e => setEditingCourseName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="例如：高等数学"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">追加课程目录/大纲 (可选)</label>
                    <label className="cursor-pointer text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> 上传大纲文件
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".txt,.md,.pdf,.doc,.docx"
                        onChange={(e) => handleSyllabusFileUpload(e, true)}
                      />
                    </label>
                  </div>
                  <textarea 
                    value={editingCourseSyllabus} 
                    onChange={e => setEditingCourseSyllabus(e.target.value)}
                    className="w-full h-32 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    placeholder="输入要追加的课程目录或上传文本文件，AI将自动为您搭建新的知识框架..."
                  />
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
                <button onClick={() => setIsEditingCourse(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium">
                  取消
                </button>
                <button 
                  onClick={handleEditCourse}
                  disabled={!editingCourseName.trim()}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  保存
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Course Modal */}
      <AnimatePresence>
        {courseToDelete && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-red-100 dark:border-red-900/30"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold mb-2">确认删除课程？</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  删除课程将同时删除该课程下的所有知识点、关联和上传的文档。此操作不可恢复。
                </p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => setCourseToDelete(null)} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors font-medium flex-1">
                    取消
                  </button>
                  <button 
                    onClick={() => handleDeleteCourse(courseToDelete)}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors font-medium flex-1"
                  >
                    确认删除
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Note Modal */}
      <AnimatePresence>
        {noteToDelete && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-red-100 dark:border-red-900/30"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold mb-2">确认删除笔记？</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  删除后将无法恢复。
                </p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => setNoteToDelete(null)} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors font-medium flex-1">
                    取消
                  </button>
                  <button 
                    onClick={() => {
                      if (noteToDelete) {
                        handleDeleteNote(noteToDelete);
                      }
                      setNoteToDelete(null);
                    }}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors font-medium flex-1"
                  >
                    确认删除
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expand Chapter Modal */}
      <AnimatePresence>
        {isExpandingChapter && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h2 className="text-xl font-bold">输入提纲生成节点</h2>
                <button onClick={() => setIsExpandingChapter(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    请输入提纲内容，AI 将为您优化并生成知识节点：
                  </label>
                  <textarea 
                    value={chapterOutline} 
                    onChange={e => setChapterOutline(e.target.value)}
                    className="w-full h-64 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-sm leading-relaxed"
                    placeholder="例如：&#10;一、数据结构基础&#10;1. 数组&#10;2. 链表&#10;二、高级数据结构&#10;1. 树&#10;2. 图"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
                <button onClick={() => setIsExpandingChapter(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium">
                  取消
                </button>
                <button 
                  onClick={handleSaveOutline}
                  disabled={!chapterOutline.trim()}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  生成知识点
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Preview Node Modal */}
      <AnimatePresence>
        {previewNode && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                    previewNode.type === 'chapter' 
                      ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" 
                      : "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                  )}>
                    {previewNode.type === 'chapter' ? <BookOpen className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{previewNode.label}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                      {previewNode.type === 'chapter' ? '章节详情' : '知识点详情'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setPreviewNode(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 dark:text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {previewNode.content && (
                  <div className="mb-8">
                    <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                      核心概述
                    </h3>
                    <div className="text-slate-700 dark:text-slate-300 leading-relaxed text-lg font-medium">
                      {previewNode.content}
                    </div>
                  </div>
                )}

                {previewNode.notes && previewNode.notes.length > 0 && (
                  <div className="space-y-6">
                    <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                      详细笔记
                    </h3>
                    {previewNode.notes.map((note) => (
                      <div key={note.id} className="group relative bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all duration-300">
                        <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-300">
                          <ReactMarkdown 
                            remarkPlugins={[remarkMath, remarkGfm]} 
                            rehypePlugins={[[rehypeKatex, { strict: false }]]}
                            components={{
                              img: (props) => <img {...props} referrerPolicy="no-referrer" className="rounded-xl shadow-lg my-4" />
                            }}
                          >
                            {preprocessLaTeX(note.content)}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!previewNode.content && (!previewNode.notes || previewNode.notes.length === 0) && (
                  <div className="h-40 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 italic">
                    <FileText className="w-12 h-12 mb-3 opacity-20" />
                    暂无详细内容
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                  来源: {previewNode.source || '手动添加'}
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setPreviewNode(null)} 
                    className="px-6 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors font-semibold text-sm"
                  >
                    关闭
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedNode(previewNode);
                      setPreviewNode(null);
                    }} 
                    className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/20 font-semibold text-sm flex items-center gap-2"
                  >
                    在侧边栏打开 <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Answer Modal */}
      <AnimatePresence>
        {isAddAnswerModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">将回答保存为笔记</h2>
                <button onClick={() => setIsAddAnswerModalOpen(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 dark:text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">笔记标题 (可选)</label>
                  <input 
                    type="text"
                    value={answerNoteTitle}
                    onChange={(e) => setAnswerNoteTitle(e.target.value)}
                    placeholder="输入笔记标题"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-200 text-sm"
                  />
                </div>

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                  <span className="flex-shrink-0 mx-3 text-slate-400 text-xs font-medium">归属知识点</span>
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">选择已有知识点</label>
                  <NodeTreeSelector
                    nodes={activeNodes}
                    selectedId={addAnswerTargetNodeId}
                    onSelect={(id) => {
                      setAddAnswerTargetNodeId(id);
                      if (id) {
                        setNewAnswerNodeLabel('');
                        setNewAnswerParentId('');
                      }
                    }}
                  />
                </div>

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                  <span className="flex-shrink-0 mx-3 text-slate-400 text-xs font-medium">或</span>
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">新建知识点</label>
                  <input 
                    type="text"
                    value={newAnswerNodeLabel}
                    onChange={(e) => {
                      setNewAnswerNodeLabel(e.target.value);
                      setAddAnswerTargetNodeId('');
                    }}
                    placeholder="输入新知识点名称"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-200 text-sm mb-2"
                  />
                  
                  {newAnswerNodeLabel.trim() && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">所属章节 (可选)</label>
                      <select
                        value={newAnswerParentId}
                        onChange={(e) => setNewAnswerParentId(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-200 text-sm"
                      >
                        <option value="">-- 作为独立章节 --</option>
                        {activeNodes.filter(n => n.type === 'chapter').map(n => (
                          <option key={n.id} value={n.id}>{n.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
                <button onClick={() => setIsAddAnswerModalOpen(false)} className="px-4 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium">
                  取消
                </button>
                <button 
                  onClick={() => {
                    if (!answer) return;
                    
                    const newNote = {
                      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                      title: answerNoteTitle.trim() || undefined,
                      content: `AI 回答: ${answerTextToSave}`,
                      createdAt: Date.now()
                    };

                    if (newAnswerNodeLabel.trim()) {
                      const newNode: KnowledgeNode = {
                        id: `node-${Date.now()}`,
                        label: newAnswerNodeLabel.trim(),
                        type: newAnswerParentId ? 'point' : 'chapter',
                        parentId: newAnswerParentId || undefined,
                        content: '',
                        source: 'AI 回答',
                        courseId: activeCourseId || undefined,
                        order: activeNodes.length,
                        notes: [newNote]
                      };
                      setNodes(prev => [...prev, newNode]);
                      
                      if (newAnswerParentId) {
                        const newLink: KnowledgeLink = {
                          source: newAnswerParentId,
                          target: newNode.id,
                          label: 'contains',
                          courseId: activeCourseId || undefined
                        };
                        setLinks(prev => [...prev, newLink]);
                      }
                      
                      setSelectedNode(newNode);
                    } else if (addAnswerTargetNodeId) {
                      const targetNode = nodes.find(n => n.id === addAnswerTargetNodeId);
                      if (targetNode) {
                        const updatedNode = {
                          ...targetNode,
                          notes: [...(targetNode.notes || []), newNote]
                        };
                        setNodes(prev => prev.map(n => n.id === updatedNode.id ? updatedNode : n));
                        setSelectedNode(updatedNode);
                      }
                    }
                    
                    setIsAddAnswerModalOpen(false);
                    setAddAnswerTargetNodeId('');
                    setNewAnswerNodeLabel('');
                    setNewAnswerParentId('');
                    setAnswerNoteTitle('');
                  }}
                  disabled={!addAnswerTargetNodeId && !newAnswerNodeLabel.trim()}
                  className="px-5 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  确定
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
