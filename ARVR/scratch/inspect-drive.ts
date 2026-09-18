import { getDriveClientForAdmin } from '../lib/googleDrive';

async function checkDrive() {
  const { drive, connection, error } = await getDriveClientForAdmin();
  if (error || !drive) {
    console.error('Drive connection error:', error);
    return;
  }

  console.log('✅ Connected to Google Drive account:', connection?.googleAccountEmail);
  console.log('📁 Root Folder ID:', connection?.rootFolderId);

  const rootFolderId = connection?.rootFolderId;
  if (!rootFolderId) {
    console.log('No root folder ID configured.');
    return;
  }

  try {
    const rootMeta = await drive.files.get({
      fileId: rootFolderId,
      fields: 'id, name, mimeType',
    });
    console.log('Root Folder Name:', rootMeta.data.name);

    // List all children of Root folder
    const batchList = await drive.files.list({
      q: `'${rootFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, createdTime)',
    });

    console.log(`\nFound ${batchList.data.files?.length || 0} items inside Root Folder ("${rootMeta.data.name}"):`);

    for (const batchFolder of batchList.data.files || []) {
      console.log(`\n📁 [BATCH FOLDER] "${batchFolder.name}" (ID: ${batchFolder.id})`);

      // List contents of this batch folder (e.g. Day 1, Day 2, etc.)
      const dayList = await drive.files.list({
        q: `'${batchFolder.id}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, createdTime)',
      });

      if (!dayList.data.files || dayList.data.files.length === 0) {
        console.log('   (Empty folder)');
      }

      for (const dayItem of dayList.data.files || []) {
        if (dayItem.mimeType === 'application/vnd.google-apps.folder') {
          console.log(`   📂 [DAY FOLDER] "${dayItem.name}" (ID: ${dayItem.id})`);

          // List files inside Day folder
          const filesList = await drive.files.list({
            q: `'${dayItem.id}' in parents and trashed = false`,
            fields: 'files(id, name, size, mimeType, webViewLink, createdTime)',
          });

          if (!filesList.data.files || filesList.data.files.length === 0) {
            console.log('      (No files in this day folder)');
          }

          for (const file of filesList.data.files || []) {
            console.log(`      📄 [TASK SUBMISSION FILE] "${file.name}" | Size: ${file.size || 'N/A'} bytes | Created: ${file.createdTime}`);
            console.log(`         View Link: ${file.webViewLink}`);
          }
        } else {
          console.log(`   📄 [FILE] "${dayItem.name}" (Size: ${dayItem.size || 'N/A'})`);
        }
      }
    }
  } catch (err: any) {
    console.error('Google Drive inspection error:', err.message);
  }
}

checkDrive().catch(console.error);
