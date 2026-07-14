const fs = require('fs');
const path = 'src/components/AgentPanel.tsx';
let code = fs.readFileSync(path, 'utf-8');

// The vertical line
code = code.replace(
  '<div className="absolute left-[3px] top-[18px] bottom-[-10px] w-[1px] bg-app-border/60 z-0"></div>',
  '<div className="absolute left-[3px] top-[18px] -bottom-[11px] w-[1px] bg-app-border/60 z-0"></div>'
);

// The dot
code = code.replace(
  '<div className="absolute left-[0px] top-[11px] w-[7px] h-[7px] rounded-full bg-[#32302e] border-[1.5px] border-[#32302e] z-10 group-hover:bg-app-textPrimary transition-colors"></div>',
  '<div className="absolute left-[0px] top-[11px] w-[7px] h-[7px] rounded-full bg-app-main border border-app-textMuted z-10 group-hover:border-app-textPrimary transition-colors"></div>'
);

fs.writeFileSync(path, code);
