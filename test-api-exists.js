// 在控制台运行检查
console.log('Testing API availability');
console.log('window.api exists:', !!window.api);
console.log('window.api.sftp exists:', !!window.api?.sftp);
console.log('window.api.sftp.cancelUpload exists:', !!window.api?.sftp?.cancelUpload);
