// 让我们确保文件结构完整
const fs = require('fs');
const path = require('path');

const filePath = './src-electron/utils/sftpManager.js';
const content = fs.readFileSync(filePath, 'utf8');

// 检查文件中是否有 status: 'uploading' 的设置
if (!content.includes('status: \'uploading\'')) {
  console.log('在 sftpManager.js 中添加 status: uploading 设置');
  
  // 寻找正确的位置并添加
  const updatedContent = content.replace(
    /progressCallback\(\{\s+sessionId,\s+fileName: path\.basename\(localPath\),\s+bytesTransferred: uploadedBytes,\s+totalBytes: fileSize,\s+percent\s+\}\);/g, 
    'progressCallback({\n                  sessionId,\n                  fileName: path.basename(localPath),\n                  bytesTransferred: uploadedBytes,\n                  totalBytes: fileSize,\n                  percent,\n                  status: \'uploading\'\n                });'
  );
  
  fs.writeFileSync(filePath, updatedContent, 'utf8');
  console.log('文件已更新，请重启开发服务器');
} else {
  console.log('文件已经包含必要的设置');
}
