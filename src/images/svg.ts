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

const debug = Debug('md2gslides');
tmp.setGracefulCleanup();

async function renderSVG(image: ImageDefinition): Promise<string> {
  debug('Generating SVG', image);
  assert(image.source);
  const path = await tmp.tmpName({postfix: '.png'});
  const buffer = Buffer.from(image.source);
  // Use 300 DPI (typical print quality) instead of 2400 to avoid exceeding
  // Google Slides API's 2 million pixel limit for images.
  // At 300 DPI, an 800x200 SVG becomes ~3333x833 pixels (2.8M pixels).
  await sharp(buffer, {density: 300}).png().toFile(path);
  return path;
}

export default renderSVG;
