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

import mockfs from 'mock-fs';
import nock from 'nock';
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import UserAuthorizer from '../src/auth';

// Store reference to node_modules for mock-fs
const nodeModulesPath = path.resolve(__dirname, '../node_modules');

function stubTokenRequest(): void {
  nock('https://oauth2.googleapis.com').post('/token').reply(200, {
    access_token: 'new_token',
    expires_in: 3920,
    token_type: 'Bearer',
  });
}

function stubTokenRequestError(): void {
  nock('https://oauth2.googleapis.com').post('/token').reply(400, {
    error_description: 'Bad Request',
    error: 'invalid_grant',
  });
}

describe('UserAuthorizer', () => {
  beforeEach(() => {
    mockfs({
      '/tmp/tokens.json': JSON.stringify({
        expired: {
          access_token: 'ya29.123',
          token_type: 'Bearer',
          expiry_date: 1,
          refresh_token: '1/abc',
        },
        current: {
          access_token: 'ya29.123',
          token_type: 'Bearer',
          expiry_date: Date.now() + 1000 * 60 * 60,
          refresh_token: '1/abc',
        },
      }),
      // Include node_modules to allow dynamic imports
      [nodeModulesPath]: mockfs.load(nodeModulesPath),
    });
  });

  afterEach(mockfs.restore);

  it('should ensure DB dir exists', () => {
    const options = {
      clientId: '123',
      clientSecret: 'abc',
      filePath: '/not_a_real_dir/token.json',
      prompt: () => Promise.resolve('code'),
    };
    new UserAuthorizer(options);
    assert.doesNotThrow(() => fs.accessSync('/not_a_real_dir'));
  });

  describe('with valid configuration', () => {
    const options = {
      clientId: '123',
      clientSecret: 'abc',
      filePath: '/tmp/tokens.json',
      prompt: () => Promise.reject(new Error('Prompt not expected')),
    };

    describe('with no saved token', () => {
      it('should report error if no code provided', async () => {
        const authorizer = new UserAuthorizer({
          ...options,
          prompt: () => Promise.resolve('code'),
        });
        const credentials = authorizer.getUserCredentials(
          'user@example.com',
          'https://www.googleapis.com/auth/slides',
        );
        await assert.rejects(credentials);
      });

      it('should report error if invalid code provided', async () => {
        stubTokenRequestError();
        const authorizer = new UserAuthorizer({
          ...options,
          prompt: () => Promise.resolve('not a valid code'),
        });
        const credentials = authorizer.getUserCredentials(
          'user@example.com',
          'https://www.googleapis.com/auth/slides',
        );
        await assert.rejects(credentials);
      });

      it('should exchange the code if provided', async () => {
        stubTokenRequest();
        const authorizer = new UserAuthorizer({
          ...options,
          prompt: () => Promise.resolve('code'),
        });
        const credentials = authorizer.getUserCredentials(
          'user@example.com',
          'https://www.googleapis.com/auth/slides',
        );
        const result = await credentials;
        assert.strictEqual(result.credentials.access_token, 'new_token');
      });
    });

    describe('with saved token', () => {
      it('should return token if still current', async () => {
        const authorizer = new UserAuthorizer(options);
        const credentials = authorizer.getUserCredentials(
          'current',
          'https://www.googleapis.com/auth/slides',
        );
        const result = await credentials;
        assert.strictEqual(result.credentials.access_token, 'ya29.123');
      });

      it('should refresh token if expired', async () => {
        stubTokenRequest();
        const authorizer = new UserAuthorizer(options);
        const credentials = authorizer.getUserCredentials(
          'expired',
          'https://www.googleapis.com/auth/slides',
        );
        const result = await credentials;
        assert.strictEqual(result.credentials.access_token, 'new_token');
      });
    });
  });
});
