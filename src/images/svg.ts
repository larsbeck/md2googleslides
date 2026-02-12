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
import sharp from 'sharp';
import tmp from 'tmp-promise';
import {ImageDefinition} from '../slides';
import assert from 'assert';
import fs from 'fs';
import puppeteer from 'puppeteer';

const debug = Debug('md2gslides');
tmp.setGracefulCleanup();

let browserInstance: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserInstance;
}

// Cleanup browser on process exit
process.on('exit', () => {
  if (browserInstance) {
    browserInstance.close().catch(() => {
      // Ignore errors during cleanup
    });
  }
});

async function renderSVG(image: ImageDefinition): Promise<string> {
  debug('Generating SVG', image);
  assert(image.source);

  // Save the SVG to a temporary file for debugging
  const svgPath = await tmp.tmpName({postfix: '.svg'});
  await fs.promises.writeFile(svgPath, image.source);
  debug('SVG saved to: %s', svgPath);

  // Convert SVG to PNG
  const pngPath = await tmp.tmpName({postfix: '.png'});

  // Check if SVG contains foreignObject (HTML content)
  if (image.source.includes('foreignObject')) {
    debug('SVG contains foreignObject, using Puppeteer for rendering');

    // Use Puppeteer to render HTML content in foreignObject
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      // Create an HTML page with the SVG embedded
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body {
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                background: white;
              }
              svg {
                display: block;
              }
            </style>
          </head>
          <body>
            ${image.source}
          </body>
        </html>
      `;

      await page.setContent(html, {waitUntil: 'networkidle0'});

      // Get the SVG dimensions
      const dimensions = await page.evaluate(() => {
        const svg = document.querySelector('svg');
        if (!svg) return {width: 800, height: 200};
        const rect = svg.getBoundingClientRect();
        return {
          width: Math.ceil(rect.width),
          height: Math.ceil(rect.height),
        };
      });

      // Set viewport to match SVG size
      await page.setViewport({
        width: dimensions.width,
        height: dimensions.height,
        deviceScaleFactor: 2, // 2x for better quality
      });

      // Take screenshot
      await page.screenshot({
        path: pngPath,
        type: 'png',
        omitBackground: false, // Include white background
      });

      debug('PNG rendered via Puppeteer to: %s', pngPath);
    } finally {
      await page.close();
    }
  } else {
    // Normal SVG without foreignObject - use Sharp for better performance
    const buffer = Buffer.from(image.source);
    // Use 300 DPI (typical print quality) instead of 2400 to avoid exceeding
    // Google Slides API's 2 million pixel limit for images.
    // At 300 DPI, an 800x200 SVG becomes ~3333x833 pixels (2.8M pixels).
    await sharp(buffer, {density: 300}).png().toFile(pngPath);
    debug('PNG rendered via Sharp to: %s', pngPath);
  }

  return pngPath;
}

export default renderSVG;
