const text = '{"answer": "abc\\\\n\\\\';
try {
  JSON.parse(text);
} catch (e) {
  console.log("Error 1:", e.message);
}

try {
  JSON.parse(text + '"}');
} catch (e) {
  console.log("Error 2:", e.message);
}
