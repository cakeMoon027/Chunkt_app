const text = `{
  "answer": "根据图片中的题目要求，我们需要使用 [Booth 算法](node://pt-2xfoe)（补码一位乘法）并采用双符号位来计算 $[x \\\\times y]_{补}$。  \\n\\n### 1. 确定操作数及其补码表示\\n*   **被乘数 $x$**：$x = -110_2 = -6_{10}$。  \\n    为了与乘数位数匹配，我们将其扩展为 4 位数值位。  \\n    $[x]_{原} = 1, 0110$  \\n    $[x]_{补} = 1, 1010$  \\n    **双符号位补码**：$[x]_{补}' = 11, 1010$  \\n    **对应相反数的补码**：$[-x]_{补}' = 00, 0110$（由 $[x]_{补}$ 连同符号位每位取反末位加 1 得到）。\\n*   **乘数 $y$**：$y = 1110_2 = -2_{10}$（作为 4 位有符号数处理）。  \\n    $[y]_{补} = 1110$。  \\n\\n### 2. 初始化参数\\n*   **部分积 $A$**：初始化为 $00, 0000$（双符号位）。\\n*   **乘数寄存器 $Q$**：存入 $[y]_{补} = 1110$。\\n*   **附加位 $Q_{n+1}$**：初始化为 $0$。  \\n*   **计数器 $n$**：乘数位数为 4，共需进行 4 次循环。\\n\\n### 3. 运算过程（Booth 算法执行表）\\n根据 [Booth 算法计算要诀](node://pt-iigxu)，每步观察乘数末位 $Q_n$ 和附加位 $Q_{n+1}$：\\n- $01$：部分积 $A \\\\leftarrow A + [x]_{补}'$，然后算术右移。\\n- $10$：部分积 $A \\\\leftarrow A + [-x]_{补}'$，然后算术右移。\\n- $00$ 或 $11$：部分积 $A$ 不变，直接算术右移。\\n- **注意**：最后一步只进行加法，不移位。\\n\\n| 步数 | 乘数位 $Q_n Q_{n+1}$ | 操作内容 | 部分积 $A$ | 乘数 $Q$ ($y_0 y_1 y_2 y_3$) | 附加位 $Q_4$ |\\n| :--- | :--- | :--- | :--- | :--- | :--- |\\n| 0 | | 初始状态 | $00, 0000$ | $1110$ | $0$ |\\n| 1 | $00$ | 右移 | $00, 0000$ | $0111$ | $0$ |\\n| 2 | $10$ | $+[-x]_{补}'$ | $00, 0110$ | $0111$ | $0$ |\\n| | | 右移 | $00, 0011$ | $0011$ | $1$ |\\n| 3 | $11$ | 右移 | $00, 0001$ | $1001$ | $1$ |\\n| 4 | $11$ | 不移位 | $00, 0001$ | $1001$ | $1$ |\\n\\n### 4. 结果计算\\n最终结果由寄存器 $A$ 和 $Q$ 合并组成。由于我们使用了扩展位且 Booth 算法最后一步不移位，最终 $[x \\\\times y]_{补}$ 的有效位为结果的后 8 位（对应 $x$ 和 $y$ 均为 4 位的情况）：  \\n拼接结果为：$000001, 1001$。  \\n取有效的 8 位乘积：$00001100_2$。  \\n\\n**验证**：$(-6) \\\\times (-2) = +12$。二进制 $12$ 的补码正是 $00001100_2$，计算结果正确。  \\n\\n---\\n\\n### 相关知识点\\n*   **知识点 1**：[Booth 算法](node://pt-2xfoe) - 这是计算补码一位乘法的核心算法`;

const safeJsonParse = (text, fallback) => {
  try {
    const cleanedText = text.replace(/^```json\n/, '').replace(/\n```$/, '').trim();
    return JSON.parse(cleanedText);
  } catch (e) {
    try {
      let fixedText = text.trim();
      
      if (e.message && e.message.includes('Unterminated string')) {
        if (fixedText.endsWith('\\\\')) {
          fixedText = fixedText.slice(0, -1);
        }
        fixedText += '"';
      }

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
      console.error("Raw text:", text);
      console.error("Failed to fix truncated JSON:", e2.message);
    }
    return fallback;
  }
};

console.log(safeJsonParse(text, {}));
