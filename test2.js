const text = `{
  "answer": "这是一道关于计算机组成原理中**定点除法运算**的题目。要求使用**加减交替法**（又称**不恢复余数法**）计算 $15 \\\\div (-4)$。我们将该过程分为符号确定、数值位除法以及结果整合三个步骤。\\n\\n### 1. 确定符号与数值\\n*   **真值**: $x = +15$, $y = -4$。\\n*   **原码表示**: 假设采用 5 位字长（含 1 位符号位）。\\n    *   $[x]_原 = 0,1111$\\n    *   $[y]_原 = 1,0100$\\n*   **商的符号**: $Q_s = x_0 \\\\oplus y_0 = 0 \\\\oplus 1 = 1$（结果为负）。\\n*   **绝对值**: $|x| = 1111_B$，$|y| = 0100_B$。\\n\\n### 2. 数值位除法（加减交替法）\\n为了演示清晰，我们令 $x^* = 0.1111$，$y^* = 0.0100$，按照小数除法步骤进行（整数除法逻辑类似，仅权重不同）。\\n\\"
`;
try {
  JSON.parse(text);
} catch (e) {
  console.log("Error 1:", e.message);
}

const safeJsonParse = (text, fallback) => {
  try {
    const cleanedText = text.replace(/^```json\n/, '').replace(/\n```$/, '').trim();
    return JSON.parse(cleanedText);
  } catch (e) {
    try {
      let fixedText = text.trim();
      
      let inString = false;
      let escapeNext = false;
      for (let i = 0; i < fixedText.length; i++) {
        const char = fixedText[i];
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === '\\\\') {
          escapeNext = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
        }
      }
      
      if (inString) {
        if (fixedText.endsWith('\\\\')) {
          fixedText = fixedText.slice(0, -1);
        }
        fixedText += '"';
      }

      if (fixedText.startsWith('[') || fixedText.startsWith('{')) {
        inString = false;
        escapeNext = false;
        let openBrackets = 0;
        let openBraces = 0;
        
        for (let i = 0; i < fixedText.length; i++) {
          const char = fixedText[i];
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          if (char === '\\\\') {
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
