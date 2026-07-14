import React from "react";
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'm3e-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { variant?: string };
    }
  }
}
