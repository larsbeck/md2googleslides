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

import Debug from 'debug';
import {OAuth2Client, Credentials} from 'google-auth-library';
import {authenticate} from '@google-cloud/local-auth';
import path from 'path';
import {mkdirpSync} from 'mkdirp';
import {LowSync} from 'lowdb';
import {JSONFileSync} from 'lowdb/node';
import {MemorySync} from 'lowdb';

const debug = Debug('md2gslides');

export interface AuthOptions {
  keyfilePath: string;
  filePath?: string;
}

/**
 * Handles the authorization flow using @google-cloud/local-auth.
 *
 * This automatically starts a temporary server, opens the browser,
 * catches the authorization code, and shuts down.
 *
 * @example
 *   var auth = new UserAuthorizer({
 *     keyfilePath: './client_id.json',
 *     filePath: '/path/to/persistent/token/storage'
 *   });
 *
 *   var credentials = auth.getUserCredentials('user@example.com', ['https://www.googleapis.com/auth/slides']);
 *   credentials.then(function(oauth2Client) {
 *     // Valid oauth2Client for use with google APIs.
 *   });
 */
export default class UserAuthorizer {
  private db: LowSync<Record<string, Credentials>>;
  private keyfilePath: string;

  /**
   * Initialize the authorizer.
   *
   * This may block briefly to ensure the token file exists.
   *
   * @param options
   */
  public constructor(options: AuthOptions) {
    this.db = UserAuthorizer.initDbSync(options?.filePath);
    this.db.read();
    this.keyfilePath = options.keyfilePath;
  }

  /**
   * Fetch credentials for the specified user.
   *
   * If no credentials are available, requests authorization.
   *
   * @param {String} user ID (email address) of user to get credentials for.
   * @param {String[]} scopes Authorization scopes to request
   * @returns {Promise.<google.auth.OAuth2>}
   */
  public async getUserCredentials(
    user: string,
    scopes: string[],
  ): Promise<OAuth2Client> {
    // Check if we have stored credentials
    const tokens = this.db.data[user];
    if (tokens) {
      debug('User previously authorized, refreshing');
      const oauth2Client = new OAuth2Client();
      oauth2Client.setCredentials(tokens);

      // Set up token refresh handler
      oauth2Client.on('tokens', (newTokens: Credentials) => {
        if (newTokens.refresh_token) {
          debug('Saving refresh token');
          this.db.data[user] = {...tokens, ...newTokens};
          this.db.write();
        }
      });

      try {
        await oauth2Client.getAccessToken();
        return oauth2Client;
      } catch (err) {
        debug('Failed to refresh token, will re-authenticate: %O', err);
        // Fall through to re-authenticate
      }
    }

    // Authenticate using @google-cloud/local-auth
    debug('Authenticating with @google-cloud/local-auth');
    const client = await authenticate({
      scopes: scopes,
      keyfilePath: this.keyfilePath,
    });

    // Store the credentials
    const credentials = client.credentials;
    if (credentials.refresh_token) {
      debug('Saving new credentials');
      this.db.data[user] = credentials;
      this.db.write();
    }

    // Set up token refresh handler for future refreshes
    client.on('tokens', (newTokens: Credentials) => {
      if (newTokens.refresh_token) {
        debug('Saving refresh token');
        this.db.data[user] = {...credentials, ...newTokens};
        this.db.write();
      }
    });

    // Convert to the OAuth2Client type used by this project
    // Both are compatible at runtime, just different imports
    return client as unknown as OAuth2Client;
  }

  /**
   * Initialzes the token database.
   *
   * @param {String} filePath Path to database, null if use in-memory DB only.
   * @returns {LowSync} database instance
   * @private
   */
  private static initDbSync<T>(filePath?: string): LowSync<Record<string, T>> {
    const defaultData: Record<string, T> = {};
    if (filePath) {
      const parentDir = path.dirname(filePath);
      mkdirpSync(parentDir);
      const adapter = new JSONFileSync<Record<string, T>>(filePath);
      return new LowSync(adapter, defaultData);
    } else {
      const adapter = new MemorySync<Record<string, T>>();
      return new LowSync(adapter, defaultData);
    }
  }
}
