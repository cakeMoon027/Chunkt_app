import fs from 'fs';
const text = fs.readFileSync('raw.txt', 'utf8');

const safeJsonParse = (text, fallback) => {
  try {
    const cleanedText = text.replace(/^```json\n/, '').replace(/\n```$/, '').trim();
    return JSON.parse(cleanedText);
  } catch (e) {
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
        
        if (fixedText.endsWith(',')) fixedText = fixedText.slice(0, -1);
        
        for (let i = 0; i < openBraces; i++) fixedText += '}';
        for (let i = 0; i < openBrackets; i++) fixedText += ']';
        
        const result = JSON.parse(fixedText);
        console.warn("Successfully recovered truncated JSON response.");
        return result;
      }
    } catch (e2) {
      console.error("Failed to parse JSON response:", e.message);
      console.error("Failed to fix truncated JSON:", e2.message);
    }
    return fallback;
  }
};

console.log(safeJsonParse(text, {}));
