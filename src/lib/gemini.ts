import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API Key is missing. Please configure it in the Secrets panel.");
  return new GoogleGenAI({ apiKey });
};

const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      // Check if it's a transient error (500, network error, etc.)
      const errorMessage = error.message?.toLowerCase() || "";
      const isTransient = 
        errorMessage.includes("rpc failed") || 
        errorMessage.includes("xhr error") || 
        errorMessage.includes("500") || 
        errorMessage.includes("network") ||
        errorMessage.includes("fetch") ||
        errorMessage.includes("quota exceeded"); // Optional: retry on quota if you want, but usually better to wait

      if (!isTransient) throw error;
      
      console.warn(`AI call failed (attempt ${i + 1}/${maxRetries}). Retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  throw lastError;
};

export interface AIChapter {
  title: string;
  points: {
    label: string;
    content: string;
    examples?: { question: string; answer: string }[];
    relationships: { target: string; type: string }[];
  }[];
}

const safeJsonParse = (text: string, fallback: any) => {
  try {
    // Sometimes the model wraps the JSON in markdown blocks
    const cleanedText = text.replace(/^```json\n/, '').replace(/\n```$/, '').trim();
    return JSON.parse(cleanedText);
  } catch (e: any) {
    // Try to fix truncated JSON by appending closing brackets/braces
    try {
      let fixedText = text.trim();
      
      if (fixedText.startsWith('[') || fixedText.startsWith('{')) {
        let inString = false;
        let escapeNext = false;
        let openBrackets = 0;
        let openBraces = 0;
        
        for (let i = 0; i < fixedText.length; i++) {
          const char = fixedText[i];
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          if (char === '"') {
            inString = !inString;
            continue;
          }
          if (!inString) {
            if (char === '[') openBrackets++;
            else if (char === ']') openBrackets--;
            else if (char === '{') openBraces++;
            else if (char === '}') openBraces--;
          }
        }
        
        if (inString) {
          if (escapeNext) {
            fixedText = fixedText.slice(0, -1);
          }
          fixedText += '"';
        }
        
        // Very basic fix for truncated JSON
        if (fixedText.endsWith(',')) fixedText = fixedText.slice(0, -1);
        
        for (let i = 0; i < openBraces; i++) fixedText += '}';
        for (let i = 0; i < openBrackets; i++) fixedText += ']';
        
        const result = JSON.parse(fixedText);
        console.warn("Successfully recovered truncated JSON response.");
        return result;
      }
    } catch (e2) {
      console.error("Failed to parse JSON response:", e);
      console.error("Raw text:", text);
      console.error("Failed to fix truncated JSON:", e2);
    }
    return fallback;
  }
};

export const analyzeContent = async (text: string, existingFramework?: string): Promise<AIChapter[]> => {
  const ai = getAI();
  let prompt = `Analyze the following course content and extract a structured knowledge hierarchy. 
    Return a list of chapters, each containing knowledge points. 
    
    CRITICAL INSTRUCTIONS FOR CONTENT EXTRACTION:
    1. KEEP ORIGINAL STRUCTURE: Maintain the original structure, headings, and flow of the courseware as much as possible. Do not over-summarize or aggressively condense the material.
    2. RETAIN KNOWLEDGE POINTS: Extract all detailed knowledge points, examples, and explanations present in the text. Avoid excessive extraction and simplification. The goal is to preserve the richness of the original content.
    3. For each knowledge point, provide its detailed content and its relationships to other points (e.g., "depends on", "part of", "contrast with").
    4. EXAMPLES: If the material contains example questions, practice problems, or exercises (e.g., "例题", "练习"), extract them into the 'examples' array of the SPECIFIC knowledge point they belong to. Do not group all examples at the top level if they belong to sub-points. Separate the question text and the answer/solution text.
    5. FORMATTING: When writing the 'content' for a knowledge point, if it contains multiple sentences, distinct concepts, or paragraphs, you MUST separate them using the special delimiter "[SPLIT]". The system uses this delimiter to automatically split the text into separate paragraphs. Do not output a single massive paragraph; use [SPLIT] to break it up logically.
    6. MATH FORMULAS: All mathematical formulas and symbols MUST be formatted using LaTeX and enclosed in dollar signs (use $...$ for inline formulas and $$...$$ for block formulas).
    7. PERFORMANCE: While retaining details, ensure your descriptions are focused. Avoid copying entire pages of text verbatim; instead, capture the complete meaning, all steps, and all examples in a structured way.`;

  if (existingFramework) {
    prompt += `
    
    EXISTING FRAMEWORK INTEGRATION: You are adding new material to an already existing course framework.
    Here is the existing framework:
    ${existingFramework}
    
    If the new material contains information that logically belongs to one of the EXISTING chapters or points listed above, you MUST use the EXACT SAME 'title' (for chapters) or 'label' (for points) as the existing one. This allows the system to merge the new content into the existing structure.
    If the new material contains entirely new concepts that do not fit into the existing framework, create new chapters/points with new titles/labels.`;
  }

  prompt += `
    
    Content:
    ${text.substring(0, 15000)} // Limit for safety
    `;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            points: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  content: { type: Type.STRING },
                  examples: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        question: { type: Type.STRING },
                        answer: { type: Type.STRING }
                      },
                      required: ["question", "answer"]
                    }
                  },
                  relationships: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        target: { type: Type.STRING },
                        type: { type: Type.STRING }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }));

  const parsed = safeJsonParse(response.text || "[]", []);
  if (!Array.isArray(parsed) && parsed && typeof parsed === 'object') {
    const possibleArray = Object.values(parsed).find(val => Array.isArray(val));
    if (possibleArray) {
      return possibleArray as AIChapter[];
    }
  }
  return Array.isArray(parsed) ? parsed : [];
};

export const generateCourseFramework = async (syllabus: string): Promise<AIChapter[]> => {
  const ai = getAI();
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on the following syllabus/outline, generate a structured knowledge framework for a course.
    Break it down into chapters and key knowledge points.
    
    MATH FORMULAS: All mathematical formulas and symbols MUST be formatted using LaTeX and enclosed in dollar signs (use $...$ for inline formulas and $$...$$ for block formulas).

    Syllabus:
    ${syllabus}
    `,
    config: {
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            points: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  content: { type: Type.STRING },
                  examples: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        question: { type: Type.STRING },
                        answer: { type: Type.STRING }
                      },
                      required: ["question", "answer"]
                    }
                  },
                  relationships: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        target: { type: Type.STRING },
                        type: { type: Type.STRING }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }));

  const parsed = safeJsonParse(response.text || "[]", []);
  if (!Array.isArray(parsed) && parsed && typeof parsed === 'object') {
    const possibleArray = Object.values(parsed).find(val => Array.isArray(val));
    if (possibleArray) {
      return possibleArray as AIChapter[];
    }
  }
  return Array.isArray(parsed) ? parsed : [];
};



