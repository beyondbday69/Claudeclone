const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');
const start = css.indexOf('.markdown-body {');
if (start !== -1) {
    css = css.substring(0, start) + `.markdown-body {
  font-family: inherit;
  line-height: 1.7;
}
.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 {
  color: var(--color-app-textPrimary);
  font-weight: 600;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  line-height: 1.25;
}
.markdown-body h1 { font-size: 1.75em; }
.markdown-body h2 { font-size: 1.5em; }
.markdown-body h3 { font-size: 1.25em; }
.markdown-body h4 { font-size: 1.1em; }
.markdown-body p {
  margin-top: 0;
  margin-bottom: 1em;
  color: var(--color-app-textPrimary);
}
.markdown-body p:last-child {
  margin-bottom: 0;
}
.markdown-body pre {
  background-color: var(--color-app-codeBg);
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-top: 1em;
  margin-bottom: 1em;
  border: 1px solid var(--color-app-border);
}
.markdown-body code {
  background-color: var(--color-app-surfaceHover);
  color: var(--color-app-textPrimary);
  padding: 0.2em 0.4em;
  border-radius: 0.25rem;
  font-family: var(--font-mono);
  font-size: 0.85em;
}
.markdown-body pre code {
  background-color: transparent;
  color: inherit;
  padding: 0;
  border-radius: 0;
  font-size: 0.85em;
}
.markdown-body a {
  color: var(--color-app-accent);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}
.markdown-body a:hover {
  text-decoration-thickness: 2px;
}
.markdown-body ul, .markdown-body ol {
  padding-left: 1.5rem;
  margin-top: 0;
  margin-bottom: 1em;
  color: var(--color-app-textPrimary);
}
.markdown-body ul {
  list-style-type: disc;
}
.markdown-body ol {
  list-style-type: decimal;
}
.markdown-body li + li {
  margin-top: 0.25em;
}
.markdown-body blockquote {
  margin: 1em 0;
  padding-left: 1rem;
  border-left: 4px solid var(--color-app-borderLight);
  color: var(--color-app-textSecondary);
  font-style: italic;
}
.markdown-body table {
  width: 100%;
  margin-bottom: 1em;
  border-collapse: collapse;
}
.markdown-body th, .markdown-body td {
  padding: 0.5rem;
  border: 1px solid var(--color-app-borderLight);
  text-align: left;
}
.markdown-body th {
  background-color: var(--color-app-surface);
  font-weight: 600;
}
`;
    fs.writeFileSync('src/index.css', css);
}
