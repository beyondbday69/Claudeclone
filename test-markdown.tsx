import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const md = `
| Language | Category |
|----------|----------|
| Python   | General  |
`;

const res = renderToStaticMarkup(
  <Markdown
    remarkPlugins={[remarkGfm]}
    components={{
      table(props: any) {
        console.log("TABLE CHILDREN:", JSON.stringify(props.children, null, 2));
        return <table></table>;
      }
    }}
  >
    {md}
  </Markdown>
);
