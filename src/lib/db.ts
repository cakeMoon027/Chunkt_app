import { db } from './firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch, query, where, Timestamp } from 'firebase/firestore';
import { getCurrentUser } from './auth-state';

export interface Course {
  id: string;
  name: string;
  createdAt: number;
  userId?: string;
}

export interface Note {
  id?: string;
  title?: string;
  content: string;
  source?: string;
  createdAt?: number;
}

export interface KnowledgeNode {
  id: string;
  label: string;
  type: 'chapter' | 'point' | 'subpoint' | 'concept';
  content: string;
  source: string;
  parentId?: string;
  isExpanded?: boolean;
  courseId?: string;
  tags?: string[];
  notes?: Note[];
  examples?: { question: string; answer: string }[];
  order?: number;
  userId?: string;
}

export interface KnowledgeLink {
  source: string;
  target: string;
  label: string;
  courseId?: string;
  dashed?: boolean;
  userId?: string;
}

export interface GraphData {
  nodes: KnowledgeNode[];
  links: KnowledgeLink[];
}

export interface DocumentRecord {
  id: string;
  name: string;
  type: string;
  content: string;
  uploadDate: number;
  courseId?: string;
  userId?: string;
}

export const initDB = async () => {};

export const clearDatabase = async () => {
  const user = getCurrentUser();
  if (!user) return;
  
  const batch = writeBatch(db);
  const qCourses = query(collection(db, 'courses'), where('userId', '==', user.uid));
  const snapCourses = await getDocs(qCourses);
  snapCourses.forEach(d => batch.delete(d.ref));
  
  const qNodes = query(collection(db, 'nodes'), where('userId', '==', user.uid));
  const snapNodes = await getDocs(qNodes);
  snapNodes.forEach(d => batch.delete(d.ref));
  
  const qLinks = query(collection(db, 'links'), where('userId', '==', user.uid));
  const snapLinks = await getDocs(qLinks);
  snapLinks.forEach(d => batch.delete(d.ref));
  
  const qDocs = query(collection(db, 'documents'), where('userId', '==', user.uid));
  const snapDocs = await getDocs(qDocs);
  snapDocs.forEach(d => batch.delete(d.ref));
  
  await batch.commit();
};

export const saveCourse = async (course: Course) => {
  const user = getCurrentUser();
  if (!user) return;
  
  // Use generic field names mapped from UI model to Firestore schema
  const data = {
    userId: user.uid,
    title: course.name,
    description: '',
    createdAt: Timestamp.fromMillis(course.createdAt || Date.now()),
    lastModified: Timestamp.now(),
    order: 0
  };
  
  await setDoc(doc(db, 'courses', course.id), data, { merge: true });
};

export const deleteCourse = async (id: string) => {
  const user = getCurrentUser();
  if (!user) return;
  await deleteDoc(doc(db, 'courses', id));
};

export const loadCourses = async (): Promise<Course[]> => {
  const user = getCurrentUser();
  if (!user) return [];
  
  const q = query(collection(db, 'courses'), where('userId', '==', user.uid));
  const snap = await getDocs(q);
  
  return snap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.title || '',
      createdAt: data.createdAt ? data.createdAt.toMillis() : Date.now(),
    };
  });
};

