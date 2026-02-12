// Copyright 2016 Google Inc.
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

import assert from 'assert';
import path from 'path';
import GenericLayout from '../src/layout/generic_layout';
import jsonfile from 'jsonfile';
import {slides_v1} from 'googleapis';
import {SlideDefinition} from '../src/slides';

describe('GenericLayout', () => {
  const fixturePath = path.join(path.dirname(__dirname), 'test', 'fixtures');
  const presentation = jsonfile.readFileSync(
    path.join(fixturePath, 'mock_presentation.json'),
  );

  describe('with title slide', () => {
    const requests: slides_v1.Schema$Request[] = [];

    before(() => {
      const input: SlideDefinition = {
        objectId: 'title-slide',
        title: {
          rawText: 'This is a title slide',
          textRuns: [],
          listMarkers: [],
          big: false,
        },
        subtitle: {
          rawText: 'Your name here',
          textRuns: [],
          listMarkers: [],
          big: false,
        },
        bodies: [],
        tables: [],
        notes: {
          rawText: 'Speaker notes here.',
          textRuns: [],
          listMarkers: [],
          big: false,
        },
      };
      const layout = new GenericLayout('', presentation, input);
      layout.appendContentRequests(requests);
    });

    it('should insert title text', () => {
      assert.ok(
        requests.some(
          r =>
            r.insertText?.text === 'This is a title slide' &&
            r.insertText?.objectId === 'centered-title-element',
        ),
      );
    });

    it('should insert subtitle text', () => {
      assert.ok(
        requests.some(
          r =>
            r.insertText?.text === 'Your name here' &&
            r.insertText?.objectId === 'subtitle-element',
        ),
      );
    });

    it('should insert speaker notes', () => {
      assert.ok(
        requests.some(
          r =>
            r.insertText?.text === 'Speaker notes here.' &&
            r.insertText?.objectId === 'speaker-notes-element',
        ),
      );
    });
  });

  describe('with title & body slide', () => {
    const requests: slides_v1.Schema$Request[] = [];

    before(() => {
      const input: SlideDefinition = {
        objectId: 'body-slide',
        title: {
          rawText: 'Title & body slide',
          textRuns: [],
          listMarkers: [],
          big: false,
        },
        bodies: [
          {
            images: [],
            videos: [],
            text: {
              rawText: 'This is the slide body.\n',
              textRuns: [],
              listMarkers: [],
              big: false,
            },
          },
        ],
        tables: [],
      };
      const layout = new GenericLayout('', presentation, input);
      layout.appendContentRequests(requests);
    });

    it('should insert title text', () => {
      assert.ok(
        requests.some(
          r =>
            r.insertText?.text === 'Title & body slide' &&
            r.insertText?.objectId === 'title-element',
        ),
      );
    });

    it('should insert body text', () => {
      assert.ok(
        requests.some(
          r =>
            r.insertText?.text === 'This is the slide body.\n' &&
            r.insertText?.objectId === 'body-element',
        ),
      );
    });
  });

  describe('with two column slide', () => {
    const requests: slides_v1.Schema$Request[] = [];

    before(() => {
      const input: SlideDefinition = {
        objectId: 'two-column-slide',
        bodies: [
          {
            images: [],
            videos: [],
            text: {
              big: false,
              rawText: 'This is the left column\n',
              textRuns: [],
              listMarkers: [],
            },
          },
          {
            images: [],
            videos: [],
            text: {
              big: false,
              rawText: 'This is the right column\n',
              textRuns: [],
              listMarkers: [],
            },
          },
        ],
        tables: [],
      };
      const layout = new GenericLayout('', presentation, input);
      layout.appendContentRequests(requests);
    });

    it('should insert left column text', () => {
      assert.ok(
        requests.some(
          r =>
            r.insertText?.text === 'This is the left column\n' &&
            r.insertText?.objectId === 'body-element',
        ),
      );
    });

    it('should insert right column text', () => {
      assert.ok(
        requests.some(
          r =>
            r.insertText?.text === 'This is the right column\n' &&
            r.insertText?.objectId === 'body-element-2',
        ),
      );
    });
  });

  describe('with background images', () => {
    const requests: slides_v1.Schema$Request[] = [];

    before(() => {
      const input: SlideDefinition = {
        objectId: 'body-slide',
        backgroundImage: {
          url: 'https://placekitten.com/1600/900',
          width: 1600,
          height: 900,
          padding: 0,
          offsetX: 0,
          offsetY: 0,
        },
        bodies: [
          {
            images: [],
            videos: [],
            text: {
              big: false,
              rawText: '\n',
              textRuns: [],
              listMarkers: [],
            },
          },
        ],
        tables: [],
      };
      const layout = new GenericLayout('', presentation, input);
      layout.appendContentRequests(requests);
    });

    it('should set background image', () => {
      assert.ok(
        requests.some(
          r =>
            r.updatePageProperties?.objectId === 'body-slide' &&
            r.updatePageProperties?.fields ===
              'pageBackgroundFill.stretchedPictureFill.contentUrl' &&
            r.updatePageProperties?.pageProperties?.pageBackgroundFill
              ?.stretchedPictureFill?.contentUrl ===
              'https://placekitten.com/1600/900',
        ),
      );
    });
  });

  describe('with inline images', () => {
    const requests: slides_v1.Schema$Request[] = [];

    before(() => {
      const input: SlideDefinition = {
        objectId: 'body-slide',
        tables: [],
        bodies: [
          {
            videos: [],
            images: [
              {
                url: 'https://placekitten.com/350/315',
                width: 350,
                height: 315,
                padding: 0,
                offsetX: 0,
                offsetY: 0,
              },
            ],
            text: {
              rawText: '',
              big: false,
              listMarkers: [],
              textRuns: [],
            },
          },
        ],
      };
      const layout = new GenericLayout('', presentation, input);
      layout.appendContentRequests(requests);
    });

    it('should create image', () => {
      assert.ok(
        requests.some(
          r =>
            r.createImage?.elementProperties?.pageObjectId === 'body-slide' &&
            r.createImage?.url === 'https://placekitten.com/350/315',
        ),
      );
    });
  });

  describe('with video', () => {
    const requests: slides_v1.Schema$Request[] = [];

    before(() => {
      const input: SlideDefinition = {
        objectId: 'body-slide',
        bodies: [
          {
            videos: [
              {
                width: 1600,
                height: 900,
                autoPlay: true,
                id: 'MG8KADiRbOU',
              },
            ],
            images: [],
            text: {
              rawText: '',
              big: false,
              listMarkers: [],
              textRuns: [],
            },
          },
        ],
        tables: [],
      };
      const layout = new GenericLayout('', presentation, input);
      layout.appendContentRequests(requests);
    });

    it('should create video', () => {
      assert.ok(
        requests.some(
          r =>
            r.createVideo?.source === 'YOUTUBE' &&
            r.createVideo?.id === 'MG8KADiRbOU',
        ),
      );
    });
  });

  describe('with table', () => {
    const requests: slides_v1.Schema$Request[] = [];

    before(() => {
      const input: SlideDefinition = {
        objectId: 'body-slide',
        bodies: [],
        tables: [
          {
            rows: 5,
            columns: 2,
            cells: [
              [
                {
                  big: false,
                  rawText: 'Animal',
                  textRuns: [],
                  listMarkers: [],
                },
                {
                  big: false,
                  rawText: 'Number',
                  textRuns: [],
                  listMarkers: [],
                },
              ],
              [
                {
                  big: false,
                  rawText: 'Fish',
                  textRuns: [],
                  listMarkers: [],
                },
                {
                  big: false,
                  rawText: '142 million',
                  textRuns: [],
                  listMarkers: [],
                },
              ],
              [
                {
                  big: false,
                  rawText: 'Cats',
                  textRuns: [],
                  listMarkers: [],
                },
                {
                  big: false,
                  rawText: '88 million',
                  textRuns: [],
                  listMarkers: [],
                },
              ],
              [
                {
                  big: false,
                  rawText: 'Dogs',
                  textRuns: [],
                  listMarkers: [],
                },
                {
                  big: false,
                  rawText: '75 million',
                  textRuns: [],
                  listMarkers: [],
                },
              ],
              [
                {
                  big: false,
                  rawText: 'Birds',
                  textRuns: [],
                  listMarkers: [],
                },
                {
                  big: false,
                  rawText: '16 million',
                  textRuns: [],
                  listMarkers: [],
                },
              ],
            ],
          },
        ],
      };
      const layout = new GenericLayout('', presentation, input);
      layout.appendContentRequests(requests);
    });

    it('should create table', () => {
      assert.ok(
        requests.some(
          r =>
            r.createTable?.elementProperties?.pageObjectId === 'body-slide' &&
            r.createTable?.rows === 5 &&
            r.createTable?.columns === 2,
        ),
      );
    });

    it('should create table', () => {
      assert.ok(
        requests.some(
          r =>
            r.createTable?.elementProperties?.pageObjectId === 'body-slide' &&
            r.createTable?.rows === 5 &&
            r.createTable?.columns === 2,
        ),
      );
    });

    it('should insert cell text', () => {
      assert.ok(
        requests.some(
          r =>
            r.insertText?.text === 'Animal' &&
            r.insertText?.cellLocation?.rowIndex === 0 &&
            r.insertText?.cellLocation?.columnIndex === 0,
        ),
      );
    });
  });

  describe('with formatted text', () => {
    const requests: slides_v1.Schema$Request[] = [];

    before(() => {
      const input: SlideDefinition = {
        objectId: 'body-slide',
        bodies: [
          {
            images: [],
            videos: [],
            text: {
              big: false,
              rawText: 'Item 1\nItem 2\n\tfoo\n\tbar\n\tbaz\nItem 3\n',
              textRuns: [
                {
                  bold: true,
                  start: 0,
                  end: 4,
                },
                {
                  italic: true,
                  start: 7,
                  end: 11,
                },
                {
                  fontFamily: 'Courier New',
                  start: 29,
                  end: 33,
                },
              ],
              listMarkers: [
                {
                  start: 0,
                  end: 36,
                  type: 'unordered',
                },
              ],
            },
          },
        ],
        tables: [],
      };
      const layout = new GenericLayout('', presentation, input);
      layout.appendContentRequests(requests);
    });

    it('should apply bold style', () => {
      assert.ok(
        requests.some(
          r =>
            r.updateTextStyle?.objectId === 'body-element' &&
            r.updateTextStyle?.textRange?.type === 'FIXED_RANGE' &&
            r.updateTextStyle?.textRange?.startIndex === 0 &&
            r.updateTextStyle?.textRange?.endIndex === 4 &&
            r.updateTextStyle?.style?.bold === true &&
            r.updateTextStyle?.fields === 'bold',
        ),
      );
    });

    it('should apply italic style', () => {
      assert.ok(
        requests.some(
          r =>
            r.updateTextStyle?.objectId === 'body-element' &&
            r.updateTextStyle?.textRange?.type === 'FIXED_RANGE' &&
            r.updateTextStyle?.textRange?.startIndex === 7 &&
            r.updateTextStyle?.textRange?.endIndex === 11 &&
            r.updateTextStyle?.style?.italic === true &&
            r.updateTextStyle?.fields === 'italic',
        ),
      );
    });

    it('should apply font family style', () => {
      assert.ok(
        requests.some(
          r =>
            r.updateTextStyle?.objectId === 'body-element' &&
            r.updateTextStyle?.textRange?.type === 'FIXED_RANGE' &&
            r.updateTextStyle?.textRange?.startIndex === 29 &&
            r.updateTextStyle?.textRange?.endIndex === 33 &&
            r.updateTextStyle?.style?.fontFamily === 'Courier New' &&
            r.updateTextStyle?.fields === 'fontFamily',
        ),
      );
    });

    it('should create bulleted list', () => {
      assert.ok(
        requests.some(
          r =>
            r.createParagraphBullets?.objectId === 'body-element' &&
            r.createParagraphBullets?.textRange?.type === 'FIXED_RANGE' &&
            r.createParagraphBullets?.textRange?.startIndex === 0 &&
            r.createParagraphBullets?.textRange?.endIndex === 36 &&
            r.createParagraphBullets?.bulletPreset ===
              'BULLET_DISC_CIRCLE_SQUARE',
        ),
      );
    });
  });
});