export const parseMaterialToMarkdown = async (text: string): Promise<string> => {
  const ai = getAI();
  const prompt = `请将以下课件内容解析并重新格式化为Markdown文档。
解析要求如下：
1）按照文档中的知识点层级生成对应层级的标题（使用Markdown的 #, ##, ### 等）；
2）将正文内容按照数字编号分级写入对应层级标题下方；
3）最终生成标准的Markdown格式文档；
4）所有数学公式和符号必须使用LaTeX格式并带有$号（行内公式使用$..$，独立公式使用$$..$$）；
5）**重要：请尽量保持课件原有的结构和所有的知识点细节，不要做过多的提炼、删减和精简。保留原有的例子、解释和详细描述。**

课件内容：
${text.substring(0, 15000)}
`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      maxOutputTokens: 8192,
    }
  }));

  return response.text || text;
};

export interface ExtractedPoint {
  label: string;
  content: string;
  notes?: { title?: string; content: string }[];
  examples?: { question: string; answer: string }[];
  subPoints?: ExtractedPoint[];
}

export const analyzeMaterialForNode = async (text: string, nodeType: 'chapter' | 'point', nodeLabel: string, existingFramework?: string): Promise<ExtractedPoint[]> => {
  const ai = getAI();
  let prompt = `Analyze the following material for the knowledge node "${nodeLabel}". 
  
  CRITICAL INSTRUCTIONS FOR PARSING:
  1. KEEP ORIGINAL STRUCTURE AND DETAILS: Maintain the original structure, headings, and flow of the courseware as much as possible. Extract all detailed knowledge points, examples, and explanations. Do not over-summarize, aggressively condense, or omit details.
  2. Extract headings and titles to form a hierarchical tree of knowledge nodes.
  3. Top-level headings in the material should be the top-level ExtractedPoints.
  4. Lower-level headings (e.g., "### （一）...") should be nested inside the 'subPoints' array of their parent heading.
  5. DO NOT create separate knowledge nodes for the body text, paragraphs, or numbered lists under a heading. 
  6. ALL body text, paragraphs, and numbered lists immediately following a heading MUST be written into the 'notes' array of THAT heading's knowledge node.
  7. For the 'notes' array, segment the body text based on numbering or distinct paragraphs.
  8. If the material doesn't have clear headings, treat the whole material as belonging to a single point and segment its body into notes.
  9. IMPORTANT: Do NOT include the sequence number or the title in the 'content' field of the notes. The 'content' should ONLY contain the actual body text.
  10. EXAMPLES: If the material contains example questions, practice problems, or exercises (e.g., "例题", "练习"), extract them into the 'examples' array of the SPECIFIC heading/knowledge point they belong to. Do not group all examples at the top level if they belong to sub-points. Separate the question text and the answer/solution text. Do NOT put examples in the 'notes' array.
  11. CRITICAL: When writing the 'content' of a note or example, if it contains multiple sentences, distinct points, or paragraphs, you MUST separate them using the special delimiter "[SPLIT]". The system uses this delimiter to automatically split the text into separate paragraphs. Do not output a single massive paragraph; use [SPLIT] to break it up logically.
  12. MATH FORMULAS: All mathematical formulas and symbols MUST be formatted using LaTeX and enclosed in dollar signs (use $...$ for inline formulas and $$...$$ for block formulas).
  13. PERFORMANCE: While retaining details, ensure your notes are focused. Avoid copying entire pages of text verbatim; instead, capture the complete meaning, all steps, and all examples in a structured way.`;

  if (existingFramework) {
    prompt += `
  
  10. EXISTING FRAMEWORK INTEGRATION: You are adding new material to an already existing knowledge framework.
  Here is the existing framework for this node:
  ${existingFramework}
  
  If the new material contains information that logically belongs to one of the EXISTING points or sub-points listed above, you MUST use the EXACT SAME 'label' as the existing point. This allows the system to merge the new notes into the existing point.
  If the new material contains entirely new concepts that do not fit into the existing framework, create new points/sub-points with new labels.`;
  }

  prompt += `
  
  EXAMPLE:
  If the text is:
  "## 三、数据结构的形式化定义
  一些介绍性的正文内容。
  ### （一）核心概念
  1. 基本形式化定义：$Data Structure = (D, S)$，其中$D$代表数据对象，$S$代表数据对象中元素间的关系集合
  2. 典型衍生结构定义示例
      - 复数结构：$Complex = (C, R)$"
  
  You MUST output:
  [
    {
      "label": "数据结构的形式化定义",
      "content": "数据结构的形式化定义",
      "notes": [
        {
          "title": "介绍",
          "content": "一些介绍性的正文内容。"
        }
      ],
      "subPoints": [
        {
          "label": "（一）核心概念",
          "content": "核心概念及其定义",
          "notes": [
            {
              "title": "1. 基本形式化定义",
              "content": "$Data Structure = (D, S)$，其中$D$代表数据对象，$S$代表数据对象中元素间的关系集合"
            },
            {
              "title": "2. 典型衍生结构定义示例",
              "content": "- 复数结构：$Complex = (C, R)$"
            }
          ],
          "examples": [
            {
              "question": "例题：什么是数据结构？",
              "answer": "数据结构是相互之间存在一种或多种特定关系的数据元素的集合。"
            }
          ]
        }
      ]
    }
  ]
  
  Return a list of ExtractedPoints. Each point represents a top-level heading found in the material, and its 'subPoints' array contains nested headings. The 'notes' array contains the detailed, segmented body content. The 'examples' array contains any example questions and answers.`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `${prompt}
    
    Material:
    ${text.substring(0, 15000)}
    `,
    config: {
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING, description: "The heading or title of the point" },
            content: { type: Type.STRING, description: "A brief summary of this point" },
            notes: {
              type: Type.ARRAY,
              description: "Segmented body content under this heading",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Optional title for the note, e.g., '1.', 'Definition'" },
                  content: { type: Type.STRING, description: "The detailed content of the note segment" }
                },
                required: ["content"]
              }
            },
            examples: {
              type: Type.ARRAY,
              description: "Example questions and answers under this heading",
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING, description: "The question text" },
                  answer: { type: Type.STRING, description: "The answer or solution text" }
                },
                required: ["question", "answer"]
              }
            },
            subPoints: {
              type: Type.ARRAY,
              description: "Nested sub-headings under this heading",
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  content: { type: Type.STRING },
                  notes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        content: { type: Type.STRING }
                      },
                      required: ["content"]
                    }
                  },
                  examples: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        question: { type: Type.STRING },
                        answer: { type: Type.STRING }
                      },
                      required: ["question", "answer"]
                    }
                  },
                  subPoints: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        label: { type: Type.STRING },
                        content: { type: Type.STRING },
                        notes: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              title: { type: Type.STRING },
                              content: { type: Type.STRING }
                            },
                            required: ["content"]
                          }
                        },
                        examples: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              question: { type: Type.STRING },
                              answer: { type: Type.STRING }
                            },
                            required: ["question", "answer"]
                          }
                        }
                      },
                      required: ["label", "content"]
                    }
                  }
                },
                required: ["label", "content"]
              }
            }
          },
          required: ["label", "content"]
        }
      }
    }
  }));

  const parsed = safeJsonParse(response.text || "[]", []);
  if (!Array.isArray(parsed) && parsed && typeof parsed === 'object') {
    const possibleArray = Object.values(parsed).find(val => Array.isArray(val));
    if (possibleArray) {
      return possibleArray as ExtractedPoint[];
    }
  }
  return Array.isArray(parsed) ? parsed : [];
};

