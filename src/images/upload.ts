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

import axios from 'axios';
import Debug from 'debug';
import fs from 'fs';
import FormData from 'form-data';

const debug = Debug('md2gslides');

/**
 * Uploads a local file to temporary storage so it is HTTP/S accessible.
 *
 * Currently uses https://tmpfiles.org for free ephemeral file hosting.
 * Files expire after 1 hour.
 *
 * @param {string} filePath -- Local path to image to upload
 * @returns {Promise<string>} URL to hosted image
 */
async function uploadLocalImage(filePath: string): Promise<string> {
  debug('Registering file %s', filePath);
  const stream = fs.createReadStream(filePath);
  try {
    const formData = new FormData();
    formData.append('file', stream);

    const res = await axios.post(
      'https://tmpfiles.org/api/v1/upload',
      formData,
      {
        headers: formData.getHeaders(),
      },
    );
    const responseData = res.data;
    if (responseData.status !== 'success' || !responseData.data?.url) {
      debug('Unable to upload file: %O', responseData);
      throw new Error(JSON.stringify(responseData));
    }
    // tmpfiles.org returns URLs like "http://tmpfiles.org/12345/file.png"
    // but the actual download URL is "https://tmpfiles.org/dl/12345/file.png"
    const uploadUrl = responseData.data.url;
    const downloadUrl = uploadUrl.replace(
      /^https?:\/\/tmpfiles\.org\//,
      'https://tmpfiles.org/dl/',
    );
    debug('Temporary link: %s', downloadUrl);
    return downloadUrl;
  } finally {
    stream.destroy();
  }
}

export default uploadLocalImage;
