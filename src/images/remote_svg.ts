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
import axios from 'axios';
import {ImageDefinition} from '../slides';
import renderSVG from './svg';

const debug = Debug('md2gslides');

/**
 * Downloads a remote SVG file and converts it to PNG.
 * This is necessary because Google Slides API has issues directly
 * fetching some remote SVG URLs (like GitHub raw content).
 *
 * @param {ImageDefinition} image Image definition with URL pointing to SVG
 * @returns {Promise<ImageDefinition>} Image with updated URL pointing to local PNG
 */
async function convertRemoteSVG(
  image: ImageDefinition,
): Promise<ImageDefinition> {
  if (!image.url) {
    return image;
  }

  // Check if URL ends with .svg or .SVG
  if (!image.url.toLowerCase().endsWith('.svg')) {
    return image;
  }

  // Skip file:// URLs (already local)
  if (image.url.startsWith('file://')) {
    return image;
  }

  debug('Downloading remote SVG: %s', image.url);

  try {
    // Download SVG content
    const response = await axios.get(image.url, {
      responseType: 'text',
      headers: {
        'User-Agent': 'md2gslides',
      },
      timeout: 30000, // 30 second timeout
    });

    const svgContent = response.data;

    // Validate that it's actually SVG content
    if (typeof svgContent !== 'string' || !svgContent.trim().includes('<svg')) {
      debug('URL does not contain SVG content, skipping conversion');
      return image;
    }

    debug('Downloaded SVG content (%d bytes)', svgContent.length);

    // Create a temporary image definition with the SVG source
    const tempImage: ImageDefinition = {
      ...image,
      source: svgContent,
      type: 'svg',
    };

    // Use the existing SVG renderer to convert to PNG
    const pngPath = await renderSVG(tempImage);
    image.url = 'file://' + pngPath;

    debug('Converted remote SVG to local PNG: %s', image.url);
    return image;
  } catch (err) {
    debug('Failed to download or convert remote SVG: %O', err);
    // Return original image, let Google Slides try to handle it
    return image;
  }
}

export default convertRemoteSVG;
