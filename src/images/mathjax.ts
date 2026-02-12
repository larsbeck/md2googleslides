// Copyright 2019 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import Debug from 'debug';
import katex from 'katex';
import renderSVG from './svg';
import {ImageDefinition} from '../slides';
import assert from 'assert';

const debug = Debug('md2gslides');

// KaTeX CSS styles needed for proper rendering
const KATEX_CSS = `
.katex {
  font: normal 1.21em KaTeX_Main, Times New Roman, serif;
  line-height: 1.2;
  text-indent: 0;
  text-rendering: auto;
}
.katex * {
  -ms-high-contrast-adjust: none !important;
  border-color: currentColor;
}
.katex .katex-mathml {
  position: absolute;
  clip: rect(1px, 1px, 1px, 1px);
  padding: 0;
  border: 0;
  height: 1px;
  width: 1px;
  overflow: hidden;
}
.katex .base {
  position: relative;
  display: inline-block;
  white-space: nowrap;
  width: min-content;
}
.katex .strut {
  display: inline-block;
}
.katex .mord,
.katex .mop,
.katex .mbin,
.katex .mrel,
.katex .mopen,
.katex .mclose,
.katex .mpunct,
.katex .minner {
  display: inline-block;
}
.katex .mord + .mop,
.katex .mord + .mrel,
.katex .mord + .mbin {
  margin-left: 0.16667em;
}
.katex .mbin + .mord,
.katex .mbin + .mop,
.katex .mbin + .mopen,
.katex .mbin + .minner {
  margin-left: 0.16667em;
}
.katex .mrel + .mord,
.katex .mrel + .mop,
.katex .mrel + .mopen,
.katex .mrel + .minner {
  margin-left: 0.16667em;
}
.katex .mop + .mord,
.katex .mop + .mop,
.katex .mop + .mopen,
.katex .mop + .minner {
  margin-left: 0.16667em;
}
.katex .mclose + .mop,
.katex .mclose + .mbin,
.katex .mclose + .mrel,
.katex .mclose + .minner,
.katex .mpunct + .mord,
.katex .mpunct + .mop,
.katex .mpunct + .mopen,
.katex .mpunct + .mclose,
.katex .mpunct + .mpunct,
.katex .mpunct + .minner {
  margin-left: 0.16667em;
}
.katex .minner + .mord,
.katex .minner + .mop,
.katex .minner + .mbin,
.katex .minner + .mrel,
.katex .minner + .mopen,
.katex .minner + .mpunct,
.katex .minner + .minner {
  margin-left: 0.16667em;
}
.katex .mord + .minner {
  margin-left: 0.16667em;
}
.katex .nulldelimiter {
  display: inline-block;
  width: 0;
}
.katex .delimsizing {
  display: inline-block;
}
.katex .sizing,
.katex .fontsize-ensurer {
  display: inline-block;
}
.katex .op-symbol {
  position: relative;
}
.katex .op-symbol.small-op {
  font-family: KaTeX_Size1;
}
.katex .op-symbol.large-op {
  font-family: KaTeX_Size2;
}
.katex .accent > .vlist-t {
  text-align: center;
}
.katex .accent .accent-body {
  position: relative;
}
.katex .frac-line {
  display: inline-block;
  width: 100%;
  border-bottom-style: solid;
  border-bottom-width: 0.04em;
}
.katex .sqrt > .root {
  margin-left: 0.27777778em;
  margin-right: -0.55555556em;
}
.katex .vlist-t {
  display: inline-table;
  table-layout: fixed;
  border-collapse: collapse;
}
.katex .vlist-r {
  display: table-row;
}
.katex .vlist {
  display: table-cell;
  vertical-align: bottom;
  position: relative;
}
.katex .vlist > span {
  display: block;
  height: 0;
  position: relative;
}
.katex .vlist > span > span {
  display: inline-block;
}
.katex .vlist-s {
  display: table-cell;
  vertical-align: bottom;
  font-size: 1px;
  width: 1px;
  min-width: 1px;
}
.katex .vlist-t2 {
  margin-right: -2px;
}
`;

function addOrMergeStyles(svg: string, style?: string): string {
  if (!style) {
    return svg;
  }
  const match = svg.match(/(<svg[^>]+)(style="([^"]+)")([^>]+>)/);
  if (match) {
    return (
      svg.slice(0, match[1].length) +
      `style="${style};${match[3]}"` +
      svg.slice(match[1].length + match[2].length)
    );
  } else {
    const i = svg.indexOf('>');
    return svg.slice(0, i) + ` style="${style}"` + svg.slice(i);
  }
}

/**
 * Renders a math expression using KaTeX and wraps it in an SVG for rasterization.
 * KaTeX outputs HTML, so we embed it in an SVG foreignObject.
 */
async function renderMath(image: ImageDefinition): Promise<string> {
  debug('Generating math image: %O', image);
  assert(image.source);

  const expression = image.source.trim();

  // Render with KaTeX
  const html = katex.renderToString(expression, {
    throwOnError: false,
    displayMode: true,
    output: 'html',
  });

  // Create an SVG with embedded HTML using foreignObject
  // We use a large viewport and let the content determine size
  const width = 800;
  const height = 200;
  const scale = 5; // Scale factor similar to MathJax's scale: 500

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style type="text/css">
      ${KATEX_CSS}
      .katex { font-size: ${scale}em; color: #000; }
    </style>
  </defs>
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: center; justify-content: center; height: 100%;">
      ${html}
    </div>
  </foreignObject>
</svg>`;

  image.source = addOrMergeStyles(svg, image.style);
  image.type = 'svg';
  return await renderSVG(image);
}

export default renderMath;
