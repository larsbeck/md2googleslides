#!/usr/bin/env node

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

const Promise = require('promise');
const fs = require('fs');
const path = require('path');
const ArgumentParser = require('argparse').ArgumentParser;
const UserAuthorizer = require('../lib/auth').default;
const SlideGenerator = require('../lib/slide_generator').default;
const opener = require('opener');

const SCOPES = [
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/drive',
];

const USER_HOME =
  process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
const STORED_CREDENTIALS_PATH = path.join(
  USER_HOME,
  '.md2googleslides',
  'credentials.json',
);
const STORED_CLIENT_ID_PATH = path.join(
  USER_HOME,
  '.md2googleslides',
  'client_id.json',
);

const parser = new ArgumentParser({
  add_help: true,
  description: 'Markdown to Slides converter',
});

parser.add_argument('--version', {
  action: 'version',
  version: '1.0.0',
});

parser.add_argument('file', {
  help: 'Path to markdown file to convert, If omitted, reads from stdin',
  nargs: '?',
});
parser.add_argument('-u', '--user', {
  help: 'Email address of user',
  required: false,
  dest: 'user',
  default: 'default',
});
parser.add_argument('-a', '--append', {
  dest: 'id',
  help: 'Appends slides to an existing presentation',
  required: false,
});
parser.add_argument('-e', '--erase', {
  dest: 'erase',
  action: 'store_true',
  help: 'Erase existing slides prior to appending.',
  required: false,
});
parser.add_argument('-s', '--style', {
  help: 'Name of highlight.js theme for code formatting',
  dest: 'style',
  required: false,
  default: 'default',
});
parser.add_argument('-t', '--title', {
  help: 'Title of the presentation',
  dest: 'title',
  required: false,
});
parser.add_argument('-c', '--copy', {
  help: 'Id of the presentation to copy and use as a base',
  dest: 'copy',
  required: false,
});
parser.add_argument('--use-fileio', {
  help: 'Acknolwedge local and generated images are uploaded to https://file.io',
  action: 'store_true',
  dest: 'useFileio',
  required: false,
});

const args = parser.parse_args();

function handleError(err) {
  console.log('Unable to generate slides:', err);
}

function authorizeUser() {
  // Google OAuth2 clients always have a secret, even if the client is an installed
  // application/utility such as this.  Of course, in such cases the "secret" is
  // actually publicly known; security depends entirely on the secrecy of refresh
  // tokens, which effectively become bearer tokens.

  // Load and parse client ID from client_id.json file. (Create
  // OAuth client ID from Credentials tab at console.developers.google.com
  // and download the credentials as client_id.json to ~/.md2googleslides

  // The new @google-cloud/local-auth package handles the OAuth flow automatically,
  // starting a temporary server, opening the browser, and shutting down automatically.
  const options = {
    keyfilePath: STORED_CLIENT_ID_PATH,
    filePath: STORED_CREDENTIALS_PATH,
  };
  const auth = new UserAuthorizer(options);
  return auth.getUserCredentials(args.user, SCOPES);
}

function buildSlideGenerator(oauth2Client) {
  const title = args.title || args.file;
  const presentationId = args.id;
  const copyId = args.copy;

  if (presentationId) {
    return SlideGenerator.forPresentation(oauth2Client, presentationId);
  } else if (copyId) {
    return SlideGenerator.copyPresentation(oauth2Client, title, copyId);
  } else {
    return SlideGenerator.newPresentation(oauth2Client, title);
  }
}

function eraseIfNeeded(slideGenerator) {
  if (args.erase || !args.id) {
    return slideGenerator.erase().then(() => {
      return slideGenerator;
    });
  } else {
    return Promise.resolve(slideGenerator);
  }
}

function loadCss(theme) {
  const cssPath = path.join(
    require.resolve('highlight.js'),
    '..',
    '..',
    'styles',
    theme + '.css',
  );
  const css = fs.readFileSync(cssPath, {encoding: 'UTF-8'});
  return css;
}

function generateSlides(slideGenerator) {
  let source;
  if (args.file) {
    source = path.resolve(args.file);
    // Set working directory relative to markdown file
    process.chdir(path.dirname(source));
  } else {
    source = 0;
  }
  const input = fs.readFileSync(source, {encoding: 'UTF-8'});
  const css = loadCss(args.style);

  return slideGenerator.generateFromMarkdown(input, {
    css: css,
    useFileio: args.useFileio,
  });
}

function displayResults(id) {
  const url = 'https://docs.google.com/presentation/d/' + id;
  console.log('Opening your presentation (%s)', url);
  opener(url);
}
authorizeUser()
  .then(buildSlideGenerator)
  .then(eraseIfNeeded)
  .then(generateSlides)
  .then(displayResults)
  .catch(handleError);
