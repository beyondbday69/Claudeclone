const fs = require('fs');
const path = 'src/components/AgentPanel.tsx';
let code = fs.readFileSync(path, 'utf-8');

const oldTryCatch = `  let resultStr = toolResultMsg ? toolResultMsg.content : "";
  try {
    if (resultStr) {
       const parsedRes = JSON.parse(resultStr);
       if (parsedRes.error) {
          resultStr = parsedRes.error;
       } else if (parsedRes.message) {
          resultStr = parsedRes.message;
       } else if (parsedRes.content) {
          resultStr = typeof parsedRes.content === 'string' ? parsedRes.content : JSON.stringify(parsedRes.content, null, 2);
       } else if (parsedRes.success !== undefined && Object.keys(parsedRes).length === 1) {
          resultStr = "Success";
       } else {
          resultStr = JSON.stringify(parsedRes, null, 2);
       }
    }
  } catch(e) {}`;

const newTryCatch = `  let resultStr = toolResultMsg ? toolResultMsg.content : "";
  try {
    if (resultStr) {
       const parsedRes = JSON.parse(resultStr);
       if (parsedRes.error) {
          resultStr = parsedRes.error;
       } else if (parsedRes.message) {
          resultStr = parsedRes.message;
       } else if (parsedRes.content) {
          if (typeof parsedRes.content === 'string') {
             resultStr = parsedRes.content;
          } else if (Array.isArray(parsedRes.content)) {
             resultStr = parsedRes.content.map((c: any) => c.text || JSON.stringify(c)).join('\\n');
          } else {
             resultStr = JSON.stringify(parsedRes.content, null, 2);
          }
       } else if (parsedRes.success !== undefined && Object.keys(parsedRes).length === 1) {
          resultStr = "Success";
       } else {
          resultStr = JSON.stringify(parsedRes, null, 2);
       }
    }
  } catch(e) {}`;

code = code.replace(oldTryCatch, newTryCatch);
fs.writeFileSync(path, code);
console.log("Replaced");
