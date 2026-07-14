const query = "test";
fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`)
  .then(res => res.text())
  .then(html => {
      const results = [];
      const snippetRegex = /<a class="result__snippet[^>]*>(.*?)<\/a>/g;
      const urlRegex = /<a class="result__url" href="([^"]+)">/g;
      const titleRegex = /<h2 class="result__title">.*?<a[^>]*>(.*?)<\/a>/gs;
      
      const snippets = [...html.matchAll(snippetRegex)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
      const urls = [...html.matchAll(urlRegex)].map(m => {
          const u = m[1];
          const uddgMatch = u.match(/uddg=([^&]+)/);
          return uddgMatch ? decodeURIComponent(uddgMatch[1]) : u;
      });
      const titles = [...html.matchAll(titleRegex)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
      
      for (let i = 0; i < Math.min(5, urls.length); i++) {
        results.push({
          title: titles[i] || '',
          url: urls[i] || '',
          snippet: snippets[i] || ''
        });
      }
      console.log(results);
  });
