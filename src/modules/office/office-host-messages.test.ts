import {test} from 'node:test';
import assert from 'node:assert/strict';
import {officeHostNavigation,officeHostFileId,officeCopiedFileRoute,officeHostRequestedFile,officeOpenedFileRoute} from './office-host-messages.js';
test('Office iframe navigation stays in its slot and current file',()=>{
 const file='22222222-2222-4222-8222-222222222222';
 assert.equal(officeHostNavigation('/office/new?type=xlsx','spreadsheets',file),'/office/new?type=xlsx');
 assert.equal(officeHostNavigation('/office/new?type=pdf','pdf',file),'/office/new?type=pdf');
 for(const path of ['https://attacker.invalid','//attacker.invalid','/office/new?type=docx','/office/new?type=xlsx&provider=other','/office/edit/33333333-3333-4333-8333-333333333333','/drive?token=x'])assert.equal(officeHostNavigation(path,'spreadsheets',file),null);
 assert.equal(officeHostNavigation('/office/edit/'+file,'spreadsheets',file),'/office/edit/'+file);
 assert(officeHostFileId(file));assert(!officeHostFileId('file/path'));
});
test('Recent is a Core-authorized open request, including a converted sibling and canonical PDF route',()=>{
 const source='22222222-2222-4222-8222-222222222222',copy='33333333-3333-4333-8333-333333333333';
 assert.equal(officeHostRequestedFile('/office/edit/'+source),source);
 for(const path of ['https://host.invalid/office/edit/'+source,'/office/edit/'+source+'?provider=other','/office/edit/../../secret'])assert.equal(officeHostRequestedFile(path),null);
 const converted={file_id:copy,provider:'documents',document_type:'word',source_file_id:source,converted:true};
 assert.equal(officeOpenedFileRoute(converted,source,'documents','documents'),'/office/edit/'+copy);
 for(const changed of [{...converted,converted:false},{...converted,source_file_id:copy},{...converted,provider:'unselected'},{...converted,document_type:'cell'}])assert.equal(officeOpenedFileRoute(changed,source,'documents','documents'),null);
 assert.equal(officeCopiedFileRoute({file_id:copy,provider:'pdf',document_type:'pdf'},copy,'pdf','pdf'),'/office/pdf/'+copy);
});
test('a copy uses its confirmed identity, provider and actual Core document type',()=>{
 const id='33333333-3333-4333-8333-333333333333',session={file_id:id,provider:'community-sheet',document_type:'cell'};
 assert.equal(officeCopiedFileRoute(session,id,'community-sheet','spreadsheets'),'/office/edit/'+id);
 for(const altered of [{...session,provider:'another-app'},{...session,file_id:'22222222-2222-4222-8222-222222222222'},{...session,document_type:'word'}])assert.equal(officeCopiedFileRoute(altered,id,'community-sheet','spreadsheets'),null);
});
