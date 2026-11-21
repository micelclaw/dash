import { test } from 'node:test';
import assert from 'node:assert/strict';
import { officeFileKind, officeFileTarget } from './office-file-target.js';

test('Drive secondary entries recognize Office extensions despite generic/text MIME', () => {
  const id = '22222222-2222-4222-8222-222222222222';
  for (const filename of ['legacy.RTF', 'data.csv', 'data.tsv', 'book.xlsx', 'slides.odp', 'letter.docx']) {
    assert.equal(officeFileTarget({ id, filename, mime_type: 'text/plain' }), `/office/edit/${id}`);
  }
  assert.equal(officeFileTarget({ id, filename: 'scan.PDF', mime_type: 'application/octet-stream' }), `/office/pdf/${id}`);
  for (const filename of ['notes.txt', 'index.html', 'readme.md', 'image.png']) {
    assert.equal(officeFileKind({ filename }), null);
  }
  assert.equal(officeFileTarget({ id: '/vfs/book.xlsx', filename: 'book.xlsx' }), null);
  assert.equal(officeFileTarget({ id, filename: 'folder.docx', is_directory: true }), null);
});