export interface OutlinePoint {
  label: string;
  content: string;
  subPoints?: OutlinePoint[];
}

export const generateFrameworkFromOutline = async (outlineText: string, chapterName: string): Promise<OutlinePoint[]> => {
  const ai = getAI();
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on the following outline material for the chapter "${chapterName}", extract and generate a structured list of key knowledge points to build an initial knowledge framework. 
    
    CRITICAL INSTRUCTION: You MUST strictly follow the knowledge hierarchy (heading levels) of the original document. 
    For example, if the document has "一、数据结构的实际应用案例" and under it "书目检索系统" and "计算机对弈问题", then "一、数据结构的实际应用案例" should be a top-level point, and the others should be its subPoints.
    Do not flatten the hierarchy if the original text has clear heading levels (e.g., I, II, 1, 2, a, b, etc.).
    For each point, provide a concise label and a brief description/content.
    MATH FORMULAS: All mathematical formulas and symbols MUST be formatted using LaTeX and enclosed in dollar signs (use $...$ for inline formulas and $$...$$ for block formulas).
    
    Outline Material:
    ${outlineText.substring(0, 15000)}
    `,
    config: {
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            content: { type: Type.STRING },
            subPoints: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  content: { type: Type.STRING },
                  relationships: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        target: { type: Type.STRING },
                        type: { type: Type.STRING }
                      }
                    }
                  },
                  subPoints: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        label: { type: Type.STRING },
                        content: { type: Type.STRING }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }));

  const parsed = safeJsonParse(response.text || "[]", []);
  if (!Array.isArray(parsed) && parsed && typeof parsed === 'object') {
    const possibleArray = Object.values(parsed).find(val => Array.isArray(val));
    if (possibleArray) {
      return possibleArray as OutlinePoint[];
    }
  }
  return Array.isArray(parsed) ? parsed : [];
};

export const askQuestion = async (question: string, graphContext: string, imageBase64?: string, history?: { role: 'user' | 'model', text: string }[]) => {
  const ai = getAI();
  
  let historyText = '';
  if (history && history.length > 0) {
    historyText = "Previous Conversation:\n" + history.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}`).join('\n\n') + "\n\n";
  }

  const promptText = `You are a professional learning assistant. Based on the following knowledge graph context and previous conversation, answer the user's latest question.
  If the user uploaded an image (e.g., an exam or homework question), please provide a detailed step-by-step solution.
  
  CRITICAL: When your answer mentions a specific knowledge point from the context, you MUST link to it using the format [知识点名称](node://节点ID). This allows the user to click the link to see details.
  
  At the end of your answer, explicitly list the relevant knowledge points from the context and explain how they apply to the question.
  Use the format: "知识点X：[知识点名称](node://节点ID) - 解释"
  
  MATH FORMULAS: All mathematical formulas and symbols MUST be formatted using LaTeX and enclosed in dollar signs (use $...$ for inline formulas and $$...$$ for block formulas).
  
  Context:
  ${graphContext}
  
  ${historyText}Latest Question:
  ${question}
  `;

  const parts: any[] = [{ text: promptText }];
  
  if (imageBase64) {
    let mimeType = "image/jpeg";
    let data = imageBase64;
    if (imageBase64.startsWith("data:")) {
      const match = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        data = match[2];
      }
    }
    parts.push({
      inlineData: {
        data,
        mimeType
      }
    });
  }

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: {
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answer: { type: Type.STRING, description: "The detailed answer, including markdown links to nodes like [Label](node://id)" },
          relevantNodes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of node IDs that are relevant to the answer"
          },
          summary: { type: Type.STRING }
        },
        required: ["answer", "relevantNodes"]
      }
    }
  }));

  const parsed = safeJsonParse(response.text || "{}", { answer: "抱歉，解析回答时出错。", relevantNodes: [] });
  return {
    answer: parsed.answer || "抱歉，解析回答时出错。",
    relevantNodes: parsed.relevantNodes || []
  };
};