export const saveGraph = async (nodes: KnowledgeNode[], links: KnowledgeLink[]) => {
  const user = getCurrentUser();
  if (!user) return;
  
  // Batch size is max 500 operations
  let batch = writeBatch(db);
  let operations = 0;
  
  const commitBatch = async () => {
    if (operations > 0) {
      await batch.commit();
      batch = writeBatch(db);
      operations = 0;
    }
  };
  
  // Load existing nodes/links to properly overwrite or know what to keep.
  // Actually, setting doc with merge handles updates seamlessly.
  // Wait, if nodes are removed by the UI, they won't be deleted here.
  // We can just query all nodes and delete the ones not in the `nodes` array? That's heavy, but keeps it consistent.
  const existingNodes = await getDocs(query(collection(db, 'nodes'), where('userId', '==', user.uid)));
  const existingLinks = await getDocs(query(collection(db, 'links'), where('userId', '==', user.uid)));
  
  const currentNodesId = new Set(nodes.map(n => n.id));
  const currentLinksId = new Set(links.map(l => `${l.source}-${l.target}`)); // simplistic ID

  for (const docSnap of existingNodes.docs) {
    if (!currentNodesId.has(docSnap.id)) {
      batch.delete(docSnap.ref);
      operations++;
      if (operations >= 480) await commitBatch();
    }
  }
  
  for (const docSnap of existingLinks.docs) {
    // wait, links didn't have ID in IndexedDB, let's just delete all and re-add.
    batch.delete(docSnap.ref);
    operations++;
    if (operations >= 480) await commitBatch();
  }
  
  await commitBatch();

  let nextOrder = 1;
  const dbTypeMap: any = {
    'chapter': 'chapter',
    'point': 'point',
    'subpoint': 'subpoint'
  };

  for (const node of nodes) {
    const { id, label, type, content, source, parentId, courseId, tags, notes, examples, order } = node;
    const finalOrder = order !== undefined ? order : nextOrder++;
    
    // Clean up undefined values and replace them with null
    const cleanNodeData: any = {
      userId: user.uid,
      courseId: courseId || null,
      label: label || '',
      type: dbTypeMap[type] || 'point',
      content: content || null,
      source: source || null,
      parentId: parentId || null,
      order: finalOrder,
      tags: tags && tags.length > 0 ? tags.slice(0, 20) : null,
      notes: notes || null,
      examples: examples || null
    };

    // Remove any explicitly undefined properties (though we set them to null above, 
    // it's good practice to ensure no nested undefined exists)
    Object.keys(cleanNodeData).forEach(key => {
      if (cleanNodeData[key] === undefined) {
        cleanNodeData[key] = null;
      }
    });

    // Also sanitize nested arrays ensuring no undefined values
    if (cleanNodeData.notes) {
      cleanNodeData.notes = cleanNodeData.notes.map((n: any) => {
        const cleanNote = { ...n };
        Object.keys(cleanNote).forEach(k => {
          if (cleanNote[k] === undefined) cleanNote[k] = null;
        });
        return cleanNote;
      });
    }

    if (cleanNodeData.examples) {
      cleanNodeData.examples = cleanNodeData.examples.map((e: any) => {
        const cleanEx = { ...e };
        Object.keys(cleanEx).forEach(k => {
          if (cleanEx[k] === undefined) cleanEx[k] = null;
        });
        return cleanEx;
      });
    }

    batch.set(doc(db, 'nodes', id), cleanNodeData, { merge: true });
    
    operations++;
    if (operations >= 480) await commitBatch();
  }
  
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
    const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
    
    const linkDocId = `link_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`;
    
    const cleanLinkData: any = {
      userId: user.uid,
      courseId: link.courseId || null,
      source: sourceId,
      target: targetId,
      label: link.label || null,
      dashed: link.dashed || false
    };

    Object.keys(cleanLinkData).forEach(key => {
      if (cleanLinkData[key] === undefined) {
        cleanLinkData[key] = null;
      }
    });

    batch.set(doc(db, 'links', linkDocId), cleanLinkData, { merge: true });
    
    operations++;
    if (operations >= 480) await commitBatch();
  }

  await commitBatch();
};

export const loadGraph = async (): Promise<GraphData> => {
  const user = getCurrentUser();
  if (!user) return { nodes: [], links: [] };
  
  const [nodesSnap, linksSnap] = await Promise.all([
    getDocs(query(collection(db, 'nodes'), where('userId', '==', user.uid))),
    getDocs(query(collection(db, 'links'), where('userId', '==', user.uid)))
  ]);
  
  const nodes = nodesSnap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      label: data.label,
      type: data.type,
      content: data.content || '',
      source: data.source || '',
      parentId: data.parentId || undefined,
      courseId: data.courseId || undefined,
      order: data.order,
      tags: data.tags || undefined,
      notes: data.notes || undefined,
      examples: data.examples || undefined
    };
  }) as KnowledgeNode[];
  
  const links = linksSnap.docs.map(doc => {
    const data = doc.data();
    return {
      source: data.source,
      target: data.target,
      label: data.label || '',
      courseId: data.courseId || undefined,
      dashed: data.dashed || undefined
    };
  }) as KnowledgeLink[];
  
  nodes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  
  return { nodes, links };
};

export const saveDocument = async (docObj: DocumentRecord) => {
  const user = getCurrentUser();
  if (!user) return;
  
  const cleanDocData: any = {
    userId: user.uid,
    courseId: docObj.courseId || null,
    name: docObj.name,
    status: 'success', // mapping legacy to new schema
    size: 0,
    parsedAt: Timestamp.fromMillis(docObj.uploadDate),
    // store actual content too as an extra since we need it in UI
    content: docObj.content || null,
    type: docObj.type || null
  };

  Object.keys(cleanDocData).forEach(key => {
    if (cleanDocData[key] === undefined) {
      cleanDocData[key] = null;
    }
  });

  await setDoc(doc(db, 'documents', docObj.id), cleanDocData, { merge: true });
};

export const loadDocuments = async (): Promise<DocumentRecord[]> => {
  const user = getCurrentUser();
  if (!user) return [];
  
  const snap = await getDocs(query(collection(db, 'documents'), where('userId', '==', user.uid)));
  return snap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      type: data.type || '',
      content: data.content || '',
      uploadDate: data.parsedAt ? data.parsedAt.toMillis() : Date.now(),
      courseId: data.courseId || undefined
    };
  });
};

export const deleteDocument = async (id: string) => {
  const user = getCurrentUser();
  if (!user) return;
  await deleteDoc(doc(db, 'documents', id));
};
